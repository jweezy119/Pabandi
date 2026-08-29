export interface TrustSignals {
    isDisposableEmail: boolean;
    isVoiceOrSmsNumber: boolean;
    riskDelta: number;
    reason: string;
}
export declare class TrustSignalService {
    private readonly disposableDomains;
    evaluateSignals({ email, phone, deviceFingerprint, ip, }: {
        email?: string | null;
        phone?: string | null;
        deviceFingerprint?: string | null;
        ip?: string | null;
    }): Promise<TrustSignals>;
    private checkBreachExposure;
    private detectCarrier;
    private checkIpRisk;
}
export declare const trustSignalService: TrustSignalService;
//# sourceMappingURL=trustSignal.service.d.ts.map