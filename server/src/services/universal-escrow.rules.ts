/**
 * Universal escrow rules — pure, no database, no side effects.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `universal-escrow.service.ts#updateStatus` validated only that the target
 * string was one of the seven known statuses. Any state could therefore reach any
 * other state, and the two transitions that matter most were both open:
 *
 *   draft -> released      release an escrow that was never funded
 *   refunded -> released   release money that was already returned
 *
 * The first is not just sloppy bookkeeping. `updateStatus` emits
 * `escrow.released` on a release, and `trust-core.service.ts` turns that event
 * into a `score.changed` — a *positive* reputation signal. So the sequence
 * "create an escrow, immediately PATCH it to released" manufactured a trust
 * score improvement without any money ever moving, on an endpoint any party to
 * the escrow could call. A reputation score you can raise by pressing a button is
 * worth nothing to the person relying on it.
 *
 * `booking-escrow.rules.ts` already encoded a correct machine for the six-state
 * booking lifecycle. These rules mirror it and add `in_progress`, which is the one
 * extra state `UniversalEscrow` has. They are kept separate rather than merged
 * because the two escrows are different products with different states; sharing a
 * single list would mean one of them drifts into accepting transitions the other
 * forbids.
 */

export type UniversalEscrowStatus =
  | 'draft'
  | 'funded'
  | 'in_progress'
  | 'conditions_met'
  | 'released'
  | 'refunded'
  | 'disputed';

export const UNIVERSAL_ESCROW_STATUSES: UniversalEscrowStatus[] = [
  'draft',
  'funded',
  'in_progress',
  'conditions_met',
  'released',
  'refunded',
  'disputed',
];

/**
 * Legal transitions. Anything not listed here is refused.
 *
 * Mirrors booking-escrow.rules.ts, with these differences:
 *   - `in_progress` exists, between `funded` and `conditions_met`
 *   - `refunded` is terminal, same as booking
 *   - `released -> disputed` stays legal: a release the seller asserted without
 *     verified conditions is exactly the decision worth reviewing
 */
export const UNIVERSAL_ESCROW_TRANSITIONS: Record<UniversalEscrowStatus, UniversalEscrowStatus[]> = {
  draft: ['funded', 'refunded', 'disputed'],
  funded: ['in_progress', 'conditions_met', 'released', 'refunded', 'disputed'],
  in_progress: ['conditions_met', 'released', 'refunded', 'disputed'],
  conditions_met: ['released', 'refunded', 'disputed'],
  released: ['disputed'],
  refunded: [],
  disputed: ['released', 'refunded'],
};

export const UNIVERSAL_ESCROW_TERMINAL: UniversalEscrowStatus[] = ['released', 'refunded'];

export function isUniversalEscrowStatus(v: unknown): v is UniversalEscrowStatus {
  return typeof v === 'string' && (UNIVERSAL_ESCROW_STATUSES as string[]).includes(v);
}

export function canUniversalTransition(from: string, to: string): boolean {
  if (!isUniversalEscrowStatus(from) || !isUniversalEscrowStatus(to)) return false;
  return UNIVERSAL_ESCROW_TRANSITIONS[from].includes(to);
}

export function isUniversalTerminal(status: string): boolean {
  return isUniversalEscrowStatus(status) && UNIVERSAL_ESCROW_TERMINAL.includes(status);
}

/**
 * Human-readable reason a transition was refused, for an API error body.
 * An escrow refusal is something a calling agent can act on, so "Invalid status
 * transition" without the current state is not enough to debug.
 */
export function explainTransition(from: string, to: string): string {
  if (!isUniversalEscrowStatus(to)) return `Invalid status: ${to}`;
  if (!isUniversalEscrowStatus(from)) return `Unknown current status: ${from}`;
  if (isUniversalTerminal(from)) {
    return `Escrow is ${from} (terminal) and cannot move to ${to}. Raise a dispute instead.`;
  }
  const allowed = UNIVERSAL_ESCROW_TRANSITIONS[from];
  return `Cannot move escrow from ${from} to ${to}. Allowed from ${from}: ${allowed.length ? allowed.join(', ') : 'nothing'}.`;
}