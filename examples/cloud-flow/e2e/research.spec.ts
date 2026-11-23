import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/?demo=research');
});

test('research stays inside the viewport and opens connected information', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Symmetric Encryption' }).first()).toBeVisible();
  await page
    .getByRole('button', { name: /Business applications/i })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Business applications' })).toBeVisible();
  await page.getByRole('button', { name: /API and service-to-service authentication/i }).click();
  await expect(page.getByText(/request a demonstration of this capability/i)).toBeVisible();
  await page
    .getByRole('button', { name: /Symmetric vs. asymmetric/i })
    .last()
    .click();
  await expect(page.getByRole('heading', { name: 'Symmetric vs. asymmetric' })).toBeVisible();
  await page.getByRole('button', { name: /Back/i }).click();
  await expect(page.getByRole('heading', { name: 'Business applications' })).toBeVisible();
  const bounds = await page.evaluate(() => ({
    windowW: window.innerWidth,
    windowH: window.innerHeight,
    rootW: document.documentElement.scrollWidth,
    rootH: document.documentElement.scrollHeight,
    contentW: document.querySelector('.research-viewport')?.getBoundingClientRect().width,
    contentH: document.querySelector('.research-viewport')?.getBoundingClientRect().height,
  }));
  expect(bounds.rootW).toBeLessThanOrEqual(bounds.windowW + 1);
  expect(bounds.rootH).toBeLessThanOrEqual(bounds.windowH + 1);
  expect(bounds.contentW).toBeLessThanOrEqual(bounds.windowW + 1);
  expect(bounds.contentH).toBeLessThanOrEqual(bounds.windowH + 1);
});

test.describe('small-screen viewport', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('content scrolls internally without extending the document', async ({ page }) => {
    await page
      .getByRole('button', { name: /Business applications/i })
      .first()
      .tap();
    await expect(page.getByRole('heading', { name: 'Business applications' })).toBeVisible();
    const result = await page.evaluate(() => {
      const scroller = document.querySelector('.research-content-scroll')!;
      const root = document.documentElement;
      return {
        rootW: root.scrollWidth,
        rootH: root.scrollHeight,
        innerW: innerWidth,
        innerH: innerHeight,
        scrollArea: scroller.scrollHeight,
        visibleArea: scroller.clientHeight,
      };
    });
    expect(result.rootW).toBeLessThanOrEqual(result.innerW + 1);
    expect(result.rootH).toBeLessThanOrEqual(result.innerH + 1);
    expect(result.scrollArea).toBeGreaterThan(result.visibleArea);
  });
});
