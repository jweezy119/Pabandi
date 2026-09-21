import { EventEmitter } from 'events';

class EventBus extends EventEmitter {
  emitEvent(event: string, data: any) {
    this.emit(event, data);
    console.log(`[EventBus] ${event}`, data);
  }

  subscribe(event: string, handler: (data: any) => void) {
    this.on(event, handler);
  }
}

export const eventBus = new EventBus();

// Register default handlers
eventBus.subscribe('trust.score.changed', (data) => {
  console.log(`[TrustOS] Score changed for user ${data.userId}: ${data.newScore}`);
});

eventBus.subscribe('pipeline.deal.won', (data) => {
  console.log(`[PipelineOS] Deal won: ${data.dealId}`);
});

eventBus.subscribe('ledger.invoice.overdue', (data) => {
  console.log(`[LedgerOS] Invoice overdue: ${data.invoiceId}`);
});
