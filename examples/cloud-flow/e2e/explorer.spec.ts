import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/?demo=graph');
});
const traverse = (page: import('@playwright/test').Page, label: string) =>
  page.getByRole('button', { name: label, exact: true }).click();

test('focus, traverse, shared identity, branches, reverse traversal, cycle, and back', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('gr{Ai}Γ Coherence Architecture and Engine');
  await page.screenshot({ path: 'test-results/cloud-flow-desktop.png', fullPage: true });
  await traverse(page, 'Traverse REDΣ via contains');
  await traverse(page, 'Traverse REDΣ Parsing Engine via contains');
  await traverse(page, 'Traverse Language Parser via related_to');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Language Parser');
  const firstContext = await page.locator('dd').nth(1).textContent();
  await traverse(page, 'Traverse REDΣ Coherence and Resolution Engine via contributes_to');
  await traverse(page, 'Traverse REDΣ Parsing Engine via uses');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('REDΣ Parsing Engine');
  await page.getByRole('button', { name: '← Back', exact: true }).click();
  await traverse(page, 'Traverse Language Parser via reverse contributes_to');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Language Parser');
  expect(await page.locator('dd').nth(1).textContent()).not.toEqual(firstContext);
  await expect(page.locator('dd').first()).toHaveText('language-parser');
  const arrivals = page.getByRole('navigation', { name: 'Arrival breadcrumb stack' });
  await arrivals.getByRole('button', { name: 'REDΣ Parsing Engine', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Already explored from here' })).toBeVisible();
  const savedParserVisits = page
    .getByRole('complementary', { name: 'Node and edge details' })
    .getByRole('button', { name: /Language Parser/ });
  await expect(savedParserVisits).toHaveCount(2);
  await expect(savedParserVisits.first()).toBeVisible();
  await page.getByRole('button', { name: 'Fit all', exact: true }).click();
  await page.screenshot({ path: 'test-results/cloud-flow-branched.png', fullPage: true });
});

test('canvas stack controls expose cards that can become the central focus', async ({ page }) => {
  const canvas = page.getByRole('main', { name: 'Capability cloud canvas' });
  await page.getByRole('button', { name: 'Fit all', exact: true }).click();
  await canvas.getByRole('button', { name: 'Expand contains', exact: true }).click();
  await page.getByRole('button', { name: 'Fit all', exact: true }).click();
  await canvas.getByRole('button', { name: 'Focus REDΣ', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('REDΣ');
  await expect(canvas.locator('.cf-selected .cf-card-title')).toHaveText('REDΣ');
});

test('expand nested stacks, focus a stack, bolt a branch, collapse and restore', async ({ page }) => {
  const sidebar = page.getByRole('complementary', { name: 'Explore capabilities' });
  const group = sidebar.getByRole('button', { name: '+ contains', exact: true });
  await group.click();
  const root = sidebar.getByRole('button', { name: '− Outgoing relationships', exact: true });
  await root.click();
  await sidebar.getByRole('button', { name: '+ Outgoing relationships', exact: true }).click();
  await expect(sidebar.getByRole('button', { name: '− contains', exact: true })).toBeVisible();
  await sidebar.getByRole('button', { name: 'Nest exploration in contains', exact: true }).click();
  await expect(sidebar.getByRole('button', { name: /− Exploration 1/ })).toBeVisible();
  await sidebar.getByRole('button', { name: 'Center stack Exploration 1', exact: true }).click();
  await expect(page.locator('.cf-canvas-caption strong')).toHaveText('Exploration 1');
  await page.getByRole('button', { name: '← Back', exact: true }).click();
  await page.getByRole('button', { name: '↗ Bolt exploration', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('bolted');
  await page.getByText('Save & restore exploration', { exact: true }).click();
  await page.getByRole('button', { name: 'Save session', exact: true }).click();
  await page.getByRole('button', { name: 'Reset exploration', exact: true }).click();
  await page.getByRole('button', { name: 'Restore saved', exact: true }).click();
  await expect(sidebar.getByRole('button', { name: /− Exploration 2/ })).toBeVisible();
  await page.reload();
  await page.getByText('Save & restore exploration', { exact: true }).click();
  await page.getByRole('button', { name: 'Restore saved', exact: true }).click();
  await expect(sidebar.getByRole('button', { name: /− Exploration 2/ })).toBeVisible();
});

test('search, filters, keyboard traversal, keyboard stack controls and back', async ({ page }) => {
  const search = page.getByRole('textbox', { name: 'Search capabilities' });
  await search.fill('HOWIE');
  await page.getByRole('button', { name: 'HOWIE Transformation Engine application · howie', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('HOWIE Transformation Engine');
  await page.keyboard.press('Alt+ArrowLeft');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('gr{Ai}Γ');
  await search.fill('');
  await page.getByRole('combobox', { name: 'Node type', exact: true }).selectOption('architecture');
  await page.getByRole('combobox', { name: 'Relationship', exact: true }).selectOption('contains');
  const target = page.getByRole('button', { name: 'Traverse REDΣ via contains', exact: true });
  await target.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('REDΣ');
  await page.getByRole('combobox', { name: 'Node type', exact: true }).selectOption('');
  const expand = page
    .getByRole('complementary', { name: 'Explore capabilities' })
    .getByRole('button', { name: '+ contains', exact: true });
  await expand.focus();
  await page.keyboard.press('Enter');
  await expect(expand).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Reduce motion' }).check();
});

test('loads JSON and reports invalid documents or sessions without losing valid graph', async ({ page }) => {
  await page.getByLabel('Load graph JSON').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"schemaVersion":"1.0","nodes":[],"edges":[]}'),
  });
  await expect(page.getByRole('alert')).toContainText('nonempty array');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('gr{Ai}Γ');
  await page.getByText('Save & restore exploration', { exact: true }).click();
  await page.getByRole('textbox', { name: 'Session JSON' }).fill('{}');
  await page.getByRole('button', { name: 'Restore JSON', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Error:');
  await page.getByLabel('Load graph JSON').setInputFiles({
    name: 'small.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        schemaVersion: '1.0',
        nodes: [{ id: 'a', label: 'Loaded capability', type: 'capability' }],
        edges: [],
      })
    ),
  });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Loaded capability');
});

test.describe('touch input', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('keeps discovery, canvas and details accessible', async ({ page }) => {
    await expect(page.getByRole('textbox', { name: 'Search capabilities' })).toBeVisible();
    await page.getByRole('button', { name: 'Traverse REDΣ via contains', exact: true }).tap();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('REDΣ');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const inspector = page.getByRole('complementary', { name: 'Node and edge details' });
    expect(await inspector.evaluate((element) => element.clientHeight)).toBeGreaterThan(200);
    await page.screenshot({ path: 'test-results/cloud-flow-mobile.png', fullPage: true });
  });
});
