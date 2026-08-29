import { OfframpIntent } from '@prisma/client';
export declare class ChannelDispatcher {
    dispatchNewIntent(intent: OfframpIntent): Promise<void>;
    init(): void;
}
export declare const channelDispatcher: ChannelDispatcher;
//# sourceMappingURL=channel-dispatcher.service.d.ts.map