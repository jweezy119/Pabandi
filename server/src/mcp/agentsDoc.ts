/**
 * agentsDoc.ts — the /.well-known/agents.json document, built in one place.
 *
 * WHY
 * ---
 * This document existed twice with different contents. `wellknown.routes.ts`
 * built it per-request (deriving base_url from the request host, which is right),
 * and a checked-in `.well-known/agents.json` sat in the repo holding
 * `https://api.pabandi.com` — a host that does not resolve in DNS — and listing
 * `crm.pipeline` where the server lists `crm.contact`.
 *
 * Nothing served the static copy, which is exactly why it rotted unnoticed: a
 * stale document that no test reads and no process ships. It was still a trap,
 * because it is the file a developer opens to learn what the platform supports.
 *
 * The risk bands below are published here deliberately. `riskBand` had four
 * incompatible definitions across the codebase — PTP's A-E on a 0-100 scale,
 * the deposit policy's A-D on 0-1000, a stray "F" in the (now-removed) worker
 * stub, and two column values nothing ever wrote. An agent choosing a
 * counterparty needs ONE list to ask about. This publishes PTP's, which is the
 * canonical one and the same engine that signs the attestations agents verify.
 */

import { PTP_RISK_BANDS, type PTPRiskBand } from '../protocol/ptp.spec';

/**
 * Kept in the order an agent would use them: establish trust, then transact.
 * Adding a capability here without a route behind it advertises a promise that
 * 404s, so this list is meant to move only with verify-agent-surface.
 */
export const AGENT_CAPABILITIES: string[] = [
  'booking.create',
  'booking.status',
  'freight.quote',
  'property.list',
  'property.verify',
  'crm.lead',
  'crm.contact',
  'ledger.invoice',
  'ledger.cashflow',
  'escrow.initiate',
  'escrow.release',
  'trust.verify',
  'trust.score',
  'passport.issue',
  'passport.verify',
];

/** The canonical risk bands, straight from the signing engine. */
export const AGENT_RISK_BANDS: PTPRiskBand[] = Object.keys(PTP_RISK_BANDS) as PTPRiskBand[];

/**
 * Build the document. `baseUrl` is passed in rather than read from an env var so
 * the HTTP route can derive it from the live request host and the manifest
 * generator can pin it to the configured public API URL.
 */
export function buildAgentsDoc(baseUrl: string) {
  const base = baseUrl.replace(/\/+$/, '');
  return {
    name: 'PabandiOS',
    version: '1.0.0',
    description:
      'The trust operating system for service businesses — bookings, freight, property, CRM, and finance with AI-powered reliability scoring and Solana escrow.',
    base_url: base,
    mcp_endpoint: `${base}/mcp`,
    openapi_spec: `${base}/openapi.yaml`,
    capabilities: AGENT_CAPABILITIES,
    risk_bands: AGENT_RISK_BANDS,
    risk_band_source: 'PTP (Pabandi Trust Protocol) — the same bands used to sign attestations',
    payment: {
      schemes: ['x402', 'solana-usdc'],
      network: 'solana',
      currency: 'USDC',
    },
    authorization: {
      schemes: ['ap2', 'bearer', 'ptp'],
      mandates: ['intent', 'cart', 'payment'],
    },
    contact: 'agents@pabandi.com',
    license: 'MIT',
  };
}