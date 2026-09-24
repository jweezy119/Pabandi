declare class OdooService {
    private url;
    private db;
    private username;
    private apiKey;
    private uid;
    constructor();
    private isConfigured;
    private authenticate;
    private executeKw;
    syncNewBusiness(data: {
        firstName: string;
        lastName: string;
        email: string;
        phone?: string;
        businessName: string;
    }): Promise<void>;
}
export declare const odooService: OdooService;
export {};
//# sourceMappingURL=odoo.service.d.ts.map