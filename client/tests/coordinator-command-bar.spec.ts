import { expect, test } from '@playwright/test';

/**
 * Phase 3 acceptance: the command bar.
 *
 * The three requirements this suite exists to pin:
 *  (a) ambiguity is never resolved silently — a strip asks;
 *  (b) Undo calls the server and removes the assignment, it is not a dismissal;
 *  (c) an unrecognised command becomes a search with no error message.
 *
 * The harness renders the real shell with fixtures; the assign/unassign
 * endpoints are intercepted so the request the UI makes can be asserted
 * directly rather than inferred from a changed label.
 */

const FIXTURES_URL = '/coordinator-shell.html?fixtures=work-orders';

interface CapturedRequest {
  method: string;
  url: string;
  body: string;
}

function installApiInterceptor(page: import('@playwright/test').Page) {
  const calls: CapturedRequest[] = [];

  void page.route('**/api/v1/coordinator/**', async (route) => {
    const request = route.request();
    const url = request.url();
    const method = request.method();

    calls.push({ method, url, body: request.postData() ?? '' });

    if (method === 'POST' && url.includes('/unassign')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { remainingAssignments: 0 } }),
      });
      return;
    }

    if (method === 'POST' && url.includes('/assign')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { assignment: {} } }),
      });
      return;
    }

    if (method === 'PATCH') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: {} }),
      });
      return;
    }

    await route.continue();
  });

  return calls;
}

async function runCommand(page: import('@playwright/test').Page, command: string) {
  const input = page.locator('.pbn-commandbar__input');
  await input.focus();
  await input.fill(command);
  await page.keyboard.press('Enter');
}

test.describe('Command bar', () => {
  test('(a) two people named Marcus produces a disambiguation strip, not a pick', async ({ page }) => {
    await page.goto(FIXTURES_URL);

    await runCommand(page, 'assign 1425 to Marcus');

    const strip = page.locator('.pbn-strip--question');
    await expect(strip).toBeVisible();
    await expect(strip).toContainText('We found 2 people matching');
    // Scoped to the strip: the work-order card also names Marcus Reed.
    await expect(strip.getByRole('button', { name: 'Marcus Reed', exact: true })).toBeVisible();
    await expect(strip.getByRole('button', { name: 'Marcus Chen', exact: true })).toBeVisible();

    // No confirmation dialog appears until the user has chosen.
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('choosing an option opens the confirmation dialog with the right defaults', async ({ page }) => {
    await page.goto(FIXTURES_URL);

    await runCommand(page, 'assign 1425 to Marcus');
    await page
      .locator('.pbn-strip--question')
      .getByRole('button', { name: 'Marcus Reed', exact: true })
      .click();

    const dialog = page.getByRole('dialog', { name: 'Assign this job?' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Chase Bank – Elk Grove Pavilion');
    await expect(dialog).toContainText('Marcus Reed');
    // §4.6: the confirm button is a verb, and Cancel is neutral.
    await expect(dialog.getByRole('button', { name: 'Assign and send' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
  });

  test('a unique technician skips the strip and goes straight to confirmation', async ({ page }) => {
    await page.goto(FIXTURES_URL);

    await runCommand(page, 'assign 1425 to Dana');

    await expect(page.locator('.pbn-strip--question')).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Assign this job?' })).toBeVisible();
  });

  test('(b) Undo calls the server and removes the assignment', async ({ page }) => {
    const calls = installApiInterceptor(page);
    await page.goto(FIXTURES_URL);

    await runCommand(page, 'assign 1425 to Dana');
    await page.getByRole('button', { name: 'Assign and send' }).click();

    const strip = page.locator('.pbn-strip--done');
    await expect(strip).toContainText('Assigned WO1425 to Dana Whitfield.');
    await expect(strip.getByRole('button', { name: 'Undo' })).toBeVisible();

    // The assignment really was made on the server before Undo was offered.
    expect(calls.some((call) => call.method === 'POST' && call.url.includes('/assign'))).toBe(true);

    await strip.getByRole('button', { name: 'Undo' }).click();

    // And Undo really removes it — a dismissed strip would leave this call missing.
    const unassign = calls.find((call) => call.method === 'POST' && call.url.includes('/unassign'));
    expect(unassign).toBeDefined();
    expect(unassign!.body).toContain('tech-003');
    await expect(page.getByText('Assignment removed.')).toBeVisible();
  });

  test('a filter command narrows the stream and can be undone', async ({ page }) => {
    await page.goto(FIXTURES_URL);

    await runCommand(page, 'show high-risk leaks');

    await expect(page.locator('[data-work-order-id]')).toHaveCount(1);
    await expect(page.locator('[data-work-order-id="wo-1425"]')).toBeVisible();
    await expect(page.locator('.pbn-strip--done')).toContainText('high risk');

    await page.locator('.pbn-strip--done').getByRole('button', { name: 'Undo filter' }).click();
    await expect(page.locator('[data-work-order-id]')).toHaveCount(4);
  });

  test('(c) an unrecognised command falls back to search with no error', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto(FIXTURES_URL);

    await runCommand(page, 'how many jobs are on today?');

    const strip = page.locator('.pbn-strip--search');
    await expect(strip).toBeVisible();
    await expect(strip).toContainText('how many jobs are on today?');
    // The fallback teaches the grammar rather than reporting a failure.
    await expect(strip).toContainText('If you meant a command, try one of these');
    await expect(strip.getByRole('button', { name: /assign 1425 Chase to Marcus/ })).toBeVisible();

    // No error toast, no error role, no console error.
    await expect(page.locator('[role="alert"]')).toHaveCount(0);
    expect(consoleErrors).toEqual([]);

    await strip.getByRole('button', { name: 'Clear results' }).click();
    await expect(page.locator('[data-work-order-id]')).toHaveCount(4);
  });

  test('a command naming something that does not exist says so in plain language', async ({ page }) => {
    await page.goto(FIXTURES_URL);

    await runCommand(page, 'assign 1425 to Nobody');

    const strip = page.locator('.pbn-strip--message');
    await expect(strip).toContainText('We could not find a technician named “Nobody”');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('"/" and ⌘K focus the command bar (§4.8)', async ({ page }) => {
    await page.goto(FIXTURES_URL);

    await page.locator('body').click();
    await page.keyboard.press('/');
    await expect(page.locator('.pbn-commandbar__input')).toBeFocused();

    await page.locator('body').click();
    await page.keyboard.press('Control+K');
    await expect(page.locator('.pbn-commandbar__input')).toBeFocused();
  });

  test('the placeholder rotates while idle and pauses while the field has text', async ({ page }) => {
    await page.goto(FIXTURES_URL);

    const input = page.locator('.pbn-commandbar__input');
    const first = await input.getAttribute('placeholder');

    await page.waitForTimeout(5600);
    const rotated = await input.getAttribute('placeholder');
    expect(rotated).not.toBe(first);

    await input.fill('assign 1425 to Dana');
    const typed = await input.getAttribute('placeholder');
    await page.waitForTimeout(5600);
    expect(await input.getAttribute('placeholder')).toBe(typed);
  });
});
