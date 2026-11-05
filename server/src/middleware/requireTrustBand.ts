import { Request, Response, NextFunction } from 'express';
import { verifyOidcToken, IamTokenClaims, TrustBand } from '../utils/iamKeys';
import { validateDPoPProof } from '../utils/dpop';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

export interface IamAuthRequest extends Request {
  iamAuth?: IamTokenClaims;
}

const BAND_RANK: Record<TrustBand, number> = {
  A: 5,
  B: 4,
  C: 3,
  D: 2,
  E: 1,
};

export interface TrustBandOptions {
  minBand?: TrustBand;
  maxSpendCentsWithoutHitl?: number;
}

/**
 * Middleware: requireTrustBand
 * Parses OIDC JWT token, enforces minimum trust band, and applies Human-In-The-Loop gates for high-risk bands.
 * Fails closed (403 Forbidden) on any validation failure.
 */
export function requireTrustBand(
  minBand: TrustBand = 'C',
  options: TrustBandOptions = {}
) {
  const maxSpendWithoutHitl = options.maxSpendCentsWithoutHitl ?? 10000; // $100 default

  return async (req: IamAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        res.status(403).json({
          success: false,
          error: 'MISSING_AUTHORIZATION',
          message: 'Authorization header with Bearer or DPoP token is required',
        });
        return;
      }

      let token = '';
      let isDPoPTokenType = false;

      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7).trim();
      } else if (authHeader.startsWith('DPoP ')) {
        token = authHeader.slice(5).trim();
        isDPoPTokenType = true;
      } else {
        res.status(403).json({
          success: false,
          error: 'INVALID_AUTH_SCHEME',
          message: 'Authorization header must use Bearer or DPoP scheme',
        });
        return;
      }

      if (!token) {
        res.status(403).json({
          success: false,
          error: 'EMPTY_TOKEN',
          message: 'Token cannot be empty',
        });
        return;
      }

      // Verify signature, issuer, and expiration
      let claims: IamTokenClaims;
      try {
        claims = verifyOidcToken(token);
      } catch (tokenErr: unknown) {
        const msg = tokenErr instanceof Error ? tokenErr.message : 'Invalid token';
        res.status(403).json({
          success: false,
          error: 'INVALID_OR_EXPIRED_TOKEN',
          message: `Token verification failed: ${msg}`,
        });
        return;
      }

      // Check if token was revoked in database
      const revokedCheck = await prisma.oAuthToken.findFirst({
        where: { accessToken: token, revoked: true },
      });
      if (revokedCheck) {
        res.status(403).json({
          success: false,
          error: 'TOKEN_REVOKED',
          message: 'This access token has been revoked',
        });
        return;
      }

      // If token is DPoP-bound (contains 'jkt'), verify the DPoP proof header
      if (claims.jkt) {
        const dpopHeader = req.headers['dpop'] as string | undefined;
        const targetUrl = `${req.protocol}://${req.get('host')}${req.originalUrl || req.url}`;
        const dpopResult = validateDPoPProof(dpopHeader, req.method, targetUrl, claims.jkt);

        if (!dpopResult.valid) {
          res.status(403).json({
            success: false,
            error: 'INVALID_DPOP_PROOF',
            message: `Valid DPoP proof matching the token key thumbprint is required: ${dpopResult.error || 'verification failed'}`,
          });
          return;
        }
      }

      // Enforce Minimum Trust Band
      const callerRank = BAND_RANK[claims.trust_band] ?? 1;
      const requiredRank = BAND_RANK[minBand] ?? 3;

      if (callerRank < requiredRank) {
        res.status(403).json({
          success: false,
          error: 'INSUFFICIENT_TRUST_BAND',
          message: `Access denied. Requires Trust Band ${minBand} or higher. Current band is ${claims.trust_band} (Score: ${claims.trust_score}).`,
          requiredBand: minBand,
          currentBand: claims.trust_band,
          trustScore: claims.trust_score,
        });
        return;
      }

      // Enforce Human-In-The-Loop for Band C, D, E when transaction exceeds limit
      const isHighRiskBand = ['C', 'D', 'E'].includes(claims.trust_band);
      if (isHighRiskBand) {
        const requestSpendCents =
          Number(req.body?.amountCents) ||
          (req.body?.amount ? Number(req.body.amount) * 100 : 0) ||
          (req.body?.depositAmount ? Number(req.body.depositAmount) * 100 : 0);

        if (requestSpendCents > maxSpendWithoutHitl) {
          const hitlApproved =
            req.headers['x-human-in-the-loop'] === 'approved' ||
            req.body?.hitlApproved === true;

          if (!hitlApproved) {
            res.status(403).json({
              success: false,
              error: 'HITL_REQUIRED',
              message: `Human-in-the-loop confirmation required for Trust Band ${claims.trust_band} on transactions over $${maxSpendWithoutHitl / 100}. Please pass 'x-human-in-the-loop: approved' or obtain human consent.`,
              maxSpendCentsWithoutHitl: maxSpendWithoutHitl,
              requestedSpendCents: requestSpendCents,
            });
            return;
          }
        }
      }

      // Enforce Agent Delegation Spending Limits
      if (claims.principal_type === 'agent' && claims.delegation_max_spend_cents > 0) {
        const requestSpendCents =
          Number(req.body?.amountCents) ||
          (req.body?.amount ? Number(req.body.amount) * 100 : 0);

        if (requestSpendCents > claims.delegation_max_spend_cents) {
          res.status(403).json({
            success: false,
            error: 'DELEGATION_LIMIT_EXCEEDED',
            message: `Agent execution exceeds delegated spend limit of $${claims.delegation_max_spend_cents / 100}. Requested: $${requestSpendCents / 100}.`,
            maxSpendCents: claims.delegation_max_spend_cents,
            requestedCents: requestSpendCents,
          });
          return;
        }
      }

      // Attach claims to request
      req.iamAuth = claims;
      next();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown IAM error';
      logger.error('[requireTrustBand] Unexpected error: ' + message);
      res.status(403).json({
        success: false,
        error: 'AUTH_FORBIDDEN',
        message: 'Security validation failed',
      });
    }
  };
}
