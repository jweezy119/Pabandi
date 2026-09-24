export type SigningProvider = 'DOCUSIGN' | 'HELLOSIGN' | 'PANDADOC' | 'CUSTOM';
export type CreateSigningRequestInput = {
    provider: SigningProvider;
    documentTitle: string;
    documentHtml?: string;
    documentUrl?: string;
    signerEmail: string;
    signerName: string;
    redirectUrl?: string;
    metadata?: Record<string, any>;
};
export type SigningProviderResponse = {
    externalId: string;
    signingUrl: string;
    status: string;
};
export declare const signingService: {
    createRequest(input: CreateSigningRequestInput): Promise<SigningProviderResponse>;
    createDocuSignRequest(_input: CreateSigningRequestInput): Promise<SigningProviderResponse>;
    createHelloSignRequest(_input: CreateSigningRequestInput): Promise<SigningProviderResponse>;
    createPandaDocRequest(_input: CreateSigningRequestInput): Promise<SigningProviderResponse>;
    createCustomRequest(input: CreateSigningRequestInput): Promise<SigningProviderResponse>;
};
//# sourceMappingURL=signing.service.d.ts.map