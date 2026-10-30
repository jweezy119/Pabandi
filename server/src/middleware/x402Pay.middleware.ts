import { Request, Response, NextFunction } from 'express';
import {
  verifyX402Payment,
  verifyX402PaymentV2,
  createX402PaymentRequirement,
  buildPaymentRequired,
  encodePaymentRequired,
  parseX402PaymentHeaderRaw,
} from '../services/x402.service';
import { declareDiscoveryExtension } from '@x402/extensions';

export interface X402PayOptions {
  /** Price in USDC, or a function that computes it from the request body. */
  amount: number | ((req: Request) => number);
  /** x402 resource identifier (the route path). */
  resource: string;
  /** Human-readable description for the payment requirement. */
  description?: string;
  /** Optional Bazaar discovery declaration override. */
  bazaar?: Record<string, unknown>;
  /** If true, skip payment when facilitator is unreachable (dev only). */
  allowUnverified?: boolean;
}

function resolveAmount(options: X402PayOptions, req: Request): number {
  if (typeof options.amount === 'function') {
    return options.amount(req);
  }
  return options.amount;
}

export function x402Pay(options: X402PayOptions) {
  const { resource, description = 'Pabandi API call', bazaar, allowUnverified = false } = options;

  const BAZAAR = declareDiscoveryExtension({
    bodyType: 'json',
    input: {
      amount: 0.01,
      description,
      route: resource,
      idempotencyKey: 'inv-0001',
    },
    output: {
      example: {
        success: true,
        data: {
          method: 'x402',
          settled: true,
          amount: 0.01,
          transactionHash: '5nHJSmv2m8Znrkm4tVwqfTqbVQUydjyFvX8mLFdvENq1',
          recipientId: 'platform',
          description,
        },
      },
    },
  });

  const BAZAAR_RAW = {
    bazaar: {
      ...bazaar?.bazaar ?? BAZAAR.bazaar,
      info: {
        ...BAZAAR.bazaar.info,
        input: {
          ...BAZAAR.bazaar.info.input,
          method: 'POST',
        },
      },
    },
  };

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const amount = resolveAmount(options, req);
    const paymentHeader = req.headers['x-payment'];
    const paymentSignature = req.headers['payment-signature'];

    // ── No payment yet: serve 402 ──
    if (!paymentSignature && (typeof paymentHeader !== 'string' || paymentHeader.length === 0)) {
      return res.status(402)
        .header('Payment-Required', encodePaymentRequired(buildPaymentRequired({
          resource,
          amountUsdc: amount,
          extensions: BAZAAR_RAW,
        })))
        .json({
          ...createX402PaymentRequirement(resource, amount),
          hint: 'Include a valid x-payment or payment-signature header to unlock this endpoint.',
          pricing: { amountUsdc: amount },
          extensions: BAZAAR_RAW,
        });
    }

    // ── Verify x402 v2 spec payment ──
    if (typeof paymentSignature === 'string' && paymentSignature.length > 0) {
      const parsedV2 = parseX402PaymentHeaderRaw(paymentSignature);
      if (parsedV2.v2) {
        const result = await verifyX402PaymentV2({
          paymentPayload: parsedV2.v2,
          resource,
          amountUsdc: amount,
        });
        if (!result.valid && !allowUnverified) {
          return res.status(402).json({
            success: false,
            error: 'PAYMENT_NOT_VERIFIED',
            message: result.reason ?? 'Payment could not be verified',
            extensions: BAZAAR_RAW,
          });
        }
        req.x402Payment = { method: 'x402-v2', settled: true, amount, transactionHash: result.transactionHash };
        return next();
      }
      return res.status(402).json({
        success: false,
        error: 'PAYMENT_NOT_VERIFIED',
        message: 'Malformed PAYMENT-SIGNATURE header',
        extensions: BAZAAR_RAW,
      });
    }

    // ── Verify legacy x-payment header ──
    const legacyHeader = typeof paymentHeader === 'string' ? paymentHeader : Array.isArray(paymentHeader) ? paymentHeader[0] : undefined;
    const result = await verifyX402Payment({
      paymentHeader: legacyHeader,
      resource,
      amount,
    });
    if (!result.valid && !allowUnverified) {
      return res.status(402).json({
        success: false,
        error: 'PAYMENT_NOT_VERIFIED',
        message: result.reason ?? 'Payment could not be verified',
        extensions: BAZAAR_RAW,
      });
    }
    req.x402Payment = { method: 'x402', settled: true, amount, transactionHash: result.transactionHash };
    next();
  };
}

declare global {
  namespace Express {
    interface Request {
      x402Payment?: { method: string; settled: boolean; amount: number; transactionHash?: string | null };
    }
  }
}
