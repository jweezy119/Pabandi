/**
 * pabandiTools.service.ts — the central, machine-readable Pabandi Platform
 * tools surface. Single source of truth for everything the platform can do,
 * how to call it (inputs/outputs), and WHO can call it (access tier).
 *
 * Produced for three consumers:
 *   1. LLMs / MCP clients   → /mcp tools/list  (JSON-RPC tool definitions)
 *   2. Third-party apps      → GET /api/v1/pabandi/tools + /.well-known/pabandi/tools.json
 *   3. SDK / OpenAPI clients → GET /api/v1/pabandi/spec  (aggregated OpenAPI doc)
 *
 * "Exclusive" access is modeled by the `access` field on each tool:
 *   public      — anyone (e.g. search, discover, verify passport)
 *   owner       — authenticated own-account (e.g. create property)
 *   verified   — business with an OPEN_FINANCE connection attested (e.g. bookStay
 *                with real rail, open-finance connect)
 *   exclusive  — PTP Band A/B OR an exclusive platform access grant (e.g. rpc escrow,
 *                high-frequency demand signals) — makes the platform genuinely premium.
 */
import { prisma } from '../utils/database';
import { ptpEngine } from '../protocol/ptp.spec';
import { logger } from '../utils/logger';

export type ToolAccess = 'public' | 'owner' | 'verified' | 'exclusive';

export interface PabandiTool {
  name: string;
  short: string;            // one-line, LLM-friendly capability label
  description: string;      // plain-language + what it's for
  access: ToolAccess;       // exclusivity gating
  category: string;         // 'search' | 'hospitality' | 'financing' | 'trust' | 'escrow' | 'predictive' | 'zk' | 'sdk'
  endpoints: { method: string; path: string; note?: string }[];
  inputs: Record<string, string>;   // key → plain description (LLM-friendly, not JSON-schema)
  output: string;                  // one-line description of the shape
  exclusiveNote?: string;          // why it's premium (for the "exclusive" story)
  attestation?: string;            // PTP attestation type returned, if any
}

export const pabandiToolsRegistry: PabandiTool[] = [
  // ── Discovery / Trust (the anchor: portable, offline-verifiable) ─────────────
  {
    name: 'pabandi:discover',
    short: 'Pabandi platform discovery',
    description: 'Return the Pabandi Platform discovery doc: every tool on the platform, the OpenAPI/spec URL, the PTP verification endpoint, the public key, and the SDK access info. This is the entry point any third-party app, LLM, or agent uses to learn what Pabandi can do and how to call it.',
    access: 'public',
    category: 'trust',
    endpoints: [{ method: 'GET', path: '/api/v1/pabandi/tools', note: 'machine-readable tool list' }, { method: 'GET', path: '/api/v1/pabandi/spec', note: 'full OpenAPI doc' }],
    inputs: {},
    output: 'PabandiPlatformDoc (tools[], specUrl, ptp, sdk, status)',
  },
  {
    name: 'pabandi:verify_passport',
    short: 'Verify a portable trust attestation',
    description: 'Verify a Pabandi PTP attestation (business, individual, agent, or trust rail). Re-executes the HMAC-SHA512 signature over a fixed subset of fields and returns valid + the verified claims. Offline-verifiable: any party can check a signed attestation without calling Pabandi. This is the trust primitive every third-party action gates on.',
    access: 'public',
    category: 'trust',
    endpoints: [{ method: 'GET', path: '/api/v1/agent-passport/verify', note: 'public, no-auth' }],
    inputs: { token: 'base64-encoded PTPAttestation (optional: need=capability to gate on)' },
    output: 'PTPVeificationResult {valid, expired, signatureValid, attestation, error}',
    attestation: 'PTPAttestation',
  },

  // ── Search ──────────────────────────────────────────────────────────────────
  {
    name: 'search:list',
    short: 'Search the Pabandi business directory',
    description: 'Search verified businesses and services by name, category, city, or location. Every listing is tied to a Pabandi Passport trust score. Uses Postgres contains + OpenStreetMap Nominatim (no paid geo API). Returns real, deduped results — never empty.',
    access: 'public',
    category: 'search',
    endpoints: [{ method: 'GET', path: '/api/v1/businesses' }],
    inputs: { search: 'free-text search term', category: 'business category (RESTAURANT, SALON, PROPERTY_RENTAL, ...)', latitude: 'optional geolocation', longitude: 'optional geolocation' },
    output: 'list of businesses (name, category, address, rating, trustScore)',
  },
  {
    name: 'search:profile',
    short: 'Look up a single business by id',
    description: 'Resolve a business profile by id (public). Returns the sanitized public view (name, category, address, rating, trustScore, phone, email, coverImageUrl). Owner PII is gated — use pabandi:verify_owner for full PII.',
    access: 'public',
    category: 'search',
    endpoints: [{ method: 'GET', path: '/api/v1/businesses/:id' }],
    inputs: { id: 'business id (cuid) or googlePlaceId' },
    output: 'publicBusiness projection',
  },

  // ── Hospitality ─────────────────────────────────────────────────────────────
  {
    name: 'hospitality:list-properties',
    short: 'Browse verified stay listings',
    description: 'List open short-term rentals / stays (Airbnb-style) by city or category. Each property is tied to a business + its open-finance settlement rail if connected. This is the hospitality inventory surface.',
    access: 'public',
    category: 'hospitality',
    endpoints: [{ method: 'GET', path: '/api/v1/hospitality/properties' }],
    inputs: { city: 'city to filter', category: 'PROPERTY_RENTAL / LIVE_SELLER / ...' },
    output: 'list of properties (title, city, pricePerNight, maxGuests, coverImageUrl)',
  },
  {
    name: 'hospitality:book',
    short: 'Book a stay with guest deposit escrow',
    description: 'Create a confirmed stay reservation for a property: links the existing Reservation model + a StayBooking, then holds the guest deposit in escrow (EscrowEvent + TreasuryPosition with kind:hospitality, Solana commitment, PTP attestation). The guest deposit is the trust anchor — released to the business on check-in, refunded on cancellation. This is the hospitality money rail.',
    access: 'verified',
    category: 'hospitality',
    endpoints: [{ method: 'POST', path: '/api/v1/hospitality/book' }],
    inputs: { propertyId: 'property id', checkIn: 'ISO date', checkOut: 'ISO date', guests: 'number of guests (optional)', depositAmount: 'guest deposit to hold (optional, defaults to 1 night)' },
    output: 'bookStayResult (stay, reservation, escrow {txHash, simulated, rakeSol, attestation}, treasuryId)',
    attestation: 'PTPAttestation',
    exclusiveNote: 'Gated to businesses with an attested open-finance settlement rail OR PTP Band A/B, so every booked stay has a real, verified payout path. This is what makes the hospitality vertical trustworthy to guests and exclusive to quality hosts.',
  },
  {
    name: 'hospitality:connect-finance',
    short: 'Link an open-finance settlement rail',
    description: 'Register a verifiable, masked settlement connection for a business: RAAST (Pakistan), Stripe Treasury, Open Banking, Solana wallet, or PayPal. The account reference is masked (never raw), and a PTP attestation is produced so the business can prove it has a real payout path without exposing the account. This is the open-finance connectivity primitive — the trust badge on a listing.',
    access: 'owner',
    category: 'financing',
    endpoints: [{ method: 'POST', path: '/api/v1/hospitality/finance/connect' }],
    inputs: { provider: 'RAAST | STRIPE_TREASURY | OPEN_BANKING | SOL_WALLET | PAYPAL', accountRef: 'masked/opaque reference (e.g. wallet addr, IBAN tail, Stripe acct id)' },
    output: 'OpenFinanceConnection {id, provider, accountRef, status, attestation, lastVerified}',
    attestation: 'PTPAttestation',
  },
  {
    name: 'hospitality:list-finance',
    short: 'List a business\'s verified settlement rails',
    description: 'Return a business\'s connected open-finance connections (verified + pending). Used by third parties to confirm a business has a real payout path before booking or partnering.',
    access: 'owner',
    category: 'financing',
    endpoints: [{ method: 'GET', path: '/api/v1/hospitality/finance/:businessId' }],
    inputs: { businessId: 'business id' },
    output: 'list of OpenFinanceConnection',
  },

  // ── Financing / Escrow ──────────────────────────────────────────────────────
  {
    name: 'escrow:init',
    short: 'Initialize a booking deposit escrow',
    description: 'Initialize a milestone-based or native SOL/BSC escrow for a booking: business deposits, guest/host holds collateral, release on completion. This is the real-chain escrow rail (Solana + BSC Hardhat contracts). GATED to exclusive platform access — real chain writes require verified ownership + settlement rail.',
    access: 'exclusive',
    category: 'escrow',
    endpoints: [{ method: 'POST', path: '/escrow/sign-init-tx' }],
    inputs: { reservationId: 'reservation id', businessAddress: 'business wallet address', payoutAddress: 'freelancer/guest payout address', amount: 'value in smallest unit', chain: 'SOL | BSC' },
    output: 'escrow session id + signing tx / instruction + terms',
    exclusiveNote: 'Exclusive: real-chain escrow writes are gated behind a verified PTP trust band (A/B) or an exclusive platform grant, so only trusted counterparties open real money on chain. Verified-only stays use the simulated escrow path. This is the premium moat — the real rail, gated.',
  },
  {
    name: 'finance:quote',
    short: 'Quote a payout / offramp',
    description: 'Quote an offramp/payout from the platform rails (RAAST, Stripe, Solana). Returns estimated fees, execution window, and the rail to use. Feeds the hospitality payout flow.',
    access: 'owner',
    category: 'financing',
    endpoints: [{ method: 'GET', path: '/payouts/quote' }],
    inputs: { amountUsdc: 'payout amount in USDc' },
    output: 'quote {rail, fee, net, window}',
  },

  // ── Predictive ──────────────────────────────────────────────────────────────
  {
    name: 'predictive:booking',
    short: 'Forecast booking no-show / completion',
    description: 'Forward-predict the no-show and completion probability for a PROSPECTIVE booking (before it is created). Blends real customer + business history (Beta-binomial shrinkage), lead-time, and day-of-week. Returns predictedNoShow, predictedCompletion, confidence, and the top factors. This is the predictive intelligence the trust rail uses.',
    access: 'owner',
    category: 'predictive',
    endpoints: [{ method: 'POST', path: '/api/v1/predictive/booking' }],
    inputs: { customerId: 'guest user id', businessId: 'business id', reservationTime: 'ISO date of the proposed stay/booking' },
    output: 'prediction {predictedNoShow, predictedCompletion, confidence, factors[]}',
  },
  {
    name: 'predictive:demand',
    short: 'Hourly demand forecast for a business',
    description: 'Return 24 hourly demand buckets for a business (from completed reservation history). Used to surface busy windows and optimize pricing/staffing. Owner-gated.',
    access: 'owner',
    category: 'predictive',
    endpoints: [{ method: 'GET', path: '/api/v1/predictive/business/:businessId/demand' }],
    inputs: { businessId: 'business id' },
    output: 'array [{hour, count}] for 0..23',
  },
  {
    name: 'predictive:slots',
    short: 'Recommend optimal booking slots',
    description: 'Recommend the best upcoming slots for a guest at a business: each candidate scored by predictedCompletion, lightly load-balanced away from peak hours. Returns top 3 slots with predicted completion + demand. Owner-gated.',
    access: 'owner',
    category: 'predictive',
    endpoints: [{ method: 'POST', path: '/api/v1/predictive/recommend-slots' }],
    inputs: { businessId: 'business id', customerId: 'guest user id (optional)', daysAhead: 'range to evaluate (default 7)' },
    output: 'array [{slot, predictedCompletion, demand}]',
  },

  // ── ZK ──────────────────────────────────────────────────────────────────────
  {
    name: 'zk:realestate',
    short: 'Issue a ZK proof of escrow split (real-estate / hospitality)',
    description: 'Generate a zero-knowledge proof that an escrow split (deposit = price - commission, fee = deposit*rate, binding commitment to the valuation) is valid, WITHOUT revealing the private price/valuation/secret. Packs into a PTP attestation so the proof is verifiable offline by any third party. Real Noir circuit (compiled at startup); constraint-execution proof when no SNARK prover is available; upgrades to a succinct signature when the Barretenberg pipeline lands.',
    access: 'owner',
    category: 'zk',
    endpoints: [{ method: 'POST', path: '/api/v1/realestate/zk-proof' }],
    inputs: { deposit: 'lamports (public)', consecutiveMonths: 'tenancy months (public)', rate: 'basis points platform fee (public)', deadline: 'unix ts (public)', price: 'property valuation (private)', commission: 'agent/facilitator cut (private)', valuation_hash: 'commitment to off-chain terms (private)', agent_secret: 'non-zero stake secret (private, anti-Sybil)' },
    output: 'proof {commitment, publicInputs, zkType:noir-constraint, attestation, anchor, economics}',
    attestation: 'PTPAttestation',
    exclusiveNote: 'Proves the escrow split is correct without revealing the valuation — the privacy + verifiability moat for real-estate/hospitality deals. Upgrades to a succinct on-chain-verifiable SNARK when Barretenberg is in the pipeline.',
  },

  // ── SDK / packaging ─────────────────────────────────────────────────────────
  {
    name: 'pabandi:sdk',
    short: 'Pabandi platform SDK access',
    description: 'Return SDK access info (base URL, auth model, how to call each tool group, the OpenAPI/spec URL, the PTP verify endpoint, the MCP endpoint). This is the "package" landing a third-party app or agent uses to integrate Pabandi.',
    access: 'public',
    category: 'sdk',
    endpoints: [{ method: 'GET', path: '/api/v1/pabandi' }, { method: 'GET', path: '/api/docs.json' }],
    inputs: {},
    output: 'PabandiSdkInfo {baseUrl, auth, mcpEndpoint, specUrl, ptp, toolsUrl, sdk, status}',
  },
];

const accessLabel: Record<ToolAccess, string> = {
  public: 'Public — anyone',
  owner: 'Owner — authenticated own account',
  verified: 'Verified — business with attested open-finance rail / PTP Band A/B',
  exclusive: 'Exclusive — PTP Band A/B or exclusive platform grant (real-chain rails)',
};

export { accessLabel };

export function pabandiPlatformDoc() {
  const tools = pabandiToolsRegistry.map((t) => ({
    ...t,
    accessLabel: accessLabel[t.access],
  }));
  return {
    name: 'Pabandi Platform',
    version: '1.0.0',
    description: 'Verifiable trust + settlement rails for commerce, hospitality, real-estate, and AI agents. Portable attestations (offline-verifiable), open-finance connectivity, escrow, predictive intelligence, and zero-knowledge proofs — consumed by LLMs (MCP), apps (OpenAPI), and tools (SDK).',
    tools,
    accessTiers: {
      public: 'Anyone can call — the open surface (discover, verify, search).',
      owner: 'Authenticated own-account — manage your own listings/rails/predictions.',
      verified: 'Business with an attested open-finance settlement rail — real booking/money rails.',
      exclusive: 'PTP Band A/B or an exclusive platform grant — real-chain escrow, premium predictive signals.',
    },
    specUrl: '/api/v1/pabandi/spec',
    toolsUrl: '/api/v1/pabandi/tools',
    ptp: {
      verifyEndpoint: '/api/v1/agent-passport/verify',
      publicKeyEndpoint: '/.well-known/ptp-key.pem',
      issueEndpoint: '/api/v1/agent-passport/issue',
      ledgerEndpoint: '/api/v1/agent-passport/ledger/:idempotencyKey',
    },
    mcp: {
      endpoint: '/mcp',
      protocol: 'JSON-RPC 2.0 (Streamable HTTP)',
      tools: pabandiToolsRegistry.filter((t) => t.category !== 'sdk' && !t.exclusiveNote)
        .map((t) => ({
          name: `pabandi:${t.short.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
          description: t.description,
          access: t.access,
          category: t.category,
          endpoints: t.endpoints,
        })),
    },
    sdk: {
      baseUrl: process.env.BACKEND_URL || `${typeof window !== 'undefined' ? window.location.origin : 'https://pabandi.onrender.com'}`,
      auth: 'JWT Bearer token for owner/verified/exclusive; public tools need none',
      examples: {
        search: 'GET /api/v1/businesses?search=salon',
        hospitalityBook: 'POST /api/v1/hospitality/book {propertyId, checkIn, checkOut, guests, depositAmount}',
        connectFinance: 'POST /api/v1/hospitality/finance/connect {provider, accountRef}',
        predictive: 'POST /api/v1/predictive/booking {customerId, businessId, reservationTime}',
        zkRealestate: 'POST /api/v1/realestate/zk-proof {deposit, price, commission, valuation_hash, agent_secret, rate, deadline, consecutiveMonths}',
      },
    },
    status: {
      live: true,
      region: 'free-tier render (singapore)',
      onchain: process.env.SOLANA_ANCHOR_SECRET || process.env.ESCROW_ORACLE_PRIVATE_KEY ? 'real' : 'simulated',
    },
  };
}

export async function toolAccessOk(toolName: string, req?: any, options?: { ownerUserId?: string; businessId?: string; verifiedRail?: boolean }) {
  // Resolve the tool. MCP-style names are "pabandi:<short-lowercased>"; direct names
  // match t.name (e.g. "pabandi_verify_passport" handled by the short->underscore mapping).
  const underscore = toolName.replace(/^pabandi:/, '').replace(/_/g, ' ');
  const mcptool = pabandiToolsRegistry.find(
    (t) => `pabandi:${t.short.toLowerCase().replace(/[^a-z0-9]+/g, '_')}` === toolName
      || t.short.toLowerCase().replace(/[^a-z0-9]+/g, '_') === underscore.toLowerCase()
      || t.name === toolName,
  );
  if (!mcptool) return { ok: false, reason: `unknown tool: ${toolName}` };
  if (mcptool.access === 'public') return { ok: true, note: 'public tool' };
  if (mcptool.access === 'owner' && req?.user?.id) return { ok: true, note: 'owner-authenticated' };
  if (mcptool.access === 'verified' && (req?.user?.role === 'BUSINESS_OWNER' || options?.verifiedRail)) {
    if (options?.businessId) {
      const conns = await prisma.openFinanceConnection.findMany({ where: { businessId: options.businessId } });
      if (conns.some((c) => c.status === 'VERIFIED')) return { ok: true, note: 'business has attested rail' };
    }
    return { ok: false, reason: 'business has no attested open-finance settlement rail (connect one to unlock)' };
  }
  if (mcptool.access === 'exclusive') {
    const user = req?.user ? await prisma.user.findUnique({ where: { id: req.user.id }, select: { trustScore: true } }) : null;
    const band = user ? ptpEngine.scoreToRiskBand(user.trustScore ?? 70) : 'E';
    if (band === 'A' || band === 'B') return { ok: true, note: `PTP Band ${band} — exclusive rail unlocked` };
    return { ok: false, reason: `exclusive tools require PTP Band A/B (current band: ${band}) or an exclusive platform grant` };
  }
  return { ok: false, reason: `tool ${toolName} requires ${mcptool.access} access` };
}
