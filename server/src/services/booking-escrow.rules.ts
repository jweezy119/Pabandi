/**
 * Booking escrow rules — pure, no database, no side effects.
 *
 * These live apart from `booking-escrow.service.ts` so they can be imported and
 * asserted directly. The service is the thing that touches Prisma, and importing
 * it from a test drags the client in with it, which then fails to construct
 * outside a live environment. That failure is a nuisance at best and, worse, it
 * pushes people toward re-declaring the rules inside the test — where they
 * assert nothing.
 *
 * The rules here are the ones that decide who keeps a deposit, so they are the
 * part most worth being able to read in one place and check.
 */

export type EscrowStatus =
  | 'draft'
  | 'funded'
  | 'conditions_met'
  | 'released'
  | 'refunded'
  | 'disputed';

/** Matches the convention already used for invoices (`invoice:<id>`). */
export function bookingEscrowReference(bookingId: string): string {
  return `booking:${bookingId}`;
}

/**
 * Legal transitions. Anything not listed is refused.
 *
 * `disputed` is reachable from every non-terminal state and can be resolved to
 * either terminal outcome. That asymmetry is deliberate: disputing early is
 * legitimate, but you cannot dispute something already settled — except from
 * `released`, which stays contestable because a release the business asserted
 * without a verified check-in is exactly the decision worth reviewing.
 */
export const ESCROW_TRANSITIONS: Record<EscrowStatus, EscrowStatus[]> = {
  draft: ['funded', 'refunded', 'disputed'],
  funded: ['conditions_met', 'released', 'refunded', 'disputed'],
  conditions_met: ['released', 'refunded', 'disputed'],
  released: ['disputed'],
  refunded: [],
  disputed: ['released', 'refunded'],
};

export const TERMINAL_STATUSES: EscrowStatus[] = ['released', 'refunded'];

export function canTransition(from: EscrowStatus, to: EscrowStatus): boolean {
  return ESCROW_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminal(status: EscrowStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}