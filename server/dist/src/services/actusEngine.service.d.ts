export type ActusEventType = 'INITIAL_EXCHANGE' | 'PAYMENT' | 'FEE' | 'REDEMPTION';
export interface ActusCashflow {
    eventType: ActusEventType;
    date: string;
    amount: number;
    currency: string;
    payer: string;
    payee: string;
    status: 'SCHEDULED' | 'SETTLED' | 'DEFAULTED';
}
export interface ActusContract {
    contractId: string;
    tenantId: string;
    landlordId: string;
    principalUSD: number;
    apyPct: number;
    termMonths: number;
    startDate: string;
    schedule: ActusCashflow[];
    anchor: any;
    createdAt: string;
}
export declare class ActusEngine {
    /**
     * Build an ACTUS cashflow schedule for a tokenized rent stream.
     * INITIAL_EXCHANGE (rent in), 11 PAYMENTs (yield distributions, 50/50 split),
     * FEE (platform spread), REDEMPTION (principal back at term end).
     */
    createContract(input: {
        tenantId: string;
        landlordId: string;
        principalUSD: number;
        apyPct?: number;
        termMonths?: number;
        startDate?: string;
    }): Promise<ActusContract>;
    /** Net present value sanity check (regulators like to see the instrument is solvent). */
    npv(contract: ActusContract, annualDiscount?: number): number;
}
export declare const actusEngine: ActusEngine;
//# sourceMappingURL=actusEngine.service.d.ts.map