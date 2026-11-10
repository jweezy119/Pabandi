import { test, expect } from '@playwright/test';

test.describe('Pabandi Core Routes Deep Audit', () => {
  test('Route / (Landing Page) renders without crashing', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator('body')).toBeVisible();
  });

  test('Route /sharia-compliance renders 200 OK without crashing', async ({ page }) => {
    const res = await page.goto('/sharia-compliance');
    expect(res?.status()).toBeLessThan(400);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('text=Finance without Riba')).toBeVisible();
  });

  test('Route /coordinator/dispatch renders without crashing', async ({ page }) => {
    const res = await page.goto('/coordinator/dispatch');
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator('body')).toBeVisible();
  });

  test('Route /invoice/:id renders without crashing (dummy ID)', async ({ page }) => {
    const res = await page.goto('/invoice/inv-dummy-test-123');
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator('body')).toBeVisible();
  });

  test('Route /developers renders without crashing', async ({ page }) => {
    const res = await page.goto('/developers');
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator('body')).toBeVisible();
  });
});

