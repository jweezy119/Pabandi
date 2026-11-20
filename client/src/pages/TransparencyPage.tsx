import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { address, getProgramDerivedAddress } from '@solana/kit';
import bs58 from 'bs58';
import {
  Building2,
  UserCheck,
  Bot,
  Tag,
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Lock,
  AlertCircle,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export const ESCROW_PROGRAM_ID = 'EUSLC8q2b2SezvMQFhvU98EFrWkEasTdvrjqdJgYn2qc';

// Anchor account discriminator for `EscrowState` (from server/src/utils/pabandi_escrow.json)
const ESCROW_STATE_DISCRIMINATOR = new Uint8Array([19, 90, 148, 111, 55, 130, 229, 108]);
const ESCROW_STATE_DISCRIMINATOR_B58 = bs58.encode(ESCROW_STATE_DISCRIMINATOR);

type SolanaCluster = 'mainnet-beta' | 'devnet';

const CLUSTER_CONFIG: Record<
  SolanaCluster,
  { label: string; rpcUrl: string; usdcMint: string; explorerSuffix: string }
> = {
  'mainnet-beta': {
    label: 'Solana Mainnet',
    rpcUrl:
      (import.meta.env.VITE_SOLANA_RPC_URL as string | undefined) ||
      'https://api.mainnet-beta.solana.com',
    usdcMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    explorerSuffix: '',
  },
  devnet: {
    label: 'Solana Devnet',
    rpcUrl: 'https://api.devnet.solana.com',
    usdcMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    explorerSuffix: '?cluster=devnet',
  },
};

export interface VaultPdaBalance {
  vaultPda: string;
  escrowStatePda: string;
  reservationId: string;
  usdcBalance: number;
  mint: string;
}

export interface TransparencySnapshot {
  totalTvlUsdc: number;
  activeVaultCount: number;
  escrowAccountCount: number;
  vaults: VaultPdaBalance[];
  protocolConfigPda: string;
  verifiedSlot: number | null;
  fetchedAtIso: string;
  rpcEndpoint: string;
}

const textDecoder = new TextDecoder();

function decodeBase64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decodes `reservation_id` and `customer` pubkey from a raw Anchor `EscrowState` account
 * using pure Uint8Array/DataView (zero Node `Buffer` dependency).
 */
export function decodeEscrowStateSeeds(rawBase64: string): {
  reservationId: string;
  reservationIdBytes: Uint8Array;
  customerBytes: Uint8Array;
} | null {
  try {
    const bytes = decodeBase64ToBytes(rawBase64);
    if (bytes.length < 12 + 32) return null;

    // Verify 8-byte Anchor discriminator
    for (let i = 0; i < 8; i++) {
      if (bytes[i] !== ESCROW_STATE_DISCRIMINATOR[i]) return null;
    }

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const idLen = view.getUint32(8, true);
    if (idLen === 0 || idLen > 64 || 12 + idLen + 32 > bytes.length) return null;

    const reservationIdBytes = bytes.slice(12, 12 + idLen);
    const reservationId = textDecoder.decode(reservationIdBytes);
    const customerBytes = bytes.slice(12 + idLen, 12 + idLen + 32);

    return { reservationId, reservationIdBytes, customerBytes };
  } catch {
    return null;
  }
}

async function solanaJsonRpc<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  });
  if (!response.ok) {
    throw new Error(`Solana RPC HTTP ${response.status}`);
  }
  const json = await response.json();
  if (json.error) {
    throw new Error(json.error?.message || `Solana RPC error in ${method}`);
  }
  return json.result as T;
}

function parseUiTokenAmount(parsedInfo: any): number {
  const tokenAmount = parsedInfo?.tokenAmount;
  if (!tokenAmount) return 0;
  if (typeof tokenAmount.uiAmount === 'number' && Number.isFinite(tokenAmount.uiAmount)) {
    return tokenAmount.uiAmount;
  }
  const raw = Number(tokenAmount.amount ?? 0);
  const decimals = Number(tokenAmount.decimals ?? 6);
  return Number.isFinite(raw) ? raw / 10 ** decimals : 0;
}

/**
 * Fetches live USDC Total Value Locked (TVL) directly from the Solana Anchor smart contract
 * `EUSLC8q2b2SezvMQFhvU98EFrWkEasTdvrjqdJgYn2qc` via real JSON-RPC calls:
 * 1. Derives the `protocol_config` PDA and checks any direct USDC token accounts owned by it.
 * 2. Calls `getProgramAccounts` filtered by the `EscrowState` Anchor discriminator.
 * 3. For every EscrowState account, derives its `escrow_vault` PDA and fetches its live
 *    SPL Token / Token-2022 USDC balance via `getMultipleAccounts`.
 */
export async function fetchLiveAnchorTvl(cluster: SolanaCluster): Promise<TransparencySnapshot> {
  const cfg = CLUSTER_CONFIG[cluster];
  const programAddress = address(ESCROW_PROGRAM_ID);
  const [protocolConfigPda] = await getProgramDerivedAddress({
    programAddress,
    seeds: ['protocol_config'],
  });

  const [slot, programAccounts, configTokenAccounts] = await Promise.all([
    solanaJsonRpc<number>(cfg.rpcUrl, 'getSlot', [{ commitment: 'confirmed' }]).catch(() => null),
    solanaJsonRpc<Array<{ pubkey: string; account: { data: [string, string] | string } }>>(
      cfg.rpcUrl,
      'getProgramAccounts',
      [
        ESCROW_PROGRAM_ID,
        {
          encoding: 'base64',
          commitment: 'confirmed',
          filters: [
            {
              memcmp: {
                offset: 0,
                bytes: ESCROW_STATE_DISCRIMINATOR_B58,
              },
            },
          ],
        },
      ]
    ),
    solanaJsonRpc<{ value?: Array<{ pubkey: string; account?: { data?: { parsed?: { info?: any } } } }> }>(
      cfg.rpcUrl,
      'getTokenAccountsByOwner',
      [
        protocolConfigPda,
        { mint: cfg.usdcMint },
        { encoding: 'jsonParsed', commitment: 'confirmed' },
      ]
    ).catch(() => ({ value: [] })),
  ]);

  const seenTokenAccounts = new Set<string>();
  const vaults: VaultPdaBalance[] = [];
  let totalTvlUsdc = 0;

  // 1. Derive each EscrowState's `escrow_vault` PDA and batch-fetch live SPL token balances
  const derivedVaultTargets: Array<{
    vaultPda: string;
    escrowStatePda: string;
    reservationId: string;
  }> = [];

  for (const entry of Array.isArray(programAccounts) ? programAccounts : []) {
    const rawBase64 = Array.isArray(entry.account?.data)
      ? entry.account.data[0]
      : typeof entry.account?.data === 'string'
        ? entry.account.data
        : '';
    if (!rawBase64) continue;

    const decoded = decodeEscrowStateSeeds(rawBase64);
    if (!decoded) continue;

    const [vaultPda] = await getProgramDerivedAddress({
      programAddress,
      seeds: [
        'escrow_vault',
        decoded.reservationIdBytes,
        decoded.customerBytes,
      ],
    });

    derivedVaultTargets.push({
      vaultPda,
      escrowStatePda: entry.pubkey,
      reservationId: decoded.reservationId,
    });
  }

  // Batch `getMultipleAccounts` in chunks of 100 (Solana RPC limit)
  for (let i = 0; i < derivedVaultTargets.length; i += 100) {
    const chunk = derivedVaultTargets.slice(i, i + 100);
    const pubkeys = chunk.map((c) => c.vaultPda);
    const multiRes = await solanaJsonRpc<{
      value?: Array<{ data?: { parsed?: { info?: any } } } | null>;
    }>(cfg.rpcUrl, 'getMultipleAccounts', [
      pubkeys,
      { encoding: 'jsonParsed', commitment: 'confirmed' },
    ]);

    const accounts = multiRes?.value ?? [];
    for (let idx = 0; idx < chunk.length; idx++) {
      const target = chunk[idx];
      const info = accounts[idx]?.data?.parsed?.info;
      if (!info) continue;
      if (seenTokenAccounts.has(target.vaultPda)) continue;
      seenTokenAccounts.add(target.vaultPda);

      const balance = parseUiTokenAmount(info);
      totalTvlUsdc += balance;
      vaults.push({
        vaultPda: target.vaultPda,
        escrowStatePda: target.escrowStatePda,
        reservationId: target.reservationId,
        usdcBalance: balance,
        mint: String(info.mint || cfg.usdcMint),
      });
    }
  }

  // 2. Include any USDC token accounts directly owned by the ProtocolConfig PDA
  for (const acc of configTokenAccounts?.value ?? []) {
    if (!acc?.pubkey || seenTokenAccounts.has(acc.pubkey)) continue;
    seenTokenAccounts.add(acc.pubkey);
    const info = acc.account?.data?.parsed?.info;
    const balance = parseUiTokenAmount(info);
    if (balance > 0) {
      totalTvlUsdc += balance;
      vaults.push({
        vaultPda: acc.pubkey,
        escrowStatePda: protocolConfigPda,
        reservationId: 'protocol_config_vault',
        usdcBalance: balance,
        mint: String(info?.mint || cfg.usdcMint),
      });
    }
  }

  return {
    totalTvlUsdc: Math.round(totalTvlUsdc * 1_000_000) / 1_000_000,
    activeVaultCount: vaults.filter((v) => v.usdcBalance > 0).length,
    escrowAccountCount: Array.isArray(programAccounts) ? programAccounts.length : 0,
    vaults,
    protocolConfigPda,
    verifiedSlot: slot,
    fetchedAtIso: new Date().toISOString(),
    rpcEndpoint: cfg.rpcUrl,
  };
}

export default function TransparencyPage() {
  const { isAuthenticated } = useAuthStore();
  const defaultCluster: SolanaCluster =
    String(import.meta.env.VITE_SOLANA_CLUSTER || 'mainnet-beta').toLowerCase() === 'devnet'
      ? 'devnet'
      : 'mainnet-beta';

  const [cluster, setCluster] = useState<SolanaCluster>(defaultCluster);
  const [snapshot, setSnapshot] = useState<TransparencySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [rpcError, setRpcError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadOnChainData = useCallback(async (targetCluster: SolanaCluster) => {
    setLoading(true);
    setRpcError(null);
    try {
      const data = await fetchLiveAnchorTvl(targetCluster);
      setSnapshot(data);
    } catch (err: any) {
      setRpcError(
        err?.message || 'Could not reach Solana RPC right now. Click refresh to query again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOnChainData(cluster);
  }, [cluster, loadOnChainData]);

  const clusterCfg = CLUSTER_CONFIG[cluster];
  const explorerProgramUrl = `https://explorer.solana.com/address/${ESCROW_PROGRAM_ID}${clusterCfg.explorerSuffix}`;

  const [derivedConfigPda, setDerivedConfigPda] = useState<string>('');

  useEffect(() => {
    let active = true;
    void getProgramDerivedAddress({
      programAddress: address(ESCROW_PROGRAM_ID),
      seeds: ['protocol_config'],
    })
      .then(([pda]) => {
        if (active) setDerivedConfigPda(pda);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const protocolConfigPdaDisplay = snapshot?.protocolConfigPda || derivedConfigPda;

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div className="landing">
      <Helmet>
        <title>Transparency — A Real Exit. Pabandi is 100% Non-Custodial.</title>
        <meta
          name="description"
          content="Verify live Total Value Locked (TVL) directly from Pabandi's Solana Anchor escrow smart contract EUSLC8q2b2SezvMQFhvU98EFrWkEasTdvrjqdJgYn2qc."
        />
      </Helmet>

      {/* Ambient Orbs */}
      <div className="orbs-container" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      {/* Consistent Home Header with Icons */}
      <header className="header">
        <div className="container">
          <Link to="/" className="logo">
            <span className="logo-mark">◈</span>
            <span>PabandiOS</span>
          </Link>
          <nav className="nav-list" aria-label="Main">
            <Link to="/contact" className="nav-tab-link">
              <Building2 className="nav-tab-icon" size={15} aria-hidden="true" />
              <span>For Businesses</span>
            </Link>
            <Link to="/customers" className="nav-tab-link">
              <UserCheck className="nav-tab-icon" size={15} aria-hidden="true" />
              <span>For Customers</span>
            </Link>
            <Link to="/agents" className="nav-tab-link">
              <Bot className="nav-tab-icon" size={15} aria-hidden="true" />
              <span>For AI Developers</span>
            </Link>
            <Link to="/pricing" className="nav-tab-link">
              <Tag className="nav-tab-icon" size={15} aria-hidden="true" />
              <span>Pricing</span>
            </Link>
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {isAuthenticated ? (
              <Link to="/dashboard" className="cta-nav">Dashboard</Link>
            ) : (
              <Link to="/signup?module=contact" className="cta-nav">Get Started</Link>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 py-12 sm:py-16 px-4 sm:px-6">
        <div className="container max-w-5xl mx-auto space-y-8">
          {/* Hero */}
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E9F4EC] text-[#2D6A4F] text-xs font-bold uppercase tracking-wider border border-[#2D6A4F]/20">
              <ShieldCheck size={14} />
              <span>Live On-Chain Proof of Non-Custody · Solana RPC</span>
            </div>
            <h1 className="font-headline text-3xl sm:text-5xl font-extrabold tracking-tight text-[var(--warm-ink)] leading-tight">
              A Real Exit. Pabandi is 100% Non-Custodial.
            </h1>
            <p className="text-base text-[#5a5348] leading-relaxed">
              Pabandi never holds merchant or customer funds in a pooled corporate bank account. Every escrowed USDC dollar sits in an auditable Solana Anchor Program Derived Address (PDA) queried directly from Solana below.
            </p>
          </div>

          {/* Cluster Switcher & Live Refresh */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/90 border border-[rgba(191,179,163,0.45)] p-4 shadow-sm">
            <div className="flex items-center gap-2">
              {(['mainnet-beta', 'devnet'] as SolanaCluster[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCluster(c)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    cluster === c
                      ? 'bg-[var(--warm-ink)] text-white shadow-sm'
                      : 'bg-[var(--cream)] text-[var(--warm-ink)] hover:bg-[var(--warm-sand)]'
                  }`}
                >
                  {CLUSTER_CONFIG[c].label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => void loadOnChainData(cluster)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[var(--cream)] border border-[rgba(191,179,163,0.5)] text-[var(--warm-ink)] hover:border-[var(--clay)] transition disabled:opacity-50"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>{loading ? 'Querying Solana RPC…' : 'Refresh Live On-Chain TVL'}</span>
            </button>
          </div>

          {/* RPC Error Notice (Never fabricates fake TVL) */}
          {rpcError && (
            <div
              role="alert"
              className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950 flex items-start gap-2.5"
            >
              <AlertCircle size={16} className="text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Live Solana RPC Unavailable</p>
                <p className="mt-0.5">
                  {rpcError} — You can also inspect the smart contract directly on Solana Explorer using the link below.
                </p>
              </div>
            </div>
          )}

          {/* Primary Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Total Value Locked (Live RPC USDC Balance) */}
            <div className="rounded-3xl bg-white border border-[#2D6A4F]/30 p-6 shadow-[var(--shadow-md)] space-y-2">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#2D6A4F]">
                <span>Total Value Locked (TVL)</span>
                <Lock size={14} />
              </div>
              <div
                className="font-headline text-3xl sm:text-4xl font-black text-[var(--warm-ink)] tabular-nums"
                data-testid="live-tvl-usdc"
              >
                {loading
                  ? 'Reading RPC…'
                  : snapshot
                    ? `$${snapshot.totalTvlUsdc.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    : '—'}
              </div>
              <p className="text-xs text-[#5a5348]">
                Live USDC balance summed across Anchor escrow vault PDAs
              </p>
            </div>

            {/* Active Escrow Vault PDAs */}
            <div className="rounded-3xl bg-white border border-[rgba(191,179,163,0.45)] p-6 shadow-[var(--shadow-md)] space-y-2">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[var(--terracotta)]">
                <span>On-Chain Escrow PDAs</span>
                <Layers size={14} />
              </div>
              <div className="font-headline text-3xl sm:text-4xl font-black text-[var(--warm-ink)] tabular-nums">
                {loading ? '…' : snapshot ? snapshot.escrowAccountCount : '—'}
              </div>
              <p className="text-xs text-[#5a5348]">
                {snapshot
                  ? `${snapshot.activeVaultCount} funded vault PDA${snapshot.activeVaultCount === 1 ? '' : 's'} currently holding USDC`
                  : 'Derived from getProgramAccounts on Solana'}
              </p>
            </div>

            {/* Verified Solana Slot */}
            <div className="rounded-3xl bg-white border border-[rgba(191,179,163,0.45)] p-6 shadow-[var(--shadow-md)] space-y-2">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#4f6142]">
                <span>Verified Solana Slot</span>
                <CheckCircle2 size={14} />
              </div>
              <div className="font-mono text-2xl sm:text-3xl font-bold text-[var(--warm-ink)] tabular-nums">
                {loading
                  ? '…'
                  : snapshot?.verifiedSlot != null
                    ? `#${snapshot.verifiedSlot.toLocaleString()}`
                    : '—'}
              </div>
              <p className="text-xs text-[#5a5348] truncate">
                RPC: {clusterCfg.rpcUrl.replace(/^https?:\/\//, '')}
              </p>
            </div>
          </div>

          {/* Audited Smart Contract Card */}
          <div className="rounded-3xl bg-white border border-[rgba(191,179,163,0.5)] p-6 sm:p-7 shadow-[var(--shadow-md)] space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--terracotta)]">
                  Solana Anchor Escrow Smart Contract
                </span>
                <h2 className="font-headline text-xl font-bold text-[var(--warm-ink)] mt-0.5">
                  Verify Program &amp; PDAs Directly on Solana Explorer
                </h2>
              </div>
              <a
                href={explorerProgramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow-[var(--shadow-btn)] hover:opacity-95 transition shrink-0"
                style={{ background: 'linear-gradient(135deg, var(--clay), var(--terracotta))' }}
              >
                <span>View on Solana Explorer</span>
                <ExternalLink size={14} />
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl bg-[var(--cream)] border border-[rgba(191,179,163,0.4)] p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#6c6258]">
                    Program Address
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCopy(ESCROW_PROGRAM_ID, 'program')}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--terracotta)] hover:underline"
                  >
                    {copiedKey === 'program' ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedKey === 'program' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <code
                  className="block font-mono text-xs sm:text-sm font-bold text-[var(--warm-ink)] break-all"
                  data-testid="smart-contract-address"
                >
                  {ESCROW_PROGRAM_ID}
                </code>
              </div>

              <div className="rounded-2xl bg-[var(--cream)] border border-[rgba(191,179,163,0.4)] p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#6c6258]">
                    ProtocolConfig PDA
                  </span>
                  {protocolConfigPdaDisplay && (
                    <a
                      href={`https://explorer.solana.com/address/${protocolConfigPdaDisplay}${clusterCfg.explorerSuffix}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--terracotta)] hover:underline"
                    >
                      <span>Explorer</span>
                      <ExternalLink size={11} />
                    </a>
                  )}
                </div>
                <code className="block font-mono text-xs sm:text-sm font-semibold text-[var(--warm-ink)] break-all">
                  {protocolConfigPdaDisplay || 'Deriving PDA…'}
                </code>
              </div>
            </div>

            {/* Individual Funded Vault PDAs Table */}
            {snapshot && snapshot.vaults.length > 0 && (
              <div className="pt-2 border-t border-[rgba(191,179,163,0.3)] space-y-3">
                <h3 className="text-sm font-bold text-[var(--warm-ink)]">
                  Live Escrow Vault PDAs ({snapshot.vaults.length})
                </h3>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {snapshot.vaults.map((v) => (
                    <div
                      key={v.vaultPda}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl bg-[var(--cream)]/70 border border-[rgba(191,179,163,0.35)] px-3.5 py-2.5 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-mono font-bold text-[var(--warm-ink)] block truncate">
                          Vault PDA: {v.vaultPda}
                        </span>
                        <span className="text-[11px] text-[#6c6258]">
                          Ref: {v.reservationId}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono font-bold text-[#2D6A4F]">
                          ${v.usdcBalance.toFixed(2)} USDC
                        </span>
                        <a
                          href={`https://explorer.solana.com/address/${v.vaultPda}${clusterCfg.explorerSuffix}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--terracotta)] font-semibold hover:underline inline-flex items-center gap-1"
                        >
                          <span>Verify</span>
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Direct On-Chain Recovery Guarantee */}
          <div className="rounded-3xl bg-[#E9F4EC]/75 border border-[#2D6A4F]/25 p-6 sm:p-7 space-y-3">
            <h2 className="font-headline text-lg font-bold text-[#1B4332]">
              What happens if Pabandi ever goes offline?
            </h2>
            <p className="text-sm text-[#2D6A4F] leading-relaxed">
              Pabandi is non-custodial. Your funds are held in a smart contract — never in a Pabandi bank account. Every escrow has a deterministic <code className="font-mono font-bold">escrow_vault</code> PDA and on-chain deadline. If Pabandi&apos;s servers ever disappeared, customers can call <code className="font-mono font-bold">refund_escrow</code> directly on Solana after the deadline, and merchants retain 100% self-custody of every settled USDC dollar in their own Phantom wallet.
            </p>
            <div className="pt-1 flex flex-wrap gap-3">
              <Link
                to="/contact/settings/payment"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#1B4332] text-white hover:opacity-95 transition"
              >
                <span>Configure Self-Custody Wallet →</span>
              </Link>
              <Link
                to="/customers"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-white text-[#1B4332] border border-[#2D6A4F]/30 hover:bg-[#F5EFE6] transition"
              >
                <span>Create a Personal Profile</span>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
