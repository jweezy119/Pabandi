/**
 * requirePassport.middleware.ts — enforces the Agent Capability Passport standard
 * on actions that AI agents perform (bookings, value transfers, $PAB metering).
 *
 * Design (foolproof + non-breaking):
 *  - The guard ONLY applies when the caller identifies as an agent by sending an
 *    `X-Agent-Passport: <base64 attestation>` header. Human users never send it,
 *    so their authenticated flows are completely unaffected.
 *  - If an agent header is present, the passport is verified (signature, expiry,
 *    revocation, risk band) AND the requested `need` capability must be granted.
 *  - The verified attestation is attached to `req.agentPassport` so downstream
 *    handlers / audit logs can attribute the action to the agent.
 *  - No header -> next() (human path). This keeps human bookings working.
 *
 * This is the "make the standard enforced end-to-end" piece: an AI agent cannot
 * book or transfer on Pabandi unless it presents a valid, capability-scoped passport.
 */
import { Request, Response, NextFunction } from 'express';
import { ptpEngine } from '../protocol/ptp.spec';
import { logger } from '../utils/logger';

export interface AgentPassportRequest extends Request {
  agentPassport?: any; // verified PTPAgentAttestation
}

/**
 * Build a passport guard for a required capability.
 * @param need  capability string the agent must hold (e.g. 'act:book', 'act:transfer')
 */
export const requirePassport = (need: string) => {
  return (req: AgentPassportRequest, res: Response, next: NextFunction) => {
    const token = req.header('X-Agent-Passport');

    // Human path: no agent header -> proceed untouched.
    if (!token) return next();

    // Agent path: must present a valid, capability-scoped passport.
    let att: any;
    try {
      att = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
    } catch {
      return res.status(401).json({ success: false, error: 'X-Agent-Passport is not valid base64 JSON' });
    }

    const result = ptpEngine.verifyAgentPassport(att, need);
    if (!result.valid) {
      logger.warn(`[requirePassport] denied agent ${att?.subject?.id || '?'} for '${need}': ${result.error}`);
      return res.status(403).json({
        success: false,
        error: `Agent passport required for '${need}': ${result.error || 'invalid'}`,
        agentId: att?.subject?.id || null,
      });
    }

    req.agentPassport = att;
    next();
  };
};
