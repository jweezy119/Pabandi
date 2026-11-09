import { expect, test } from '@playwright/test';

/**
 * Phase 2 acceptance: the stream renders real work orders and the inspector
 * shows the right one.
 *
 * Run against `?fixtures=work-orders`, which loads four fixture work orders
 * through the same shell the route renders. The empty-state keyboard suite
 * runs against the bare URL and is unaffected.
 */

const FIXTURES_URL = '/coordinator-shell.html?fixtures=work-orders';

test.describe('Work order stream and inspector', () => {
  test('renders one card per work order, including the one with no prediction', async ({ page }) => {
    await page.goto(FIXTURES_URL);

    const cards = page.locator('[data-work-order-id]');
    await expect(cards).toHaveCount(4);
    await expect(page.getByText('Chase Bank – Elk Grove Pavilion')).toBeVisible();
    await expect(page.getByText('Bensenville Logistics Center')).toBeVisible();
  });

  test('clicking a row opens the inspector with that work order', async ({ page }) => {
    await page.goto(FIXTURES_URL);

    await page.locator('[data-work-order-id="wo-1425"]').click();

    const inspector = page.getByLabel('Work order details');
    await expect(inspector.getByText('Work order WO1425')).toBeVisible();
    await expect(inspector.getByText('Chase Bank – Elk Grove Pavilion')).toBeVisible();
    await expect(inspector.getByText('Marcus Reed')).toBeVisible();
    await expect(inspector.getByText('1425 Chase Ave, Elk Grove Village, IL 60007')).toBeVisible();
    // The selected row is marked, not just highlighted by hover.
    await expect(page.locator('[data-work-order-id="wo-1425"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // §4.8: Esc closes the inspector, so a visible equivalent must exist.
    await expect(page.locator('[data-pbn-focus-id="inspector-close"]')).toBeVisible();
  });

  test('Escape closes the inspector and returns to the empty state', async ({ page }) => {
    await page.goto(FIXTURES_URL);

    const inspector = page.getByLabel('Work order details');
    await page.locator('[data-work-order-id="wo-1425"]').click();
    await expect(inspector.getByText('Work order WO1425')).toBeVisible();

    await page.keyboard.press('Escape');

    // Scoped to the inspector: the card in the stream still shows its own id.
    await expect(inspector.getByText('Work order WO1425')).toHaveCount(0);
    await expect(inspector.getByText('Nothing selected')).toBeVisible();
    await expect(page.locator('[data-pbn-focus-id="inspector-close"]')).toHaveCount(0);
  });

  test('the risk chip shows the number and the plain-language band', async ({ page }) => {
    await page.goto(FIXTURES_URL);

    const chip = page.locator('[data-work-order-id="wo-1425"] .pbn-risk-chip');
    await expect(chip).toBeVisible();
    await expect(chip.locator('.pbn-risk-chip__score')).toHaveText('71%');
    await expect(chip.locator('.pbn-risk-chip__label')).toHaveText('High risk');

    // §4.2: every risk score carries a one-sentence explanation.
    await page
      .getByRole('button', { name: 'What does "High risk" mean?' })
      .first()
      .click();
    await expect(page.getByRole('tooltip').first()).toContainText(
      'more likely to go wrong',
    );
  });

  test('a job without a prediction shows no risk chip at all', async ({ page }) => {
    await page.goto(FIXTURES_URL);

    // wo-1428 is completed and has no risk payload. Inventing a score here
    // would tell the coordinator something the model never said.
    await expect(
      page.locator('[data-work-order-id="wo-1428"] .pbn-risk-chip'),
    ).toHaveCount(0);
  });

  test('an out-of-range estimate is greyed out and labelled', async ({ page }) => {
    await page.goto(FIXTURES_URL);

    const chip = page.locator('[data-work-order-id="wo-1427"] .pbn-risk-chip');
    await expect(chip).toHaveClass(/pbn-risk-chip--out-of-range/);
    await expect(chip).toContainText('Outside validated range');

    // Greyed with muted text, not opacity — opacity would drop the label
    // below the contrast minimum.
    const color = await chip.evaluate((element) => getComputedStyle(element).color);
    expect(color).toBe('rgb(138, 154, 168)');
  });

  test('the inspector explains the score in plain language, most important first', async ({ page }) => {
    await page.goto(FIXTURES_URL);

    await page.locator('[data-work-order-id="wo-1425"]').click();

    const factors = page.locator('.pbn-factor');
    await expect(factors).toHaveCount(3);

    // Sorted by |impact|: schedule density (0.32), precipitation (0.18),
    // technician experience (-0.09).
    await expect(factors.nth(0)).toContainText('four jobs booked today');
    await expect(factors.nth(1)).toContainText('More rain is expected');
    await expect(factors.nth(2)).toContainText('twelve years');

    // The machine feature name must never reach the screen (§4.1).
    await expect(page.getByText('schedule_density_today')).toHaveCount(0);

    // Both sections must actually render, not just exist off-screen.
    await expect(page.getByText('Why this score')).toBeVisible();
    await expect(page.locator('#pbn-evidence-heading')).toBeVisible();
  });

  test('the inspector shows the counterfactual range, not a point estimate', async ({ page }) => {
    // The range comes from the simulator, not from the list payload: a point
    // prediction carries no p10/p90, so there is nothing to show until the
    // strip asks.
    await page.route('**/api/v1/coordinator/work-orders/*/simulate', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { riskScore: 0.71, p10: 0.62, p50: 0.71, p90: 0.8 },
        }),
      }),
    );

    await page.goto(FIXTURES_URL);

    await page.locator('[data-work-order-id="wo-1425"]').click();

    const inspector = page.getByLabel('Work order details');
    await expect(inspector.locator('.pbn-range__value')).toHaveText('62% – 80%');
    await expect(inspector.getByText('Likely range')).toBeVisible();
  });

  test('evidence links point at the attachments on the work order', async ({ page }) => {
    await page.goto(FIXTURES_URL);

    await page.locator('[data-work-order-id="wo-1425"]').click();

    const link = page.getByRole('link', { name: /Photo/ });
    await expect(link).toHaveAttribute('href', 'https://example.com/evidence/wo-1425/leak.jpg');
    await expect(page.getByText('Photo')).toBeVisible();
    await expect(page.locator('#pbn-evidence-heading')).toBeVisible();
    await expect(page.getByText('6 recorded events on the audit trail.')).toBeVisible();
  });

  test('J and K move between rows without the mouse, and Enter opens the inspector', async ({ page }) => {
    await page.goto(FIXTURES_URL);

    const first = page.locator('[data-work-order-id="wo-1425"]');
    const second = page.locator('[data-work-order-id="wo-1426"]');
    const inspector = page.getByLabel('Work order details');

    await first.focus();
    await page.keyboard.press('j');
    await expect(second).toBeFocused();

    // Focus selects, so the inspector follows the keyboard.
    await expect(inspector.getByText('Industrial Parkway Associates')).toBeVisible();

    await page.keyboard.press('k');
    await expect(first).toBeFocused();
    await expect(inspector.getByText('Chase Bank – Elk Grove Pavilion')).toBeVisible();

    await page.keyboard.press('Enter');
    await expect(page.locator('[data-pbn-focus-id="inspector-close"]')).toBeVisible();
  });

  test('on a phone the inspector is a sheet that only appears when a row is selected', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(FIXTURES_URL);

    const inspector = page.getByLabel('Work order details');

    // Closed sheet: `visibility: hidden` keeps it out of the tab order, so it
    // must not be visible before a selection.
    await expect(inspector).not.toBeVisible();

    await page.locator('[data-work-order-id="wo-1425"]').click();
    await expect(inspector).toBeVisible();
    await expect(inspector.getByText('Work order WO1425')).toBeVisible();

    await page.locator('[data-pbn-focus-id="inspector-close"]').click();
    await expect(inspector).not.toBeVisible();
  });

  test('the selected card is reachable by Tab and announces its state', async ({ page }) => {
    await page.goto(FIXTURES_URL);

    const cards = page.locator('[data-work-order-id]');
    await cards.first().focus();
    await page.keyboard.press('Tab');

    // Tab moves into the risk chip's help trigger, which is a sibling of the
    // card button rather than a nested button.
    const focusedId = await page.evaluate(() =>
      (document.activeElement as HTMLElement | null)?.getAttribute('data-pbn-focus-id'),
    );
    expect(focusedId).toContain('work-order-wo-1425-help');
  });
});
