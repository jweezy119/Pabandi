import { test, expect } from '@playwright/test';

test.describe('Booking Discovery Page (/booking)', () => {
  const page1Items = Array.from({ length: 20 }, (_, i) => ({
    id: `biz-${i + 1}`,
    name: i === 0 ? 'Acme Roofing Services' : `Provider ${i + 1}`,
    category: i % 2 === 0 ? 'ROOFING' : 'CLINIC',
    city: i % 2 === 0 ? 'Chicago' : 'Karachi',
    rating: 4.8,
    reviewCount: 24,
    avatarUrl: null,
    startingPrice: 50,
    escrowEnabled: true,
    trustBand: 'GOLD',
    website: `https://biz${i + 1}-portal.com/services/book`,
  }));

  const page2Items = Array.from({ length: 20 }, (_, i) => ({
    id: `biz-${i + 21}`,
    name: `Provider ${i + 21}`,
    category: 'HVAC',
    city: 'Austin',
    rating: 4.9,
    reviewCount: 30,
    avatarUrl: null,
    startingPrice: 75,
    escrowEnabled: true,
    trustBand: 'ELITE',
    website: `https://biz${i + 21}-portal.com/info`,
  }));

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);

    // Mock count endpoint
    await page.route('**/api/**/businesses/count*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, count: 1250 }),
      });
    });

    // Mock cursor-paginated discovery endpoint
    await page.route('**/api/**/booking/businesses*', async (route) => {
      const url = new URL(route.request().url());
      const cursor = url.searchParams.get('cursor');
      const query = url.searchParams.get('query');

      if (query === 'empty_search') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [], nextCursor: null, success: true }),
        });
      }

      if (cursor === 'biz-20') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: page2Items, nextCursor: null, success: true }),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: page1Items, nextCursor: 'biz-20', success: true }),
      });
    });

    // Seed auth storage so AppShellLayout does not bounce to /login
    await page.addInitScript(() => {
      const exp = Math.floor(Date.now() / 1000) + 86400;
      const b64 = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${b64(JSON.stringify({ id: 'test-user', exp }))}.mock-sig`;
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: {
            token,
            refreshToken: 'mock-refresh-token',
            isAuthenticated: true,
            user: { id: 'test-user', email: 'tester@pabandi.local', role: 'BUYER', preferredMode: 'business' },
          },
          version: 0,
        })
      );
    });

    await page.goto('/booking', { waitUntil: 'domcontentloaded' });
  });

  test('renders 20 rows on first page and does not display raw URLs in visible text', async ({ page }) => {
    const listContainer = page.locator('[data-testid="virtual-list-container"]');
    await expect(listContainer).toBeVisible({ timeout: 15000 });

    // Assert virtualized rows are rendered
    const rows = page.locator('[data-testid="business-row"]');
    await expect(rows.first()).toBeVisible();

    // Verify first row contains name and category
    await expect(rows.first()).toContainText('Acme Roofing Services');
    await expect(rows.first()).toContainText('ROOFING');

    // Strict assertion: NO raw URL text (e.g. http://, https://) should appear in any visible card text
    const textContent = await listContainer.innerText();
    expect(textContent).not.toContain('https://');
    expect(textContent).not.toContain('http://');
    expect(textContent).not.toContain('.com/services');
  });

  test('scrolling to bottom loads the next cursor via IntersectionObserver', async ({ page }) => {
    const listContainer = page.locator('[data-testid="virtual-list-container"]');
    await expect(listContainer).toBeVisible({ timeout: 15000 });

    // Scroll sentinel into view and dispatch scroll event
    const sentinel = page.locator('[data-testid="scroll-sentinel"]');
    await sentinel.scrollIntoViewIfNeeded();

    await listContainer.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      el.dispatchEvent(new Event('scroll'));
    });

    // Verify page 2 item appears
    await expect(page.locator('[data-testid="business-row"]').filter({ hasText: 'Provider 21' })).toBeVisible({
      timeout: 10000,
    });
  });

  test('active filter chips display and clear correctly', async ({ page }) => {
    // Type a city
    const cityInput = page.getByPlaceholder(/filter by city/i);
    await cityInput.fill('Lahore');

    // Wait for debounce and chip appearance
    const cityChip = page.locator('span', { hasText: 'City: Lahore' });
    await expect(cityChip).toBeVisible({ timeout: 5000 });

    // Click remove chip button
    const removeBtn = cityChip.getByRole('button', { name: /remove city filter/i });
    await removeBtn.click();
    await expect(cityChip).not.toBeVisible();
  });
});
