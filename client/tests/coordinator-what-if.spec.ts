import { expect, test, type Page } from '@playwright/test';

/**
 * Phase 4 acceptance: the what-if strip (§7.2).
 *
 * The properties this suite exists to pin:
 *  - the strip renders only when the server supplied a feature vector, so a
 *    job the model has not scored gets no sliders;
 *  - a slider sends a DELTA, not an absolute value, because the server's
 *    features are the baseline;
 *  - the response is shown as a RANGE, never a point estimate;
 *  - an out-of-range result is greyed and flagged, not hidden;
 *  - Reset returns to the job's own values and re-requests.
 *
 * The simulate endpoint is intercepted so the exact request body can be
 * asserted rather than inferred from a changed number.
 */

const FIXTURES_URL = '/coordinator-shell.html?fixtures=work-orders';

interface SimulationResponse {
  riskScore: number;
  p10: number;
  p50: number;
  p90: number;
  outOfRange?: boolean;
}

function installSimulator(
  page: Page,
  respond: (body: Record<string, number>) => SimulationResponse,
) {
  const calls: Array<Record<string, number>> = [];

  void page.route('**/api/v1/coordinator/work-orders/*/simulate', async (route) => {
    const body = (route.request().postDataJSON() ?? {}) as Record<string, number>;
    calls.push(body);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: respond(body) }),
    });
  });

  return calls;
}

async function openInspector(page: Page, workOrderId: string) {
  await page.goto(FIXTURES_URL);
  await page.locator(`[data-work-order-id="${workOrderId}"]`).click();
  return page.getByLabel('Work order details');
}

/**
 * Waits for a request whose body matches, and returns the last one.
 *
 * Needed because the strip fires a request on mount with an empty perturbation,
 * so "any request has arrived" is satisfied before the debounced slider
 * request lands.
 */
async function waitForBody(
  calls: Array<Record<string, number>>,
  predicate: (body: Record<string, number>) => boolean,
) {
  await expect
    .poll(() => calls.filter(predicate).length, { timeout: 10_000 })
    .toBeGreaterThan(0);
  const matching = calls.filter(predicate);
  return matching[matching.length - 1];
}

test.describe('What-if strip', () => {
  test('renders a labelled slider per feature, and only when features exist', async ({ page }) => {
    installSimulator(page, () => ({ riskScore: 0.5, p10: 0.4, p50: 0.5, p90: 0.6 }));
    const inspector = await openInspector(page, 'wo-1425');

    const strip = inspector.locator('#pbn-whatif-heading');
    await expect(strip).toBeVisible();

    for (const label of [
      'Jobs already booked for this day',
      'Days of notice',
      'How involved the job is',
      "Technician's skill match",
      "Technician's experience",
    ]) {
      await expect(inspector.getByLabel(label, { exact: true })).toBeVisible();
    }

    // A completed job the model did not score gets no sliders at all.
    const completed = await openInspector(page, 'wo-1428');
    await expect(completed.locator('#pbn-whatif-heading')).toHaveCount(0);
  });

  test('opens with the job’s own range, not an empty panel', async ({ page }) => {
    installSimulator(page, () => ({ riskScore: 0.71, p10: 0.62, p50: 0.71, p90: 0.8 }));
    const inspector = await openInspector(page, 'wo-1425');

    await expect(inspector.locator('.pbn-range__value')).toContainText('62%');
    await expect(inspector.locator('.pbn-range__value')).toContainText('80%');
    await expect(inspector.locator('.pbn-range__reading')).toContainText('71%');
  });

  test('a slider sends a delta relative to the job’s own features', async ({ page }) => {
    const calls = installSimulator(page, (body) => ({
      riskScore: 0.84,
      p10: 0.78,
      p50: 0.84,
      p90: 0.89,
    }));
    const inspector = await openInspector(page, 'wo-1425');

    // wo-1425 starts at 4 jobs. Moving to 5 is a delta of +1, not an absolute 5.
    const density = inspector.getByLabel('Jobs already booked for this day', { exact: true });
    await density.fill('5');

    const last = await waitForBody(calls, (body) => 'schedule_density' in body);
    expect(last.schedule_density).toBe(1);

    await expect(inspector.locator('.pbn-range__reading')).toContainText('84%');
  });

  test('an untouched slider is omitted from the request', async ({ page }) => {
    const calls = installSimulator(page, () => ({ riskScore: 0.5, p10: 0.4, p50: 0.5, p90: 0.6 }));
    const inspector = await openInspector(page, 'wo-1425');

    await inspector.getByLabel('Days of notice', { exact: true }).fill('3');

    const last = await waitForBody(calls, (body) => 'lead_time_days' in body);
    expect(last.lead_time_days).toBe(2); // 3 days from a baseline of 1
    expect(last.schedule_density).toBeUndefined();
    expect(last.technician_skill_match).toBeUndefined();
  });

  test('an out-of-range result is greyed and flagged rather than hidden', async ({ page }) => {
    installSimulator(page, () => ({
      riskScore: 0.95,
      p10: 0.9,
      p50: 0.95,
      p90: 0.99,
      outOfRange: true,
    }));
    const inspector = await openInspector(page, 'wo-1425');

    const range = inspector.locator('.pbn-range');
    await expect(range).toHaveClass(/pbn-range--out-of-range/);
    await expect(range.getByText(/Outside validated range/)).toBeVisible();
    // The numbers are still there: greyed, not removed.
    await expect(range.locator('.pbn-range__value')).toContainText('90%');
  });

  test('Reset restores the job’s values and re-requests the baseline', async ({ page }) => {
    const calls = installSimulator(page, () => ({ riskScore: 0.71, p10: 0.62, p50: 0.71, p90: 0.8 }));
    const inspector = await openInspector(page, 'wo-1425');

    const density = inspector.getByLabel('Jobs already booked for this day', { exact: true });
    await density.fill('9');
    await expect(density).toHaveValue('9');

    // Let the slider's own request land so the count we record is stable.
    await waitForBody(calls, (body) => 'schedule_density' in body);
    const before = calls.length;

    await inspector.getByRole('button', { name: 'Reset to this job' }).click();

    await expect(density).toHaveValue('4');
    await expect.poll(() => calls.length, { timeout: 10_000 }).toBeGreaterThan(before);
    const last = calls[calls.length - 1];
    expect(last.schedule_density).toBeUndefined();
  });

  test('a failed simulation says so in plain language and keeps the sliders usable', async ({ page }) => {
    void page.route('**/api/v1/coordinator/work-orders/*/simulate', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
    );
    const inspector = await openInspector(page, 'wo-1425');

    await inspector.getByLabel('Days of notice', { exact: true }).fill('7');

    await expect(inspector.locator('.pbn-whatif__error')).toContainText(
      'We could not work out that scenario',
    );
    // The slider still works: an error does not disable the strip.
    await expect(inspector.getByLabel('Days of notice', { exact: true })).toBeEnabled();
  });

  test('every slider is reachable by keyboard', async ({ page }) => {
    installSimulator(page, () => ({ riskScore: 0.5, p10: 0.4, p50: 0.5, p90: 0.6 }));
    await page.goto(FIXTURES_URL);
    await page.locator('[data-work-order-id="wo-1425"]').click();

    const slider = page.getByLabel('Jobs already booked for this day', { exact: true });
    await slider.focus();
    await expect(slider).toBeFocused();

    // Arrow keys change the value, which is what makes a range input operable.
    const before = await slider.inputValue();
    await page.keyboard.press('ArrowUp');
    expect(await slider.inputValue()).not.toBe(before);
  });

  test('the strip produces no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    installSimulator(page, () => ({ riskScore: 0.5, p10: 0.4, p50: 0.5, p90: 0.6 }));
    await openInspector(page, 'wo-1425');
    await page.getByLabel('Days of notice', { exact: true }).fill('2');

    expect(errors).toEqual([]);
  });
});
