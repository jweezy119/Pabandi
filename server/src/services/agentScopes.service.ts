import { AgentToolUser } from './agentTools.service';

export const TOOL_SCOPES: Record<string, string[]> = {
  pabandi_list_businesses: ['directory'],
  pabandi_get_business: ['directory'],
  pabandi_create_booking: ['booking'],
  pabandi_get_booking: ['booking'],
  pabandi_mark_checkin: ['booking'],
  pabandi_release_escrow: ['booking'],
  pabandi_refund_booking: ['booking'],
  pabandi_verify_passport: ['trust'],
  pabandi_screen_wallet: ['trust'],
  pabandi_request_payout: ['payout'],
  pabandi_get_payout_history: ['payout'],
  pabandi_get_paid_proof: ['proof'],
  pabandi_get_my_paid_proofs: ['proof'],
  pabandi_get_identity: ['identity'],
};

export function userHasScope(user: AgentToolUser | undefined, toolName: string): boolean {
  if (!user) return false;
  if (!user.agentKeyId) return true;
  const scopes = user.scopes ?? [];
  if (scopes.includes('*')) return true;
  const required = TOOL_SCOPES[toolName] ?? [];
  if (required.length === 0) return true;
  return required.some((scope) => scopes.includes(scope));
}

export function requireScopes(...required: string[]) {
  return (req: any, res: any, next: any) => {
    const user = req.user as AgentToolUser | undefined;
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }
    if (!user.agentKeyId) return next();

    const scopes = user.scopes ?? [];
    if (scopes.includes('*') || required.some((scope) => scopes.includes(scope))) {
      return next();
    }
    res.status(403).json({
      success: false,
      error: `Agent key missing scope: ${required.join(' or ')}`,
    });
  };
}
