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
export interface AgentPassportRequest extends Request {
    agentPassport?: any;
}
/**
 * Build a passport guard for a required capability.
 * @param need  capability string the agent must hold (e.g. 'act:book', 'act:transfer')
 */
export declare const requirePassport: (need: string) => (req: AgentPassportRequest, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
//# sourceMappingURL=requirePassport.middleware.d.ts.map