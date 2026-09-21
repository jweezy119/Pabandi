import { logger } from '../utils/logger';

export type TrustEventType =
  | 'score.changed'
  | 'escrow.funded'
  | 'escrow.released'
  | 'escrow.disputed'
  | 'checkin.verified'
  | 'passport.linked';

export interface TrustEvent {
  type: TrustEventType;
  passportId?: string;
  jobId?: string;
  clientId?: string;
  businessId?: string;
  data: Record<string, any>;
  timestamp: Date;
}

type EventHandler = (event: TrustEvent) => void;

class EventBus {
  private handlers: Map<string, EventHandler[]> = new Map();

  subscribe(type: string, handler: EventHandler): () => void {
    const existing = this.handlers.get(type) || [];
    this.handlers.set(type, [...existing, handler]);
    return () => {
      const current = this.handlers.get(type) || [];
      this.handlers.set(type, current.filter(h => h !== handler));
    };
  }

  publish(event: TrustEvent): void {
    const typeHandlers = this.handlers.get(event.type) || [];
    const allHandlers = this.handlers.get('*') || [];
    [...typeHandlers, ...allHandlers].forEach(handler => {
      try { handler(event); } 
      catch (err: any) { logger.error(`[EventBus] Handler error: ${err.message}`); }
    });
    logger.info(`[EventBus] ${event.type}`, event.data);
  }

  emitEvent(type: string, data: Record<string, any>): void {
    this.publish({ type: type as TrustEventType, data, timestamp: new Date() });
  }
}

export const eventBus = new EventBus();
