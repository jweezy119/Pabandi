import { test, expect } from '@playwright/test';

test.describe('Trust Passport Badges & Verification Modal', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);

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

    // Mock count endpoint
    await page.route('**/api/**/businesses/count*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, count: 42 }),
      });
    });

    // Mock API for booking businesses discovery
    await page.route('**/api/**/booking/businesses*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'biz_apex_roofing_01',
              name: 'Apex Commercial Roofing & Solar',
              category: 'Commercial Services',
              city: 'Karachi',
              rating: 4.9,
              reviewCount: 42,
              avatarUrl: null,
              startingPrice: 500,
              escrowEnabled: true,
              trustBand: 'TOP',
              trustScore: 940,
            },
          ],
          nextCursor: null,
          success: true,
        }),
      });
    });

    // Mock verification endpoint
    await page.route('**/api/v1/trust/passport/verify', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          isValid: true,
          verifiedPredicates: ['trust_score > 800', 'dispute_rate < 2%'],
        }),
      });
    });

    // Mock gigs endpoint
    await page.route('**/api/**/gigs*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'gig_solar_install_01',
              title: 'Commercial Solar Panel Inverter Setup',
              category: 'agent-to-human',
              budgetUsd: 1200,
              paymentRail: 'solana',
              requiredSkills: ['Solar', 'Electrical', 'Anchor'],
              competingBids: 3,
              status: 'OPEN',
            },
          ],
        }),
      });
    });
  });

  test('renders ZK Trust Badge on discovery business row and opens verification modal', async ({ page }) => {
    await page.goto('/booking', { waitUntil: 'domcontentloaded' });

    // Look for ZK Trust Badge
    const badge = page.getByTitle(/Click to verify BBS\+ ZK Proof/i).first();
    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(badge).toContainText('ZK');

    // Click badge to open modal
    await badge.click();

    // Verification modal dialog
    const modal = page.getByRole('dialog', { name: /Trust Passport Verification/i });
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Trust Passport Verification');
    await expect(modal).toContainText('Apex Commercial Roofing & Solar');
    await expect(modal).toContainText('Pabandi Authority');
    await expect(modal).toContainText('Reliability Trust Score');
    await expect(modal).toContainText('ZK Cryptographic Proof Verified Valid');

    // Close modal
    const closeBtn = page.getByRole('button', { name: /Done/i });
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });

  test('renders ZK Trust Badge on gig cards and verifies counterparty standing', async ({ page }) => {
    await page.goto('/gigs', { waitUntil: 'domcontentloaded' });

    const gigBadge = page.getByTitle(/Click to verify BBS\+ ZK Proof/i).first();
    await expect(gigBadge).toBeVisible({ timeout: 15000 });
    await expect(gigBadge).toContainText('920');

    // Open modal from gig card
    await gigBadge.click();

    const modal = page.getByRole('dialog', { name: /Trust Passport Verification/i });
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Commercial Solar Panel Inverter Setup');
    await expect(modal).toContainText('Contract Dispute Rate');
    await expect(modal).toContainText('ZK Cryptographic Proof Verified Valid');
  });
});

