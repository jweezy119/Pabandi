import { OfframpIntent } from '@prisma/client';
export declare class ChannelDispatcher {
    /** Track pending reminder timeouts keyed by intentId so they can be cleared on server shutdown. */
    private reminderTimeouts;
    /** Clear all pending reminder timeouts (call on graceful shutdown). */
    shutdown(): void;
    dispatchNewIntent(intent: OfframpIntent): Promise<void>;
    init(): void;
}
export declare const channelDispatcher: ChannelDispatcher;
//# sourceMappingURL=channel-dispatcher.service.d.ts.map