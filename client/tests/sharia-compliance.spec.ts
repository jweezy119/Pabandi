import { test, expect } from '@playwright/test';

test.describe('Sharia Compliance Page (/sharia-compliance)', () => {
  test('loads without a 404 and displays the Islamic finance headline', async ({ page }) => {
    const response = await page.goto('/sharia-compliance');
    expect(response?.status()).toBeLessThan(400);

    // Assert main headline
    const headline = page.getByRole('heading', { level: 1 });
    await expect(headline).toContainText('Finance without Riba');
    await expect(headline).toContainText('Trust without Gharar');
  });

  test('renders all 3 pillars of Pabandi compliance', async ({ page }) => {
    await page.goto('/sharia-compliance');

    // Pillar 1: No Riba
    const pillar1 = page.locator('article', { hasText: 'No Riba (Interest)' });
    await expect(pillar1).toBeVisible();
    await expect(pillar1).toContainText('Mudarabah & Wakala');
    await expect(pillar1).toContainText('Instead of paying you fixed interest');

    // Pillar 2: No Gharar
    const pillar2 = page.locator('article', { hasText: 'No Gharar (Uncertainty)' });
    await expect(pillar2).toBeVisible();
    await expect(pillar2).toContainText('Deterministic Anchor PDA');
    await expect(pillar2).toContainText('You know exactly what you are paying for');

    // Pillar 3: No Maisir
    const pillar3 = page.locator('article', { hasText: 'No Maisir (Speculation)' });
    await expect(pillar3).toBeVisible();
    await expect(pillar3).toContainText('Proof of Real-World Labor');
    await expect(pillar3).toContainText('utility token for platform access');
  });

  test('contains valid Schema.org JSON-LD structured data for autonomous agents', async ({ page }) => {
    await page.goto('/sharia-compliance');

    // Find JSON-LD script in DOM
    const jsonLdElement = page.locator('script[type="application/ld+json"]');
    await expect(jsonLdElement).toBeAttached();

    const jsonText = await jsonLdElement.textContent();
    expect(jsonText).toBeTruthy();

    const data = JSON.parse(jsonText!);
    expect(data['@context']).toBe('https://schema.org');
    expect(data['@type']).toBe('FinancialProduct');
    expect(data.name).toBe('Pabandi Escrow');
    expect(data.compliance['@type']).toBe('ComplianceStandard');
    expect(data.compliance.name).toBe('Islamic Finance (Sharia)');
    expect(data.compliance.status).toBe('Certified');
    expect(data.compliance.principles).toContain('No Riba (Zero Interest)');
    expect(data.compliance.principles).toContain('No Gharar (Zero Ambiguity)');
    expect(data.compliance.principles).toContain('No Maisir (Zero Speculation)');
  });

  test('displays the Agent Access Panel with MCP and cURL snippets', async ({ page }) => {
    await page.goto('/sharia-compliance');

    const agentPanel = page.locator('#agent-panel');
    await expect(agentPanel).toBeVisible();
    await expect(agentPanel).toContainText('For AI Agents & Developers');
    await expect(agentPanel).toContainText('pabandi_check_sharia_compliance');
  });

  test('opens and closes the Sharia Certificate preview dialog', async ({ page }) => {
    await page.goto('/sharia-compliance');

    const downloadBtn = page.getByRole('button', { name: /Download Sharia Certificate/i });
    await downloadBtn.click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Pabandi Sharia Compliance Certificate');
    await expect(modal).toContainText('AAOIFI');

    // Close modal
    const closeBtn = modal.getByRole('button', { name: /Close/i });
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });
});

