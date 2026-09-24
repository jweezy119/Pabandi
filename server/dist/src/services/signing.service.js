"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signingService = void 0;
const logger_1 = require("../utils/logger");
exports.signingService = {
    async createRequest(input) {
        switch (input.provider) {
            case 'DOCUSIGN':
                return exports.signingService.createDocuSignRequest(input);
            case 'HELLOSIGN':
                return exports.signingService.createHelloSignRequest(input);
            case 'PANDADOC':
                return exports.signingService.createPandaDocRequest(input);
            default:
                return exports.signingService.createCustomRequest(input);
        }
    },
    async createDocuSignRequest(_input) {
        const accessToken = process.env.DOCUSIGN_ACCESS_TOKEN;
        const accountId = process.env.DOCUSIGN_ACCOUNT_ID;
        const baseUrl = process.env.DOCUSIGN_BASE_URL || 'https://demo.docusign.net/restapi';
        if (!accessToken || !accountId) {
            logger_1.logger.warn('[signing] DocuSign not configured, falling back to custom');
            return exports.signingService.createCustomRequest(_input);
        }
        try {
            const envelopeDefinition = {
                emailSubject: `Please sign: ${_input.documentTitle}`,
                documents: _input.documentHtml ? [
                    {
                        documentBase64: Buffer.from(_input.documentHtml).toString('base64'),
                        name: _input.documentTitle,
                        fileExtension: 'html',
                        documentId: '1',
                    },
                ] : [],
                recipients: {
                    signers: [
                        {
                            email: _input.signerEmail,
                            name: _input.signerName,
                            recipientId: '1',
                            routingOrder: '1',
                        },
                    ],
                },
                status: 'sent',
            };
            const res = await fetch(`${baseUrl}/v2.1/accounts/${accountId}/envelopes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify(envelopeDefinition),
            });
            if (!res.ok) {
                const text = await res.text();
                logger_1.logger.error('[signing] DocuSign create envelope failed', res.status, text);
                return exports.signingService.createCustomRequest(_input);
            }
            const data = await res.json();
            return {
                externalId: String(data.envelopeId || ''),
                signingUrl: `${baseUrl}/v2.1/accounts/${accountId}/envelopes/${data.envelopeId}/views/recipient`,
                status: 'SENT',
            };
        }
        catch (e) {
            logger_1.logger.error('[signing] DocuSign error', e);
            return exports.signingService.createCustomRequest(_input);
        }
    },
    async createHelloSignRequest(_input) {
        const apiKey = process.env.HELLOSIGN_API_KEY;
        if (!apiKey) {
            logger_1.logger.warn('[signing] HelloSign not configured, falling back to custom');
            return exports.signingService.createCustomRequest(_input);
        }
        try {
            const res = await fetch('https://api.hellosign.com/v3/signature_request/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    title: _input.documentTitle,
                    subject: `Please sign: ${_input.documentTitle}`,
                    message: 'Please review and sign this document.',
                    signers: [{ email_address: _input.signerEmail, name: _input.signerName }],
                    ...(_input.documentHtml ? { file_urls: [_input.documentUrl] } : {}),
                }),
            });
            if (!res.ok) {
                const text = await res.text();
                logger_1.logger.error('[signing] HelloSign failed', res.status, text);
                return exports.signingService.createCustomRequest(_input);
            }
            const data = await res.json();
            return {
                externalId: String(data.signature_request?.signature_request_id || ''),
                signingUrl: data.signature_request?.signing_url?.[0] || _input.redirectUrl || '',
                status: 'SENT',
            };
        }
        catch (e) {
            logger_1.logger.error('[signing] HelloSign error', e);
            return exports.signingService.createCustomRequest(_input);
        }
    },
    async createPandaDocRequest(_input) {
        const apiKey = process.env.PANDADOC_API_KEY;
        if (!apiKey) {
            logger_1.logger.warn('[signing] PandaDoc not configured, falling back to custom');
            return exports.signingService.createCustomRequest(_input);
        }
        try {
            const res = await fetch('https://api.pandadoc.com/public/v1/documents', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    name: _input.documentTitle,
                    recipients: [{ email: _input.signerEmail, first_name: _input.signerName.split(' ')[0], last_name: _input.signerName.split(' ').slice(1).join(' ') || '' }],
                    status: 'document.draft',
                }),
            });
            if (!res.ok) {
                const text = await res.text();
                logger_1.logger.error('[signing] PandaDoc failed', res.status, text);
                return exports.signingService.createCustomRequest(_input);
            }
            const data = await res.json();
            return {
                externalId: String(data.id || ''),
                signingUrl: data.url || _input.redirectUrl || '',
                status: 'SENT',
            };
        }
        catch (e) {
            logger_1.logger.error('[signing] PandaDoc error', e);
            return exports.signingService.createCustomRequest(_input);
        }
    },
    async createCustomRequest(input) {
        const callbackToken = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const API_BASE = (process.env.API_URL || process.env.FRONTEND_URL || 'http://localhost:5000/api/v1').replace(/\/$/, '');
        const signingUrl = `${API_BASE}/property/sign/${callbackToken}`;
        return {
            externalId: `custom-${callbackToken}`,
            signingUrl,
            status: 'SENT',
        };
    },
};
//# sourceMappingURL=signing.service.js.map