import { expect, test } from '@playwright/test';

/**
 * Phase 1 acceptance: the shell is keyboard-operable end to end.
 *
 * Focus order is asserted by stable `data-pbn-focus-id` hooks rather than by
 * DOM position, so the test breaks when the order changes — which is the
 * point — but not when an unrelated element is inserted.
 *
 * Why a real browser and not jsdom: jsdom does not implement tab traversal,
 * so "press Tab and see where focus lands" is not expressible there at all.
 * Focus rings are computed style, which jsdom does not compute either.
 */

/** Expanded rail: every filter is followed by its own "?" help trigger. */
const EXPANDED_ORDER = [
  'topbar-help',
  'rail-new',
  'rail-filter-dispatch',
  'rail-filter-dispatch-help',
  'rail-filter-review',
  'rail-filter-review-help',
  'rail-filter-radar',
  'rail-filter-radar-help',
  'rail-filter-team',
  'rail-filter-team-help',
  'rail-collapse',
  'stream-new',
  'stream-connect',
];

/** Collapsed rail: icon-only, so the "?" triggers are removed from the DOM. */
const COLLAPSED_ORDER = [
  'topbar-help',
  'rail-new',
  'rail-filter-dispatch',
  'rail-filter-review',
  'rail-filter-radar',
  'rail-filter-team',
  'rail-collapse',
  'stream-new',
  'stream-connect',
];

interface FocusSnapshot {
  id: string | null;
  outlineStyle: string;
  outlineWidth: string;
  outlineColor: string;
}

async function snapshotFocus(page: import('@playwright/test').Page): Promise<FocusSnapshot> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) {
      return { id: null, outlineStyle: '', outlineWidth: '', outlineColor: '' };
    }
    const style = getComputedStyle(el);
    return {
      id: el.getAttribute('data-pbn-focus-id'),
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      outlineColor: style.outlineColor,
    };
  });
}

async function collectTabOrder(page: import('@playwright/test').Page, length: number) {
  const visited: FocusSnapshot[] = [];
  for (let step = 0; step < length; step++) {
    await page.keyboard.press('Tab');
    visited.push(await snapshotFocus(page));
  }
  return visited;
}

test.describe('Service Coordinator shell', () => {
  test('tabs through every control in order, each with a visible focus ring', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(error.message));

    await page.goto('/coordinator-shell.html');

    const visited = await collectTabOrder(page, EXPANDED_ORDER.length);

    expect(visited.map((snapshot) => snapshot.id)).toEqual(EXPANDED_ORDER);

    // §1: focus rings visible at all times. A ring that is `none`, or thinner
    // than the 2px token, fails here even though the element is focusable.
    for (const snapshot of visited) {
      expect(snapshot.outlineStyle, `${snapshot.id} outline-style`).not.toBe('none');
      expect(parseFloat(snapshot.outlineWidth), `${snapshot.id} outline-width`).toBeGreaterThanOrEqual(2);
    }

    // Nothing else in the document may be focusable. Chrome does not wrap Tab
    // past the last control — it drops focus to <body> — so the meaningful
    // assertion is the set of focusable elements, not a wrap-around.
    const focusableIds = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      )
        .filter((element) => element.getClientRects().length > 0)
        .map((element) => element.getAttribute('data-pbn-focus-id')),
    );
    expect(focusableIds).toEqual(EXPANDED_ORDER);

    expect(consoleErrors).toEqual([]);
  });

  test('the disabled command bar is skipped by the keyboard', async ({ page }) => {
    await page.goto('/coordinator-shell.html');

    const input = page.locator('.pbn-commandbar__input');
    await expect(input).toBeDisabled();
    await expect(page.locator('.pbn-pill').first()).toBeDisabled();

    // A disabled control is not focusable, so the walkable set must be
    // exactly the expanded order — no command-bar stop appears in it.
    const focusableIds = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      )
        .filter((element) => element.getClientRects().length > 0)
        .map((element) => element.getAttribute('data-pbn-focus-id')),
    );
    expect(focusableIds).toEqual(EXPANDED_ORDER);

    // And the walk itself confirms the same sequence twice running.
    const visited = await collectTabOrder(page, EXPANDED_ORDER.length);
    expect(visited.map((snapshot) => snapshot.id)).toEqual(EXPANDED_ORDER);
  });

  test('collapsing the rail removes the help triggers from the tab order and persists', async ({ page }) => {
    await page.goto('/coordinator-shell.html');

    await page.locator('[data-pbn-focus-id="rail-collapse"]').click();

    await expect(page.locator('.pbn-rail')).toHaveClass(/pbn-rail--collapsed/);
    await expect(page.locator('.pbn-rail__label').first()).toBeHidden();
    await expect(
      page.locator('[data-pbn-focus-id="rail-filter-dispatch-help"]'),
    ).toHaveCount(0);

    // The choice survives a reload — a coordinator who collapsed it once should
    // not be asked again on every visit.
    const stored = await page.evaluate(() =>
      window.localStorage.getItem('pbn:coordinator:rail-collapsed'),
    );
    expect(stored).toBe('true');

    await page.reload();
    await expect(page.locator('.pbn-rail')).toHaveClass(/pbn-rail--collapsed/);

    const visited = await collectTabOrder(page, COLLAPSED_ORDER.length);
    expect(visited.map((snapshot) => snapshot.id)).toEqual(COLLAPSED_ORDER);
  });

  test('the "?" shortcut opens the cheat sheet and Escape closes it', async ({ page }) => {
    await page.goto('/coordinator-shell.html');

    await page.keyboard.press('?');

    const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    await expect(dialog).toBeVisible();
    // Focus must move into the dialog, otherwise the modal is not modal.
    await expect(page.locator('[data-pbn-focus-id="dialog-close"]')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('[data-pbn-focus-id="topbar-help"]')).toBeFocused();
  });

  test('rail labels are never truncated', async ({ page }) => {
    await page.goto('/coordinator-shell.html');

    // "Waiting for your review" is the phrase §4.1 requires. A label that
    // ellipsises to "Waiting for your ..." hides the point of the filter from
    // the exact user who needs to read it, so wrapping is the fix, not a
    // shorter label.
    const truncated = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('.pbn-rail__label'))
        .filter((element) => element.scrollWidth > element.clientWidth + 1)
        .map((element) => element.textContent ?? ''),
    );

    expect(truncated).toEqual([]);
  });

  test('every icon-only control has an accessible name', async ({ page }) => {
    await page.goto('/coordinator-shell.html');

    // §1: no icon-only button without an accessible name. A button whose only
    // text sits inside an `aria-hidden` decoration is icon-only in practice,
    // so that text does not count as a name.
    const unnamed = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button'))
        .filter((button) => {
          if ((button.getAttribute('aria-label') ?? '').trim()) return false;
          const text = (button.textContent ?? '').trim();
          const decorative = Array.from(button.querySelectorAll('[aria-hidden="true"]'))
            .map((child) => (child.textContent ?? '').trim())
            .join('');
          return text.length === 0 || text === decorative;
        })
        .map((button) => button.className),
    );

    expect(unnamed).toEqual([]);
  });
});
