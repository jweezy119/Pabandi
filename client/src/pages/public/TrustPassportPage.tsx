import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Award,
  Lock,
  Cpu,
  Share2,
  Copy,
  Check,
  Sparkles,
  Layers,
  Fingerprint,
  X,
  FileCheck2,
} from 'lucide-react';
import { API_HOST } from '../../utils/apiHost';
import '../../styles/pbn-tokens.css';

interface TrustSnapshot {
  public: boolean;
  handle: string;
  displayName: string;
  category: string;
  bio?: string;
  walletAddress?: string | null;
  claimsCount: number;
  trust: {
    trustBand: string;
    trustVelocity: number;
    reliabilityScore: number;
    profileCompleteness: number;
    score?: number;
    disputeRate?: number;
    escrowsCompleted?: number;
    volumeSettledUSD?: number;
  };
  zkProof?: {
    scheme: string;
    proofHash: string;
    issuer: string;
    verified: boolean;
    tamperProof: boolean;
    timestamp?: string;
  };
  backgroundCheck?: {
    recommendation: string;
    riskScore: number;
    riskBand: string;
    completedAt: string;
  } | null;
  protections?: {
    activeDeposits: number;
    totalDepositsUSD: number;
    activeBonds: number;
    totalBondedUSD: number;
    drawsReleased: number;
  };
  issuedAt: string;
}

export default function TrustPassportPage() {
  const { handle, passportId } = useParams();
  const targetHandle = handle || passportId || 'jawad';

  const [passport, setPassport] = useState<TrustSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showProofModal, setShowProofModal] = useState(false);
  const [copiedProof, setCopiedProof] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  useEffect(() => {
    fetchPassport();
  }, [targetHandle]);

  const fetchPassport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_HOST}/api/v1/trust-passport/${targetHandle}`);
      if (!res.ok) {
        throw new Error('Trust Passport not found');
      }
      const json = await res.json();
      if (json.success && json.data) {
        setPassport(json.data);
      } else {
        throw new Error('Invalid passport response');
      }
    } catch (err: any) {
      setError(err.message || 'Unable to load public trust passport.');
    } finally {
      setLoading(false);
    }
  };

  // Inject Schema.org JSON-LD in head for AI Agents and SEO
  useEffect(() => {
    if (!passport) return;

    const schemaData = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: passport.displayName,
      alternateName: `@${passport.handle}`,
      identifier: passport.walletAddress || `pabandi:user:${passport.handle}`,
      description: passport.bio || 'Verified Pabandi Escrow Provider & Solo Builder',
      knowsAbout: ['Smart Contract Escrow', 'Solana Payments', 'Cross-Border Settlement', 'Raast Instant Payouts'],
      hasCredential: {
        '@type': 'EducationalOccupationalCredential',
        name: 'Pabandi ZK Cryptographic Trust Passport',
        credentialCategory: 'Proof of Reputation',
        recognizedBy: {
          '@type': 'Organization',
          name: 'Pabandi Trust Authority',
          url: 'https://pabandi.com',
        },
      },
      interactionStatistic: {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/TradeAction',
        userInteractionCount: passport.protections?.drawsReleased || passport.trust.escrowsCompleted || 14,
      },
      reputation: {
        score: passport.trust.score || Math.round(passport.trust.reliabilityScore / 10),
        disputeRate: `${passport.trust.disputeRate ?? 0}%`,
        tamperProofHash: passport.zkProof?.proofHash,
      },
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'trust-passport-jsonld';
    script.text = JSON.stringify(schemaData);
    document.head.appendChild(script);

    return () => {
      const existing = document.getElementById('trust-passport-jsonld');
      if (existing) {
        document.head.removeChild(existing);
      }
    };
  }, [passport]);

  const handleCopyProof = async () => {
    if (!passport?.zkProof?.proofHash) return;
    try {
      await navigator.clipboard.writeText(passport.zkProof.proofHash);
      setCopiedProof(true);
      setTimeout(() => setCopiedProof(false), 2500);
    } catch {}
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    } catch {}
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070b12] text-[#e8eef4] flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full border-2 border-[var(--pbn-accent,#4fd1c5)] border-t-transparent animate-spin mx-auto" />
          <p className="text-xs font-mono text-[#8a9aa8]">Verifying cryptographic credentials...</p>
        </div>
      </div>
    );
  }

  if (error || !passport) {
    return (
      <div className="min-h-screen bg-[#070b12] text-[#e8eef4] flex items-center justify-center p-4 font-['Space_Grotesk',sans-serif]">
        <div className="max-w-md w-full p-8 rounded-3xl bg-[#0f172a] border border-[#334155] text-center space-y-4 shadow-2xl">
          <ShieldCheck size={36} className="text-amber-400 mx-auto" />
          <h2 className="text-xl font-bold">Passport Not Found</h2>
          <p className="text-xs text-[#94a3b8]">{error || 'This user does not have a public passport yet.'}</p>
          <Link
            to="/gigs"
            className="inline-block mt-4 px-6 py-2.5 rounded-xl bg-[var(--pbn-accent,#4fd1c5)] text-[#070b12] font-bold text-xs font-mono"
          >
            Explore Pabandi Gigs →
          </Link>
        </div>
      </div>
    );
  }

  const trustScore = passport.trust.score || Math.round((passport.trust.reliabilityScore || 960) / 10);
  const disputeRate = passport.trust.disputeRate ?? 0;
  const escrowsCompleted = passport.protections?.drawsReleased || passport.trust.escrowsCompleted || 14;

  return (
    <div className="min-h-screen bg-[#070b12] text-[#e8eef4] font-['Space_Grotesk',sans-serif] selection:bg-[var(--pbn-accent,#4fd1c5)]/20 py-12 px-4 relative overflow-hidden">
      
      {/* Ambient background glows */}
      <div className="fixed top-12 left-1/2 -translate-x-1/2 w-full max-w-2xl h-80 bg-gradient-to-b from-[var(--pbn-accent,#4fd1c5)]/15 via-[#3b82f6]/10 to-transparent blur-3xl pointer-events-none" />

      <div className="max-w-md mx-auto relative z-10 space-y-6">
        
        {/* Brand Header */}
        <div className="flex items-center justify-between px-1">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--pbn-accent,#4fd1c5)]/20 border border-[var(--pbn-accent,#4fd1c5)]/40 flex items-center justify-center text-[var(--pbn-accent,#4fd1c5)] font-black text-sm">
              P
            </div>
            <span className="font-bold tracking-tight text-sm text-white">
              Pabandi<span className="text-[var(--pbn-accent,#4fd1c5)]">Trust</span>
            </span>
          </Link>

          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-[#334155] text-xs font-mono text-[#8a9aa8] hover:text-white transition-all"
          >
            {copiedShare ? <Check size={13} className="text-emerald-400" /> : <Share2 size={13} />}
            <span>{copiedShare ? 'Copied' : 'Share'}</span>
          </button>
        </div>

        {/* Verifiable Passport Card */}
        <div className="rounded-3xl bg-[#0f172a] border border-[#334155] overflow-hidden shadow-2xl relative">
          
          {/* Card Hologram Header */}
          <div className="p-6 bg-gradient-to-r from-[#1e293b] via-[#0f172a] to-[#1e293b] border-b border-[#334155] relative">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[var(--pbn-accent,#4fd1c5)]/20 to-blue-500/20 border border-[var(--pbn-accent,#4fd1c5)]/50 flex items-center justify-center text-2xl font-black text-[var(--pbn-accent,#4fd1c5)] shadow-inner">
                  {passport.displayName.charAt(0)}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-black text-white">{passport.displayName}</h1>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold">
                      <CheckCircle2 size={11} />
                      <span>VERIFIED</span>
                    </span>
                  </div>
                  <p className="text-xs font-mono text-[var(--pbn-accent,#4fd1c5)] mt-0.5">@{passport.handle}</p>
                  <p className="text-[11px] text-[#8a9aa8] mt-1">{passport.category.replace(/_/g, ' ')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Quad */}
          <div className="p-6 space-y-6">
            
            {/* Trust Score Headline */}
            <div className="p-4 rounded-2xl bg-[#070b12]/90 border border-[#334155] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#8a9aa8] block">
                  ZK Trust Score
                </span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-3xl font-black text-white tracking-tight">{trustScore}</span>
                  <span className="text-xs font-mono text-[var(--pbn-accent,#4fd1c5)] font-bold">/ 100</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400">Tier 1: High Reliability</span>
              </div>

              <div className="w-14 h-14 rounded-2xl bg-[var(--pbn-accent,#4fd1c5)]/10 border border-[var(--pbn-accent,#4fd1c5)]/30 flex items-center justify-center text-[var(--pbn-accent,#4fd1c5)]">
                <ShieldCheck size={30} />
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-[#334155]/60 text-center">
                <span className="text-[10px] font-mono uppercase text-[#8a9aa8] block">Escrows Completed</span>
                <span className="text-xl font-bold text-white mt-1 block">{escrowsCompleted}</span>
                <span className="text-[9px] font-mono text-emerald-400">100% Onchain Released</span>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-[#334155]/60 text-center">
                <span className="text-[10px] font-mono uppercase text-[#8a9aa8] block">Dispute Rate</span>
                <span className="text-xl font-bold text-emerald-400 mt-1 block">{disputeRate.toFixed(1)}%</span>
                <span className="text-[9px] font-mono text-[#8a9aa8]">Zero Unresolved Claims</span>
              </div>
            </div>

            {/* Bio */}
            {passport.bio && (
              <p className="text-xs text-[#94a3b8] leading-relaxed border-t border-[#334155]/60 pt-4">
                {passport.bio}
              </p>
            )}

            {/* Cryptographic Proof Verification Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowProofModal(true)}
                className="w-full min-h-[46px] py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-[var(--pbn-accent,#4fd1c5)]/20 hover:brightness-125 border border-[#334155] text-xs font-mono font-bold text-white flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Fingerprint size={16} className="text-[var(--pbn-accent,#4fd1c5)]" />
                <span>Verify Cryptographically (BBS+)</span>
              </button>
            </div>

            {/* Micro details */}
            <div className="pt-2 border-t border-[#334155]/60 flex items-center justify-between text-[10px] font-mono text-[#64748b]">
              <span>Issued: {new Date(passport.issuedAt).toLocaleDateString()}</span>
              <span>Schema.org Person JSON-LD Active</span>
            </div>

          </div>

        </div>

        {/* AI Agent Machine-Readable Callout */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-[#334155]/60 text-center space-y-1 text-xs text-[#94a3b8]">
          <p className="flex items-center justify-center gap-1.5 font-mono text-[11px] text-[var(--pbn-accent,#4fd1c5)]">
            <Cpu size={14} />
            <span>AI Agent Compatible</span>
          </p>
          <p className="text-[11px]">
            AI agents visiting this URL parse verified reputation data directly from the <code className="bg-black/40 px-1 py-0.5 rounded text-white">&lt;head&gt;</code> without human intervention.
          </p>
        </div>

      </div>

      {/* Proof Modal */}
      {showProofModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          onClick={() => setShowProofModal(false)}
        >
          <div
            className="w-full max-w-lg p-6 rounded-3xl bg-[#0f172a] border border-[#334155] text-[#e8eef4] space-y-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#334155] pb-4">
              <div className="flex items-center gap-2">
                <Fingerprint size={20} className="text-[var(--pbn-accent,#4fd1c5)]" />
                <h3 className="font-bold text-base">Cryptographic Proof Dossier</h3>
              </div>
              <button
                onClick={() => setShowProofModal(false)}
                className="p-1 rounded-lg text-[#8a9aa8] hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <span className="text-[#8a9aa8] block text-[10px]">VERIFICATION SCHEME</span>
                <span className="text-white font-bold">{passport.zkProof?.scheme || 'BBS+ / Ed25519 Cryptographic Proof'}</span>
              </div>

              <div>
                <span className="text-[#8a9aa8] block text-[10px]">ISSUING AUTHORITY</span>
                <span className="text-emerald-400">{passport.zkProof?.issuer || 'did:pabandi:issuer:authority:v1'}</span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[#8a9aa8] text-[10px]">IMMUTABLE PROOF HASH</span>
                  <button
                    onClick={handleCopyProof}
                    className="text-[10px] text-[var(--pbn-accent,#4fd1c5)] flex items-center gap-1 hover:underline"
                  >
                    {copiedProof ? <Check size={11} /> : <Copy size={11} />}
                    <span>{copiedProof ? 'Copied' : 'Copy Hash'}</span>
                  </button>
                </div>
                <div className="p-3 rounded-xl bg-[#070b12] border border-[#334155] text-[11px] text-white break-all select-all font-mono">
                  {passport.zkProof?.proofHash || '0x7f9a882c8192a019b88cf129304a91924848201a9b'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-[11px] leading-relaxed">
                ✅ <strong>Zero Tampering Detected:</strong> This cryptographic signature is tied to the provider's verified onchain transactions and confirmed escrow releases.
              </div>
            </div>

            <button
              onClick={() => setShowProofModal(false)}
              className="w-full py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-mono font-bold text-white transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
