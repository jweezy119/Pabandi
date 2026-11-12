import { test, expect } from '@playwright/test';

test.describe('Trust OS (/trust-os)', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);

    // Seed auth storage for BusinessGuard & AppShell
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

    // Mock metrics and ledger APIs
    await page.route('**/api/v1/trust/passport/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          trustScore: 940,
          disputeRate: 0.4,
          data: {
            subjectId: 'biz_apex_roofing',
            businessName: 'Apex Roofing & Contracting',
          },
        }),
      });
    });

    await page.route('**/api/v1/orchestrator/ledger/transactions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          transactions: [
            {
              id: 'tx_ledger_test_01',
              paymentId: 'pay_init_raast_001',
              reference: 'gig_lahore_solar_01',
              rail: 'raast',
              totalAmount: 45000,
              currency: 'PKR',
              status: 'POSTED',
              createdAt: new Date().toISOString(),
              entries: [
                {
                  id: 'entry_1',
                  account: 'clearing:raast:pkr',
                  accountType: 'ASSET',
                  debit: 45000,
                  credit: 0,
                  currency: 'PKR',
                  description: 'Inbound settlement via raast',
                },
                {
                  id: 'entry_2',
                  account: 'escrow:gig:gig_lahore_solar_01',
                  accountType: 'LIABILITY',
                  debit: 0,
                  credit: 45000,
                  currency: 'PKR',
                  description: 'Escrow liability locked',
                },
              ],
              trustScoreImpact: {
                payerScoreDelta: 15,
                payeeScoreDelta: 20,
                reason: 'Settled transaction via raast rail with 100% asset backing',
              },
            },
          ],
        }),
      });
    });

    await page.route('**/api/v1/orchestrator/ledger/reconciliation', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          reconciliation: {
            totalVolumeUsd: 142500,
            transactionCount: 38,
            balanced: true,
            rails: { raast: 45000, solana: 97500 },
          },
        }),
      });
    });

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

    await page.goto('/trust-os', { waitUntil: 'domcontentloaded' });
  });

  test('loads Trust OS dashboard with live reliability score, tier, and ensemble weighting', async ({ page }) => {
    // Header & live score
    await expect(page.getByText('Trust OS — The Reliability & Reputation Engine')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Cryptographic Trust & Asset-Backed Settlement')).toBeVisible();
    await expect(page.getByText('940')).toBeVisible();
    await expect(page.getByText('Diamond Standing')).toBeVisible();

    // Ensemble components
    await expect(page.getByText('Trust Ensemble Weighting Components')).toBeVisible();
    await expect(page.getByText('Escrow Fulfillment Rate')).toBeVisible();
    await expect(page.getByText('Double-Entry Clearing Balance')).toBeVisible();
  });

  test('switches to Escrow & Double-Entry Ledger tab and shows balanced journal transactions', async ({ page }) => {
    const ledgerTabBtn = page.getByRole('button', { name: /Escrow & Double-Entry Ledger/i });
    await expect(ledgerTabBtn).toBeVisible({ timeout: 15000 });
    await ledgerTabBtn.click();

    await expect(page.getByText('Double-Entry Escrow Ledger')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('tx_ledger_test_01')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('clearing:raast:pkr')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('escrow:gig:gig_lahore_solar_01')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Trust Score Impact: \+15 payer, \+20 payee/i)).toBeVisible({ timeout: 15000 });
  });

  test('switches to Counterparty Verifier tab and validates ZK proof payload', async ({ page }) => {
    const verifierTabBtn = page.getByRole('button', { name: /Counterparty Verifier/i });
    await expect(verifierTabBtn).toBeVisible({ timeout: 15000 });
    await verifierTabBtn.click();

    await expect(page.getByText('Public Counterparty Proof Verifier')).toBeVisible({ timeout: 15000 });

    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible({ timeout: 15000 });

    await textarea.fill(JSON.stringify({
      issuer: 'Pabandi',
      subjectId: 'biz_sample_partner',
      issuedAt: 1740000000000,
      predicates: { trustScore: '>800', disputeRate: '<2%' },
      signature: 'zkp_mock_bbs_valid',
    }));

    const verifyBtn = page.getByRole('button', { name: /Verify Counterparty Standing/i });
    await verifyBtn.click();

    await expect(page.getByText('Proof Cryptographically Verified Valid')).toBeVisible();
    await expect(page.getByText('trust_score > 800, dispute_rate < 2%')).toBeVisible();
  });
});

