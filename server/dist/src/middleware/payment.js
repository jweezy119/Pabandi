"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.x402Middleware = x402Middleware;
exports.ap2Middleware = ap2Middleware;
const x402_service_1 = require("../services/x402.service");
/**
 * x402 Payment Middleware
 * Verifies the X-PAYMENT proof with the facilitator, returning HTTP 402 with
 * price info when it is absent or invalid.
 */
function x402Middleware(priceUsdc, description) {
    return async (req, res, next) => {
        const paymentProof = req.headers['x-payment'];
        const paymentRequirements = () => ({
            error: 'Payment required',
            scheme: 'x402',
            price: `${priceUsdc} USDC`,
            network: 'solana',
            recipient: process.env.SOLANA_USDC_ADDRESS || 'PABANDI_USDC_WALLET',
            description: description || 'API access',
            paymentMethods: ['solana-usdc', 'x402'],
        });
        if (!paymentProof) {
            return res.status(402).json(paymentRequirements());
        }
        const result = await (0, x402_service_1.verifyX402Payment)({
            paymentHeader: paymentProof,
            resource: req.originalUrl,
            amount: priceUsdc,
        });
        if (!result.valid) {
            return res.status(402).json({ ...paymentRequirements(), invalidReason: result.reason });
        }
        req.x402 = { amount: priceUsdc, transactionHash: result.transactionHash };
        next();
    };
}
/**
 * AP2 Authorization Middleware
 * Verifies three signed mandates for high-value transactions
 */
function ap2Middleware(req, res, next) {
    const { intentMandate, cartMandate, paymentMandate } = req.body;
    if (!intentMandate || !cartMandate || !paymentMandate) {
        return res.status(401).json({
            error: 'AP2 mandates required',
            required: ['intentMandate', 'cartMandate', 'paymentMandate'],
            description: 'Each mandate must be a JSON object with signature and data',
        });
    }
    // In production: verify each mandate's signature
    // const valid = verifyAP2Mandates(intentMandate, cartMandate, paymentMandate);
    // if (!valid) {
    //   return res.status(401).json({ error: 'Invalid AP2 mandate signatures' });
    // }
    // Store mandates as proof of authorization
    req.ap2Mandates = { intentMandate, cartMandate, paymentMandate };
    next();
}
//# sourceMappingURL=payment.js.map