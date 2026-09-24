export type TrustAuditEntryInput = {
    userId: string;
    previousScore: number;
    newScore: number;
    changeReason: string;
    component: string;
    severity: 'positive' | 'neutral' | 'negative';
    weightUsed?: number | null;
    metadata?: any;
    methodology?: string;
};
export declare class TrustAuditWriter {
    private buffer;
    private maxBuffer;
    private interval;
    private isFlushing;
    constructor();
    private startInterval;
    enqueue(entry: TrustAuditEntryInput): Promise<void>;
    flush(): Promise<void>;
    stop(): void;
}
export declare const trustAuditWriter: TrustAuditWriter;
//# sourceMappingURL=trustAuditWriter.d.ts.map