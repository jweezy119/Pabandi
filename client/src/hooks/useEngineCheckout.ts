import { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  engineService,
  type ActionRequired,
  type EngineActionError,
  type EngineSession,
} from '../services/api';

/**
 * The client half of the Pabandi Engine.
 *
 * ─── WHAT MOVED OUT OF THE COMPONENTS ───────────────────────────────────────
 * Before this, checkout decided three things on the client that the engine
 * now decides on the server:
 *
 *   - whether a Trust Score was high enough to waive a deposit
 *   - what the deposit should be
 *   - whether the booking could proceed at all
 *
 * All three were client-side arithmetic over a score the client had been sent.
 * A client can be edited, and a deposit rule enforced in a browser is a
 * suggestion. `actionRequired` from the engine replaces all of it with one
 * field the client reads and obeys.
 *
 * ─── SESSION LIFECYCLE ──────────────────────────────────────────────────────
 * A session is opened lazily on the first action and then reused. Reopening
 * per action would defeat the entire mechanism: the point is one authorisation
 * covering many actions, and a tab opened per call is a signature per call with
 * extra steps.
 *
 * A session that comes back closed, exhausted or expired is dropped from the
 * ref so the next attempt opens a fresh one, rather than retrying against a
 * dead tab forever.
 */

export interface UseEngineCheckoutResult {
  /**
   * Run an action through the engine, opening a session if needed.
   * Resolves to the action's outcome, or null if it failed (a toast has
   * already been shown in that case).
   */
  runAction: (input: {
    actionType: 'booking' | 'invoice_pay' | 'escrow';
    amount: number;
    payload?: Record<string, unknown>;
    ownerType: 'user' | 'agent';
    ownerId: string;
  }) => Promise<{ actionRequired: ActionRequired; receiptId: string } | null>;

  /** Close the open session, if any. Safe to call when none was opened. */
  closeSession: () => Promise<void>;

  /** The open session, for display. Null until the first action. */
  session: EngineSession | null;
  submitting: boolean;
}

/**
 * Stable key for one logical action, so a double-click or a retry of the same
 * booking cannot spend the balance twice. The server treats a repeated key as
 * a replay and returns the original receipt.
 */
function idempotencyKeyFor(parts: unknown[]): string {
  // `payload` is Record<string, unknown>, so its values arrive as `unknown`.
  // Stringifying here rather than casting means a non-serialisable value
  // produces a different key rather than an "undefined" segment that would
  // collide with every other booking missing the same field.
  return parts
    .filter((p) => p !== null && p !== undefined)
    .map((p) => String(p))
    .join(':');
}

export function useEngineCheckout(): UseEngineCheckoutResult {
  const sessionRef = useRef<EngineSession | null>(null);
  const [session, setSession] = useState<EngineSession | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const openSession = useCallback(async (ownerType: 'user' | 'agent', ownerId: string) => {
    const existing = sessionRef.current;

    // Reuse only if it is genuinely still open. `expiresAt` is checked here
    // as well as on the server because a session that expired between actions
    // would otherwise cost the user a failed round trip and an error toast.
    if (existing && existing.status === 'active' && new Date(existing.expiresAt).getTime() > Date.now()) {
      return existing;
    }

    const response = await engineService.openSession({ ownerType, ownerId });
    const opened = response.data.data;
    sessionRef.current = opened;
    setSession(opened);
    return opened;
  }, []);

  const runAction = useCallback(
    async (input: {
      actionType: 'booking' | 'invoice_pay' | 'escrow';
      amount: number;
      payload?: Record<string, unknown>;
      ownerType: 'user' | 'agent';
      ownerId: string;
    }) => {
      setSubmitting(true);
      try {
        const open = await openSession(input.ownerType, input.ownerId);

        const response = await engineService.executeAction({
          sessionId: open.sessionId,
          actionType: input.actionType,
          amount: input.amount,
          payload: input.payload ?? {},
          // Keyed on the action's own identity, so the same booking retried
          // replays and a different booking never collides with it.
          idempotencyKey: idempotencyKeyFor([
            input.actionType,
            open.sessionId,
            input.payload?.businessId,
            input.payload?.serviceId,
            input.payload?.invoiceId,
            input.payload?.date,
            input.payload?.time,
          ]),
        });

        const result = response.data.data;

        // Keep the local balance in step with the server's, so a second action
        // in the same checkout shows the right remaining figure.
        sessionRef.current = { ...open, spent: result.session.spent, remaining: result.session.remaining };
        setSession(sessionRef.current);

        return { actionRequired: result.actionRequired, receiptId: result.receipt.id };
      } catch (error: unknown) {
        const err = error as { response?: { status?: number; data?: EngineActionError } };

        // 402/410/409 all mean the tab is finished. Forget it so the next
        // attempt opens a new one instead of retrying a dead tab.
        const status = err.response?.status;
        if (status === 402 || status === 410 || status === 409) {
          sessionRef.current = null;
          setSession(null);
        }

        const code = err.response?.data?.error ?? 'UNKNOWN';
        toast.error(failureMessage(code, err.response?.data));

        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [openSession]
  );

  const closeSession = useCallback(async () => {
    const open = sessionRef.current;
    if (!open) return;

    try {
      await engineService.closeSession({ sessionId: open.sessionId });
    } catch (error: unknown) {
      // A tab that cannot be closed cleanly will expire on its own, so this
      // is not worth a toast. Logged for diagnosis only.
      console.warn('[engine] failed to close session', error);
    } finally {
      sessionRef.current = null;
      setSession(null);
    }
  }, []);

  return { runAction, closeSession, session, submitting };
}

/**
 * Turn an engine failure code into something worth showing a user.
 *
 * Every one of these is actionable by the user except UNKNOWN, and a message
 * that does not tell someone what to do next is not worth displaying.
 */
function failureMessage(code: string, data?: EngineActionError): string {
  switch (code) {
    case 'LIMIT_EXCEEDED':
      return 'Your session limit is used up. Opening a new one to continue.';
    case 'SESSION_EXPIRED':
      return 'Your session expired. Opening a new one to continue.';
    case 'SESSION_NOT_ACTIVE':
      return 'That session is closed. Opening a new one to continue.';
    case 'SESSION_NOT_FOUND':
      return 'Your session could not be found. Opening a new one to continue.';
    case 'INVALID_AMOUNT':
      return 'That amount is not valid.';
    case 'VALIDATION_ERROR':
      return data?.message ?? 'The request was not valid.';
    default:
      return 'Something went wrong. Please try again.';
  }
}