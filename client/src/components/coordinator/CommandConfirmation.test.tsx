import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CommandConfirmation from './CommandConfirmation';
import type { ExecutionPlan } from './useCoordinatorCommands';

/**
 * §4.6, asserted rather than assumed: the dialog says in one sentence what will
 * happen, the confirm button carries a verb, Cancel is neutral, and a
 * destructive action colours its confirm button — not the whole dialog.
 */
const basePlan: ExecutionPlan = {
  kind: 'assign',
  title: 'Assign this job?',
  consequence:
    'This will assign Chase Bank – Elk Grove Pavilion to Marcus Reed and send Marcus Reed the details on WhatsApp.',
  confirmLabel: 'Assign and send',
  destructive: false,
  when: null,
  raw: 'assign 1425 to Marcus',
};

function renderPlan(plan: ExecutionPlan) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const view = render(
    <CommandConfirmation plan={plan} onConfirm={onConfirm} onCancel={onCancel} />,
  );
  return { onConfirm, onCancel, ...view };
}

describe('CommandConfirmation', () => {
  it('states the consequence in plain language', () => {
    renderPlan(basePlan);
    expect(
      screen.getByText(/This will assign Chase Bank – Elk Grove Pavilion to Marcus Reed/),
    ).toBeTruthy();
  });

  it('uses a verb on the confirm button and a neutral Cancel', () => {
    renderPlan(basePlan);

    expect(screen.getByRole('button', { name: 'Assign and send' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    // Never "OK" — a button that does not say what it does is a guess.
    expect(screen.queryByRole('button', { name: 'OK' })).toBeNull();
  });

  it('labels the dialog so a screen reader announces what is being confirmed', () => {
    renderPlan(basePlan);
    expect(screen.getByRole('dialog', { name: 'Assign this job?' })).toBeTruthy();
  });

  it('colours only the confirm button when the action is destructive', () => {
    const { container } = renderPlan({ ...basePlan, destructive: true });

    const confirm = screen.getByRole('button', { name: 'Assign and send' });
    expect(confirm.className).toContain('pbn-btn--danger');

    // The panel itself stays neutral: colour on the whole dialog would read as
    // "everything here is dangerous", not "this button is".
    const panel = container.querySelector('.pbn-dialog__panel');
    expect(panel?.className).not.toContain('pbn-dialog--danger');
  });

  it('keeps a non-destructive confirm button on the accent fill', () => {
    renderPlan(basePlan);
    const confirm = screen.getByRole('button', { name: 'Assign and send' });
    expect(confirm.className).toContain('pbn-btn--primary');
    expect(confirm.className).not.toContain('pbn-btn--danger');
  });

  it('reports a cancel without confirming', () => {
    const { onConfirm, onCancel } = renderPlan(basePlan);

    (screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).click();

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('moves focus into the dialog on open', () => {
    renderPlan(basePlan);
    // The cancel button is focused so a keyboard user is not dropped at the top
    // of the document with a modal in the way.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
  });
});
