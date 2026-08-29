"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ptp_spec_1 = require("../protocol/ptp.spec");
const router = (0, express_1.Router)();
/**
 * GET /.well-known/ptp.json
 * Protocol discovery document for Pabandi Trust Protocol (PTP).
 * Allows third parties to dynamically discover PTP endpoints and capabilities.
 */
router.get('/ptp.json', (req, res) => {
    // Construct the base URL from the request
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const baseUrl = `${protocol}://${host}`;
    const discoveryDoc = ptp_spec_1.ptpEngine.getDiscoveryDocument(baseUrl);
    res.setHeader('Content-Type', 'application/json');
    res.json(discoveryDoc);
});
/**
 * GET /.well-known/ptp-key.pem
 * Public key for offline verification of PTP Attestations.
 */
router.get('/ptp-key.pem', (_req, res) => {
    const pem = ptp_spec_1.ptpEngine.getPublicKeyPEM();
    res.setHeader('Content-Type', 'application/x-pem-file');
    res.send(pem);
});
exports.default = router;
//# sourceMappingURL=wellknown.routes.js.map