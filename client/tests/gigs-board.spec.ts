import { test, expect } from '@playwright/test';

test.describe('Open Gig Board Page (/gigs)', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    // Intercept API fetch requests for gigs to return empty list and verify rich empty state
    await page.route('**/api/**/gigs*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.goto('/gigs', { waitUntil: 'domcontentloaded' });
  });

  test('loads without error and displays high-contrast title, subheadline & stats', async ({ page }) => {
    // Check main title
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('Open');
    await expect(heading).toContainText('Gig Board');

    // Check subheadline
    const subheadline = page.locator('.pbn-subtitle-main');
    await expect(subheadline).toBeVisible();
    await expect(subheadline).toContainText('A decentralized escrow marketplace');

    // Verify statistics in Space Mono font
    const statsStrip = page.locator('.pbn-stats-badge');
    await expect(statsStrip.first()).toBeVisible();
    await expect(statsStrip.first()).toContainText('0 Open Projects');
  });

  test('renders unified pill-shaped command search bar with accessibility attributes', async ({ page }) => {
    const searchContainer = page.locator('.pbn-command-search');
    await expect(searchContainer).toBeVisible();

    const searchInput = page.getByRole('textbox', { name: /search gig listings/i });
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute('placeholder', /Search by gig title/i);

    const searchButton = page.getByRole('button', { name: /submit search/i });
    await expect(searchButton).toBeVisible();

    // Verify touch target >= 44px
    const box = await searchButton.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });

  test('renders dual-audience cards (For Humans / A2H and For Agents / A2A)', async ({ page }) => {
    // Card 1: For Humans (A2H)
    const humanCard = page.locator('.pbn-audience-card', { hasText: 'Hire an AI Agent (or Human)' });
    await expect(humanCard).toBeVisible();
    await expect(humanCard).toContainText('For Humans · A2H');
    await expect(humanCard).toContainText('Post a task, set a verified budget');

    const postBtn = humanCard.getByRole('button', { name: /post a project/i });
    await expect(postBtn).toBeVisible();
    const postBox = await postBtn.boundingBox();
    expect(postBox?.height).toBeGreaterThanOrEqual(44);

    // Card 2: For Agents (A2A)
    const agentCard = page.locator('.pbn-audience-card', { hasText: 'Work as an Agent' });
    await expect(agentCard).toBeVisible();
    await expect(agentCard).toContainText('For Agents · A2A');
    await expect(agentCard).toContainText('Register your autonomous agent');

    const registerLink = agentCard.getByRole('link', { name: /register agent profile/i });
    await expect(registerLink).toBeVisible();
    await expect(registerLink).toHaveAttribute('href', '/agents/register');

    const qaLink = agentCard.getByRole('link', { name: /read agent q&a/i });
    await expect(qaLink).toBeVisible();
    await expect(qaLink).toHaveAttribute('href', '/developers');
  });

  test('renders horizontal filter controls for categories, payment rails, and sorting', async ({ page }) => {
    const filterContainer = page.locator('.pbn-filter-container');
    await expect(filterContainer).toBeVisible();

    // Category select
    const categorySelect = page.getByRole('combobox', { name: /filter by category/i });
    await expect(categorySelect).toBeVisible();
    await expect(categorySelect).toContainText('All Categories');

    // Payment Rail select
    const paymentSelect = page.getByRole('combobox', { name: /filter by payment rail/i });
    await expect(paymentSelect).toBeVisible();
    await expect(paymentSelect).toContainText('All Payment Rails');

    // Sort select
    const sortSelect = page.getByRole('combobox', { name: /sort gig listings/i });
    await expect(sortSelect).toBeVisible();
    await expect(sortSelect).toContainText('Newest First');
  });

  test('renders the rich empty state and triggers the post modal', async ({ page }) => {
    const emptyState = page.locator('.pbn-empty-state-card');
    await expect(emptyState).toBeVisible();

    // Check empty state headline
    await expect(emptyState.locator('h3')).toHaveText('No open gigs right now. Be the first.');

    // Check empty state body text
    await expect(emptyState).toContainText(
      'Whether you are a business owner looking for a plumber, or an AI developer looking to test a new agent, you can create the first listing.'
    );

    // Capture screenshot of the rich empty state
    await page.screenshot({ path: 'test-results/gigs-empty-state.png', fullPage: true });

    // Check Call-to-action button
    const ctaButton = emptyState.getByRole('button', { name: /post the first project/i });
    await expect(ctaButton).toBeVisible();

    // Click CTA and verify modal dialog opens
    await ctaButton.click();

    const modalDialog = page.getByRole('dialog');
    await expect(modalDialog).toBeVisible();
    await expect(modalDialog).toContainText('Post a Project or Bounty');

    await page.screenshot({ path: 'test-results/gigs-post-modal.png' });
  });
});
