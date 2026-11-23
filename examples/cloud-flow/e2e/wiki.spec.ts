import { test, expect } from '@playwright/test';
const custom = {
  format: 'wiki-stacks',
  schemaVersion: '1.0',
  title: 'My test wiki',
  startPageId: 'alpha',
  pages: [
    {
      id: 'alpha',
      title: 'Alpha notes',
      content: 'Wiki content written only in JSON.\n\n## A section\nFollow [[beta|the Beta article]].',
    },
    {
      id: 'beta',
      title: 'Beta article',
      content: 'Beta has its own full wiki text.\n\n- One fact\n- Another fact\n\nReturn to [[alpha|Alpha notes]].',
    },
    { id: 'gamma', title: 'Gamma research', content: 'A shared reference page with independent identity.' },
  ],
  stacks: [
    {
      id: 'reading',
      title: 'My reading cards',
      anchorPageId: 'alpha',
      orientation: 'horizontal',
      side: 'right',
      members: [{ pageId: 'beta' }, { stackId: 'nested' }],
    },
    {
      id: 'nested',
      title: 'Nested reference cards',
      anchorPageId: 'alpha',
      orientation: 'vertical',
      side: 'right',
      members: [{ pageId: 'gamma' }],
    },
  ],
};
test.beforeEach(async ({ page }) => {
  await page.goto('/');
});
async function loadCustom(page: import('@playwright/test').Page) {
  await page
    .getByLabel('Load wiki JSON')
    .setInputFiles({ name: 'my-wiki.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(custom)) });
}
test('default view presents wiki text inside cards and JSON-defined nested stacks', async ({ page }) => {
  await expect(page.locator('.wiki-page-focused .wiki-page-heading')).toHaveText('100 Monkeys');
  await expect(page.locator('.wiki-page-focused')).toContainText('100 Monkeys develops resolution, transformation');
  await expect(page.getByRole('region', { name: 'Stack Core architecture', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Stack Engine notes', exact: true })).toHaveCount(1);
  await expect(page.getByRole('article', { name: 'Wiki page REDΣ', exact: true })).toContainText(
    'Four connected capabilities'
  );
  await page.screenshot({ path: 'test-results/wiki-desktop.png', fullPage: true });
});
test('loading and editing JSON builds actual page content and recursive card groups', async ({ page }) => {
  await loadCustom(page);
  await expect(page.locator('.wiki-page-focused')).toContainText('Wiki content written only in JSON.');
  await expect(page.getByRole('article', { name: 'Wiki page Beta article', exact: true })).toContainText(
    'Beta has its own full wiki text.'
  );
  await expect(page.getByRole('article', { name: 'Wiki page Gamma research', exact: true })).toContainText(
    'shared reference'
  );
  await page.getByRole('button', { name: 'Edit JSON', exact: true }).click();
  const edited = structuredClone(custom);
  edited.pages[0].title = 'Changed in JSON';
  edited.pages[0].content = 'This replacement content comes directly from the JSON editor.';
  await page.getByRole('textbox', { name: 'Wiki JSON', exact: true }).fill(JSON.stringify(edited));
  await page.getByRole('button', { name: 'Build stacks', exact: true }).click();
  await expect(page.locator('.wiki-page-focused .wiki-page-heading')).toHaveText('Changed in JSON');
  await expect(page.locator('.wiki-page-focused')).toContainText('replacement content comes directly');
});
test('inline wiki links recenter the article and preserve arrival and onward reading', async ({ page }) => {
  await loadCustom(page);
  await page.locator('.wiki-page-focused').getByRole('button', { name: 'the Beta article', exact: true }).click();
  await expect(page.locator('.wiki-page-focused .wiki-page-heading')).toHaveText('Beta article');
  await page.getByRole('button', { name: '← Back', exact: true }).click();
  await expect(page.locator('.wiki-page-focused .wiki-page-heading')).toHaveText('Alpha notes');
  await expect(page.getByRole('article', { name: 'Wiki page Beta article', exact: true })).toHaveCount(2);
  await page
    .getByRole('navigation', { name: 'Breadcrumb stack' })
    .getByRole('button', { name: 'Alpha notes', exact: true })
    .focus();
  await page.locator('.wiki-page-focused').getByRole('button', { name: 'the Beta article', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.wiki-page-focused .wiki-page-heading')).toHaveText('Beta article');
  await page.keyboard.press('Alt+ArrowLeft');
  await expect(page.locator('.wiki-page-focused .wiki-page-heading')).toHaveText('Alpha notes');
});
test('nested stacks collapse and expand, bolt, and restore after reload', async ({ page }) => {
  await loadCustom(page);
  await page.getByRole('button', { name: 'See all stacks', exact: true }).click();
  await page.getByRole('button', { name: 'Collapse stack Nested reference cards', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Wiki page Gamma research', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Expand stack Nested reference cards', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Wiki page Gamma research', exact: true })).toHaveCount(1);
  await page.getByText('Exploration ⋯', { exact: true }).click();
  await page.getByRole('button', { name: 'Bolt a new stack', exact: true }).click();
  await page.getByRole('button', { name: 'Save exploration', exact: true }).click();
  await page.reload();
  await loadCustom(page);
  await page.getByText('Exploration ⋯', { exact: true }).click();
  await page.getByRole('button', { name: 'Restore exploration', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Stack Exploration 1', exact: true })).toHaveCount(1);
  await expect(page.getByRole('status')).toContainText('restored');
});
test('search reads wiki body text and malformed JSON leaves the previous wiki intact', async ({ page }) => {
  await loadCustom(page);
  await page.getByRole('textbox', { name: 'Search wiki', exact: true }).fill('independent identity');
  await page
    .locator('.wiki-search-results')
    .getByRole('button', { name: /Gamma research/ })
    .click();
  await expect(page.locator('.wiki-page-focused .wiki-page-heading')).toHaveText('Gamma research');
  await page.getByLabel('Load wiki JSON').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({ ...custom, stacks: [{ ...custom.stacks[0], members: [{ stackId: 'missing' }] }] })
    ),
  });
  await expect(page.getByRole('alert')).toContainText('missing stack');
  await expect(page.locator('.wiki-page-focused .wiki-page-heading')).toHaveText('Gamma research');
});
test.describe('wiki touch', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('keeps the reading card and wiki links usable on a phone', async ({ page }) => {
    await loadCustom(page);
    await page.screenshot({ path: 'test-results/wiki-mobile-before.png', fullPage: true });
    await page.locator('.wiki-page-focused').getByRole('button', { name: 'the Beta article', exact: true }).tap();
    await expect(page.locator('.wiki-page-focused .wiki-page-heading')).toHaveText('Beta article');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: 'test-results/wiki-mobile.png', fullPage: true });
  });
});
