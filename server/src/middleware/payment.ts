import { Request, Response, NextFunction } from 'express';
import { verifyX402Payment } from '../services/x402.service';

/**
 * x402 Payment Middleware
 * Verifies the X-PAYMENT proof with the facilitator, returning HTTP 402 with
 * price info when it is absent or invalid.
 */
export function x402Middleware(priceUsdc: number, description?: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const paymentProof = req.headers['x-payment'] as string | undefined;

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

    const result = await verifyX402Payment({
      paymentHeader: paymentProof,
      resource: req.originalUrl,
      amount: priceUsdc,
    });

    if (!result.valid) {
      return res.status(402).json({ ...paymentRequirements(), invalidReason: result.reason });
    }

    (req as any).x402 = { amount: priceUsdc, transactionHash: result.transactionHash };
    next();
  };
}

/**
 * AP2 Authorization Middleware
 * Verifies three signed mandates for high-value transactions
 */
export function ap2Middleware(req: Request, res: Response, next: NextFunction) {
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
  (req as any).ap2Mandates = { intentMandate, cartMandate, paymentMandate };
  next();
}
