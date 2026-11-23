import { test, expect } from '@playwright/test';

test('Research card opens on Symmetric Encryption and its linked business content', async ({ page }) => {
  await page.goto('/');
  const home = page.getByRole('article', { name: 'Wiki page 100 Monkeys', exact: true });
  await home.getByRole('button', { name: 'Research notes', exact: true }).click();
  const current = page.locator('.wiki-page-focused');
  await expect(current.getByRole('button', { name: 'Open page Research', exact: true })).toBeVisible();
  await expect(current).toContainText('Symmetric Encryption');
  await expect(current).toContainText('What it can do');
  await current.getByRole('button', { name: 'Open Symmetric Encryption research', exact: true }).click();
  await expect(current).toContainText('Faster authentication');
  await current.getByRole('button', { name: '12 Business Applications', exact: true }).click();
  await expect(current).toContainText('API and service-to-service authentication');
  await expect(current).toContainText('Financial transaction');
  await expect(current).toContainText('Ask us to demonstrate it');
});
