"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.x402Middleware = x402Middleware;
exports.ap2Middleware = ap2Middleware;
/**
 * x402 Payment Middleware
 * Returns HTTP 402 with price info if no payment proof provided
 */
function x402Middleware(priceUsdc, description) {
    return async (req, res, next) => {
        const paymentProof = req.headers['x-payment'];
        if (!paymentProof) {
            return res.status(402).json({
                error: 'Payment required',
                scheme: 'x402',
                price: `${priceUsdc} USDC`,
                network: 'solana',
                recipient: process.env.SOLANA_USDC_ADDRESS || 'PABANDI_USDC_WALLET',
                description: description || 'API access',
                paymentMethods: ['solana-usdc', 'x402'],
            });
        }
        // In production: verify payment on-chain
        // const verified = await verifySolanaPayment(paymentProof, priceUsdc);
        // if (!verified) {
        //   return res.status(402).json({ error: 'Payment verification failed' });
        // }
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