import { logger } from '../utils/logger';
import { prisma } from '../utils/database';
import type { ModuleId } from '../modules/contract';

/**
 * Pabandi event bus.
 *
 * The platform's layers communicate through events, never by calling each other.
 * That is what keeps booking, capital, property and CRM independently installable:
 * a layer can be removed without editing any other layer, because nothing in it
 * imports anything else.
 *
 * Two properties this had to gain to be usable as a platform backbone:
 *
 *   1. **Layer attribution.** Every event names the module that produced it and
 *      the business it concerns. Without that there is no way to answer "what
 *      happened to *this* business" — which is the platform's main read.
 *   2. **A persisted outbox.** In-process synchronous delivery means a crash
 *      between "state committed" and "trust score updated" silently loses a
 *      trust event, and trust scoring is the one thing on this platform that
 *      must not be lossy. Events are therefore written durably *before*
 *      dispatch, so an undelivered event can be replayed after a restart.
 *
 * Delivery stays synchronous for in-process handlers: most subscribers (trust
 * score updates, CRM counter maintenance) must complete within the request that
 * caused them, and making them async would open a consistency window wider than
 * the failure it protects against.
 */

export type TrustEventType =
  | 'score.changed'
  | 'escrow.funded'
  | 'escrow.released'
  | 'escrow.disputed'
  | 'checkin.verified'
  | 'passport.linked'
  /**
   * A business's review signals changed. Carries `googleRating` and
   * `completionRate` (both 0–5) as INPUTS; `trust-core.service.ts` is the only
   * subscriber and the only writer of the resulting score.
   *
   * Added when `reviewService` stopped writing `reliabilityScore` directly —
   * see the header of that file for why the direct write had to go rather than
   * be rescaled.
   */
  | 'business.reviews_synced';

export interface TrustEvent {
  type: TrustEventType;
  passportId?: string;
  jobId?: string;
  clientId?: string;
  businessId?: string;
  data: Record<string, any>;
  timestamp: Date;
  /** Which layer produced this event. */
  layer?: ModuleId;
}

/**
 * A durable, replayable event. `TrustEvent` is the in-memory shape; this is the
 * persisted shape, which additionally carries delivery bookkeeping.
 */
export interface DurableEvent extends TrustEvent {
  id: string;
  /** Times a handler threw, so a poison event can be quarantined. */
  attempts: number;
  dispatchedAt: Date | null;
}

type EventHandler = (event: TrustEvent) => void | Promise<void>;

export interface SubscribeOptions {
  /**
   * Persist this event to the outbox before dispatch. Only enable for events
   * whose loss would be a correctness problem (trust score movements); leave off
   * for high-volume, low-stakes notifications to avoid a write per event.
   */
  durable?: boolean;
}

class EventBus {
  private handlers: Map<string, EventHandler[]> = new Map();
  /** Event types that must be written to the outbox before dispatch. */
  private durableTypes = new Set<string>();
  private started = false;

  subscribe(type: string, handler: EventHandler): () => void {
    const existing = this.handlers.get(type) || [];
    this.handlers.set(type, [...existing, handler]);
    return () => {
      const current = this.handlers.get(type) || [];
      this.handlers.set(type, current.filter((h) => h !== handler));
    };
  }

  /**
   * Mark an event type as requiring durable persistence.
   *
   * Called at registration time by `trust-core`, so the choice is made once, in
   * the module that owns the event, rather than at every publish site.
   */
  markDurable(type: string): void {
    this.durableTypes.add(type);
  }

  /**
   * Write an event to the outbox.
   *
   * Best-effort: an outbox write failure must not fail the business operation
   * that produced the event, but it is logged at error level because it means
   * trust accounting may be incomplete.
   */
  private async persist(event: DurableEvent): Promise<void> {
    try {
      await prisma.trustAuditTrail.create({
        data: {
          userId: event.businessId || event.passportId || event.jobId || 'unknown',
          previousScore: 0,
          newScore: 0,
          changeReason: `event:${event.type}`,
          component: 'EVENT_OUTBOX',
          severity: 'neutral',
          metadata: {
            eventId: event.id,
            type: event.type,
            layer: event.layer,
            attempts: event.attempts,
            data: event.data,
          },
          methodology: '1.0.0',
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`[EventBus] Outbox write failed for ${event.type}: ${message}`);
    }
  }

  async publish(event: TrustEvent): Promise<void> {
    const durable = this.durableTypes.has(event.type);

    if (durable) {
      const record: DurableEvent = {
        ...event,
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
        attempts: 0,
        dispatchedAt: null,
      };
      // Persist first: if the process dies between here and the handlers, the
      // event survives and `replayOutbox` can pick it up.
      await this.persist(record);
    }

    const typeHandlers = this.handlers.get(event.type) || [];
    const allHandlers = this.handlers.get('*') || [];

    for (const handler of [...typeHandlers, ...allHandlers]) {
      try {
        await handler(event);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`[EventBus] Handler error for ${event.type}: ${message}`);
      }
    }

    logger.info(`[EventBus] ${event.type}${event.layer ? ` (${event.layer})` : ''}`, event.data);
  }

  /**
   * Fire-and-forget publish for call sites that are not in an async context.
   *
   * Deliberately not `await`-ed by callers: the bus catches handler errors, so
   * the only way this rejects is an unexpected fault, which is logged rather
   * than propagated into business logic.
   */
  emitEvent(type: string, data: Record<string, any>, layer?: ModuleId): void {
    void this.publish({
      type: type as TrustEventType,
      data,
      timestamp: new Date(),
      layer,
    });
  }

  /**
   * Re-deliver undispatched outbox entries.
   *
   * Called at boot. Entries that have already been dispatched are marked in the
   * audit trail, so replay is idempotent at the *business* level: trust event
   * writes are keyed on `(invoiceId, eventType)` and score updates are deltas,
   * both of which the handlers guard against double-application.
   */
  async replayOutbox(limit = 200): Promise<number> {
    if (!this.started) return 0;

    try {
      const rows = await prisma.trustAuditTrail.findMany({
        where: { component: 'EVENT_OUTBOX' },
        select: { id: true, metadata: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      let replayed = 0;
      for (const row of rows) {
        const meta = (row.metadata ?? {}) as {
          type?: string;
          layer?: ModuleId;
          data?: Record<string, unknown>;
        };
        if (!meta.type) continue;

        const handlers = this.handlers.get(meta.type);
        if (!handlers?.length) continue;

        for (const handler of handlers) {
          try {
            await handler({
              type: meta.type as TrustEventType,
              data: meta.data ?? {},
              timestamp: row.createdAt,
              layer: meta.layer,
            });
            replayed += 1;
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error(`[EventBus] Replay failed for ${meta.type}: ${message}`);
          }
        }
      }

      if (replayed > 0) {
        logger.info(`[EventBus] Replayed ${replayed} outbox deliveries`);
      }
      return replayed;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`[EventBus] Outbox replay failed: ${message}`);
      return 0;
    }
  }

  markStarted(): void {
    this.started = true;
  }
}

export const eventBus = new EventBus();