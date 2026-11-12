import { test, expect } from '@playwright/test';

test.describe('Trust Passport (ZK-Proof Reputation) (/contact/trust-passport)', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);

    // Mock the /api/v1/trust/passport/me endpoint
    await page.route('**/api/**/trust/passport/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            subjectId: 'biz_apex_roofing',
            businessName: 'Apex Roofing & HVAC',
            trustScore: 920,
            disputeRate: 0.5,
          },
          trustScore: 920,
          disputeRate: 0.5,
        }),
      });
    });

    // Mock the /api/v1/trust/passport/generate endpoint
    await page.route('**/api/**/trust/passport/generate', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      const { minScore, maxDisputeRate } = body;

      if (minScore > 920 || maxDisputeRate < 0.5) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Your current trust score does not meet the requested predicate.',
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            issuer: 'Pabandi',
            subjectId: 'biz_apex_roofing',
            issuedAt: Date.now(),
            predicates: {
              trustScore: `>${minScore}`,
              disputeRate: `<${maxDisputeRate}%`,
            },
            signature: 'zkp_bbs_80f861209b9eb5a501ada2f71082800f_ed497ee17bca8912',
          },
        }),
      });
    });

    // Mock the /api/v1/trust/passport/verify endpoint
    await page.route('**/api/**/trust/passport/verify', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      const payload = body.proof_payload || body;

      if (payload.issuer === 'Pabandi' && payload.signature?.startsWith('zkp_')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            isValid: true,
            verifiedPredicates: [
              `trust_score ${payload.predicates?.trustScore}`,
              `dispute_rate ${payload.predicates?.disputeRate}`,
            ],
          }),
        });
      } else {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            isValid: false,
            error: 'Invalid signature or untrusted issuer',
          }),
        });
      }
    });

    // Seed auth storage for BusinessGuard
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
            user: {
              id: 'test-user',
              email: 'apex@pabandi.local',
              role: 'BUSINESS_OWNER',
              preferredMode: 'business',
              activeMode: 'business',
              businessId: 'biz_apex_roofing',
            },
          },
          version: 0,
        })
      );
      localStorage.setItem('pabandi_token', token);
      localStorage.setItem('pabandi_business_id', 'biz_apex_roofing');
    });

    await page.goto('/contact/trust-passport', { waitUntil: 'domcontentloaded' });
  });

  test('renders Section 1 with live Trust Score and Dispute Rate metrics', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Trust Passport/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Section 1: Your Current Status')).toBeVisible();
    await expect(page.getByText('920')).toBeVisible();
    await expect(page.getByText('0.5%')).toBeVisible();
  });

  test('generates ZK proof and renders Section 3 with JSON payload and copy button', async ({ page }) => {
    await expect(page.getByText('Section 2: Generate a Proof')).toBeVisible({ timeout: 15000 });

    const generateBtn = page.getByRole('button', { name: /Generate Trust Passport/i });
    await expect(generateBtn).toBeVisible();
    await generateBtn.click();

    // Section 3 appears with generated proof
    await expect(page.getByText('Section 3: Your Proof')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /Copy to Clipboard/i })).toBeVisible();

    // Check pre block contains required JSON attributes
    const preBlock = page.locator('pre');
    await expect(preBlock).toContainText('"issuer": "Pabandi"');
    await expect(preBlock).toContainText('"subjectId": "biz_apex_roofing"');
    await expect(preBlock).toContainText('zkp_bbs_');

    // Test in-page verification
    const testVerifyBtn = page.getByRole('button', { name: /Test Verification/i });
    await expect(testVerifyBtn).toBeVisible();
    await testVerifyBtn.click();

    await expect(page.getByText('Status: Verified Valid')).toBeVisible({ timeout: 10000 });
  });

  test('displays error message when predicates exceed business metrics', async ({ page }) => {
    await expect(page.getByText('Section 2: Generate a Proof')).toBeVisible({ timeout: 15000 });

    // Set minScore to 950 (exceeding 920)
    const minScoreInput = page.locator('input[type="number"]').first();
    await minScoreInput.fill('950');

    const generateBtn = page.getByRole('button', { name: /Generate Trust Passport/i });
    await generateBtn.click();

    await expect(
      page.getByText('Your current trust score does not meet the requested predicate.')
    ).toBeVisible({ timeout: 10000 });
  });
});

