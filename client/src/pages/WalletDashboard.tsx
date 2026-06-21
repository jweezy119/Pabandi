import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'react-query';
import { ShieldCheckIcon, UserCircleIcon, FingerPrintIcon, ShareIcon , UsersIcon } from '@heroicons/react/24/solid';
import {
  ArrowUpRightIcon,
  StarIcon, LinkIcon, XMarkIcon, CheckCircleIcon,
  ExclamationTriangleIcon, BoltIcon,
  TrophyIcon, FireIcon, CurrencyDollarIcon,
  ArrowPathIcon, InformationCircleIcon,
} from '@heroicons/react/24/outline';
import apiClient, { cryptoService, walletService, socialService } from '../services/api';
/* ── Types ── */
type WalletType = 'metamask' | 'phantom' | null;
interface ConnectedWallet { address: string; type: WalletType; chainName: string; }

function shortAddr(addr: string) { return addr.slice(0, 6) + '…' + addr.slice(-4); }
const BSC_CHAIN_ID = '0x38';

async function switchToBSC() {
  await (window as any).ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BSC_CHAIN_ID }] })
    .catch(async (err: any) => {
      if (err.code === 4902) {
        await (window as any).ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{ chainId: BSC_CHAIN_ID, chainName: 'BNB Smart Chain', nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 }, rpcUrls: ['https://bsc-dataseed.binance.org/'], blockExplorerUrls: ['https://bscscan.com'] }],
        });
      }
    });
}

/* ── SBT Tier Config ── */
const SBT_TIERS = [
  { id: 'bronze', label: 'Bronze Patron', minBookings: 1, minRate: 70, color: '#CD7F32', glow: 'rgba(205,127,50,0.3)', icon: '🥉', desc: 'First steps on your Pabandi journey' },
  { id: 'silver', label: 'Silver Reliable', minBookings: 5, minRate: 80, color: '#63748b', glow: 'rgba(99,116,139,0.3)', icon: '🥈', desc: 'Consistent performer — businesses trust you' },
  { id: 'gold', label: 'Gold Trustee', minBookings: 10, minRate: 90, color: '#d97706', glow: 'rgba(217,119,6,0.3)', icon: '🥇', desc: 'Top-tier reliability, rare and respected' },
  { id: 'platinum', label: 'Platinum Oracle', minBookings: 25, minRate: 97, color: '#0284c7', glow: 'rgba(2,132,199,0.3)', icon: '💎', desc: 'Elite. Less than 3% of users ever reach this' },
];

/* ── Soulbound NFT Card ── */
function SBTCard({ tier, earned, totalBookings, showRate }: {
  tier: typeof SBT_TIERS[0]; earned: boolean; totalBookings: number; showRate: number;
}) {
  const [minting, setMinting] = useState(false);
  const [minted, setMinted] = useState(false);
  const [aiProfile, setAiProfile] = useState<string | null>(null);

  const handleMint = async () => {
    if (!earned || minted) return;
    setMinting(true);
    try {
      const res = await cryptoService.mintBadge();
      if (res.data?.data?.badge?.aiTrustProfile) {
        setAiProfile(res.data.data.badge.aiTrustProfile);
      }
      setMinted(true);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to mint badge');
    }
    setMinting(false);
  };

  const bookingsNeeded = Math.max(0, tier.minBookings - totalBookings);
  const rateNeeded = Math.max(0, tier.minRate - showRate);

  return (
    <div style={{
      borderRadius: '1.25rem', padding: '1.5rem',
      background: earned ? `linear-gradient(135deg, ${tier.color}10, #ffffff)` : 'var(--color-surface-container-lowest)',
      border: `1px solid ${earned ? tier.color + '40' : 'var(--color-outline-variant)'}`,
      boxShadow: earned ? `0 0 40px ${tier.glow}, 0 4px 20px rgba(0,0,0,0.05)` : '0 4px 12px rgba(0,0,0,0.02)',
      opacity: earned ? 1 : 0.7,
      transition: 'all 0.3s ease',
      position: 'relative', overflow: 'hidden',
    }} className="bg-surface-container-lowest text-on-surface">
      {earned && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: `radial-gradient(${tier.color}15 1px, transparent 1px)`,
          backgroundSize: '20px 20px',
        }} />
      )}

      {/* Icon */}
      <div style={{ fontSize: 36, marginBottom: 12, filter: earned ? `drop-shadow(0 0 8px ${tier.color})` : 'grayscale(100%) opacity(0.5)' }}>
        {tier.icon}
      </div>

      <h3 className="font-headline" style={{ fontSize: '1rem', fontWeight: 800, color: earned ? tier.color : 'var(--color-on-surface-variant)', marginBottom: 4 }}>
        {tier.label}
      </h3>
      <p className="font-body" style={{ fontSize: 11, color: 'var(--color-on-surface-variant)', marginBottom: 14, lineHeight: 1.5 }}>{tier.desc}</p>

      {/* Requirements */}
      <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="font-body" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-on-surface-variant)' }}>
          <span>Bookings: {totalBookings} / {tier.minBookings}</span>
          <span style={{ color: totalBookings >= tier.minBookings ? tier.color : 'var(--color-on-surface-variant)' }}>
            {totalBookings >= tier.minBookings ? '✓' : `${bookingsNeeded} more`}
          </span>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: 'var(--color-surface-container-high)' }}>
          <div style={{ height: '100%', borderRadius: 2, background: tier.color, width: `${Math.min(totalBookings / tier.minBookings * 100, 100)}%`, transition: 'width 1s ease', boxShadow: `0 0 6px ${tier.color}` }} />
        </div>
        <div className="font-body" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-on-surface-variant)' }}>
          <span>Show rate: {showRate}% / {tier.minRate}%</span>
          <span style={{ color: showRate >= tier.minRate ? tier.color : 'var(--color-on-surface-variant)' }}>
            {showRate >= tier.minRate ? '✓' : `${rateNeeded}% gap`}
          </span>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: 'var(--color-surface-container-high)' }}>
          <div style={{ height: '100%', borderRadius: 2, background: tier.color, width: `${Math.min(showRate / tier.minRate * 100, 100)}%`, transition: 'width 1s ease', boxShadow: `0 0 6px ${tier.color}` }} />
        </div>
      </div>

      {/* Mint / Status button */}
      {earned ? (
        minted ? (
          <div className="font-body" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: tier.color }}>
            <CheckCircleIcon className="h-4 w-4" /> Soulbound NFT Minted ✓
          </div>
        ) : (
          <button onClick={handleMint} disabled={minting} className="font-body" style={{
            width: '100%', padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: 'pointer',
            background: `linear-gradient(135deg, ${tier.color}20, ${tier.color}10)`,
            color: tier.color, border: `1px solid ${tier.color}40`,
            boxShadow: `0 0 16px ${tier.glow}`,
            transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            {minting ? (
              <><span style={{ width: 14, height: 14, border: `2px solid ${tier.color}40`, borderTopColor: tier.color, borderRadius: '50%', display: 'inline-block', animation: 'rotateSlow 0.8s linear infinite' }} /> Minting on Solana…</>
            ) : (
              <>🪙 Mint Soulbound NFT</>
            )}
          </button>
        )
      ) : (
        <div className="font-body" style={{ padding: '8px 0', fontSize: 10, color: 'var(--color-on-surface-variant)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          🔒 LOCKED — Keep booking to unlock
        </div>
      )}

      {aiProfile && (
        <div className="mt-4 p-3 bg-[#111111] border border-[#333333] rounded-xl relative overflow-hidden animate-fade-in">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#ff6a00]" />
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#ff6a00]">DashScope AI Analysis</span>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed font-mono">
            {aiProfile}
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Reward Row ── */
function RewardRow({ reward, index }: { reward: any; index: number }) {
  const isReview = reward.type === 'GOOGLE_REVIEW';
  const isBusiness = reward.type?.startsWith('BUSINESS_');
  const color = isReview ? '#d97706' : isBusiness ? '#0284c7' : '#059669';
  const glow = isReview ? 'rgba(217,119,6,0.1)' : isBusiness ? 'rgba(2,132,199,0.1)' : 'rgba(5,150,105,0.1)';
  const label = isReview ? 'Proof of Review' : isBusiness ? reward.type?.replace('BUSINESS_', '').replace(/_/g, ' ') : 'Proof of Reservation';
  const icon = isReview ? <StarIcon className="h-4 w-4" /> : isBusiness ? <BoltIcon className="h-4 w-4" /> : <CheckCircleIcon className="h-4 w-4" />;

  return (
    <div className="animate-fade-up border-b border-outline-variant/20 hover:bg-surface-container-low transition-colors" style={{
      animationDelay: `${index * 40}ms`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: `${color}15`, color, border: `1px solid ${color}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 10px ${glow}`,
        }}>{icon}</div>
        <div>
          <p className="font-headline" style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-on-surface)' }}>{label}</p>
          <p className="font-body" style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>
            {reward.businessName || 'Pabandi'} · {reward.createdAt ? new Date(reward.createdAt).toLocaleDateString() : ''}
          </p>
        </div>
      </div>
      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <span className="font-headline" style={{ fontSize: '0.875rem', fontWeight: 800, color }}>+{reward.amount} PAB</span>
        {reward.metadata?.aiBonus > 0 && (
          <span className="font-body text-[9px] px-[6px] py-[2px] rounded uppercase font-bold" style={{ background: `${color}15`, color: color }}>
            AI Override Bonus
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Wallet Option ── */
function WalletOption({ id, icon, name, desc, badge, onClick, disabled, loading }: {
  id: string; icon: React.ReactNode; name: string; desc: string;
  badge?: string; onClick: () => void; disabled?: boolean; loading?: boolean;
}) {
  return (
    <button id={id} onClick={onClick} disabled={disabled || loading}
      className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-surface-container-lowest border border-outline-variant hover:bg-surface-container hover:border-primary/40"
    >
      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 bg-surface-container border border-outline-variant/50">
        {loading ? <span style={{ width: 20, height: 20, border: '2px solid rgba(0,106,106,0.3)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', display: 'inline-block', animation: 'rotateSlow 0.8s linear infinite' }} /> : icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-headline text-on-surface font-bold text-sm">{name}</span>
          {badge && <span className="font-body text-[9px] px-[7px] py-[2px] rounded-full font-bold bg-secondary-container text-on-secondary-container border border-secondary/20">{badge}</span>}
        </div>
        <p className="font-body text-[11px] mt-0.5 text-on-surface-variant">{desc}</p>
      </div>
      <ArrowUpRightIcon className="h-4 w-4 flex-shrink-0 text-primary opacity-60" />
    </button>
  );
}

/* ── Main Component ── */
export default function WalletDashboard() {
  const [showModal, setShowModal] = useState(false);
  const [showSBT, setShowSBT] = useState(false);
  const [connected, setConnected] = useState<ConnectedWallet | null>(null);
  const [error, setError] = useState('');
  const [loadingWallet, setLoadingWallet] = useState<WalletType>(null);

  useEffect(() => {
    const saved = localStorage.getItem('pabandi_wallet');
    if (saved) { try { setConnected(JSON.parse(saved)); } catch { } }
  }, []);

  const saveWallet = (w: ConnectedWallet) => { localStorage.setItem('pabandi_wallet', JSON.stringify(w)); setConnected(w); };
  const disconnect = () => { localStorage.removeItem('pabandi_wallet'); setConnected(null); };

  const connectMetaMask = async () => {
    setError(''); setLoadingWallet('metamask');
    try {
      const eth = (window as any).ethereum;
      if (!eth) throw new Error('MetaMask not found. Please install the extension.');
      const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' });
      if (!accounts.length) throw new Error('No accounts returned. Please unlock your wallet.');
      await switchToBSC();
      saveWallet({ address: accounts[0], type: 'metamask', chainName: 'BNB Smart Chain' });
      await apiClient.put('/auth/wallet', { address: accounts[0], chain: 'BSC' }).catch(() => { });
      setShowModal(false);
    } catch (err: any) { setError(err?.message || 'Connection failed.'); }
    finally { setLoadingWallet(null); }
  };

  const connectPhantom = async () => {
    setError(''); setLoadingWallet('phantom');
    try {
      let provider: any = null;
      
      // 1. Try Phantom's specific modern injection
      if ('phantom' in window && (window as any).phantom?.solana) {
        provider = (window as any).phantom.solana;
      }
      // 2. Try the legacy global injection
      else if ((window as any).solana) {
        provider = (window as any).solana;
      }

      if (!provider) {
        throw new Error('No Solana wallet found. Please install Phantom or enable Brave Wallet.');
      }
      
      // Some providers require a manual connection request
      let resp;
      try {
        resp = await provider.connect();
      } catch (e: any) {
        // If connection is rejected by user, throw it
        if (e.code === 4001) throw new Error('Connection rejected by user.');
        throw e;
      }

      const address: string = resp.publicKey ? resp.publicKey.toString() : provider.publicKey.toString();
      
      if (!address) {
         throw new Error("Could not read wallet address.");
      }

      saveWallet({ address, type: 'phantom', chainName: 'Solana' });
      await cryptoService.connectSolana(address).catch(() => { });
      setShowModal(false);
    } catch (err: any) { 
      console.error("Solana Connection Error:", err);
      setError(err?.message || 'Connection failed.'); 
    }
    finally { setLoadingWallet(null); }
  };

  const [transferSuccess, setTransferSuccess] = useState<{ amount: number; txHash?: string } | null>(null);
  
  // Staking State
  const [stakeAmount, setStakeAmount] = useState<number>(0);
  const [unstakeAmount, setUnstakeAmount] = useState<number>(0);

  const stakeMutation = useMutation((amount: number) => apiClient.post('/crypto/wallet/stake', { amount }), {
    onSuccess: (res) => {
      alert(res.data?.message || 'Deposited successfully');
      refetch();
      setStakeAmount(0);
    },
    onError: (err: any) => alert(err?.response?.data?.error || 'Failed to deposit')
  });

  const unstakeMutation = useMutation((amount: number) => apiClient.post('/crypto/wallet/unstake', { amount }), {
    onSuccess: (res) => {
      alert(res.data?.message || 'Withdrew successfully');
      refetch();
      setUnstakeAmount(0);
    },
    onError: (err: any) => alert(err?.response?.data?.error || 'Failed to withdraw')
  });

  const transferMutation = useMutation(() => cryptoService.requestSolanaTransfer(), {
    onSuccess: (res) => {
      setTransferSuccess({
        amount: res.data?.data?.amount || balance,
        txHash: res.data?.data?.txHash
      });
      refetch(); // refresh balance
    },
    onError: (err: any) => {
      alert(err?.response?.data?.error || 'Failed to withdraw to Solana');
    }
  });

  const { data: balances, isLoading, refetch } = useQuery('pab-wallet-balances', async () => {
    const res = await walletService.getBalances();
    return res.data?.data;
  }, { retry: false, refetchOnWindowFocus: false });

  // Fallback to getting rewards from cryptoService to show history
  const { data: cryptoWallet } = useQuery('pab-wallet-rewards', async () => {
    const res = await cryptoService.getWallet();
    return res.data?.data;
  }, { retry: false, refetchOnWindowFocus: false });

  // Web3 Trust Matrix Data
  const { data: badgeData } = useQuery('my-badge-dashboard', async () => {
    const res = await socialService.getMyBadge();
    return res.data?.data;
  }, { retry: false, refetchOnWindowFocus: false });

  const { data: userData } = useQuery('auth-me-dashboard', async () => {
    const res = await apiClient.get('/auth/me');
    return res.data?.data;
  }, { retry: false, refetchOnWindowFocus: false });

  const reliabilityScore = badgeData?.reliabilityScore || 100;
  const socialTrustBoost = badgeData?.socialTrustBoost || 0;
  const graphTrustBoost = badgeData?.graphTrustBoost || 0;
  const isKycVerified = userData?.isEmailVerified && userData?.isPhoneVerified;
  const socialPlatformsCount = badgeData?.socialSignals?.length || 0;
  const hasWeb3 = !!connected;
  
  const offChainBalance = Number(balances?.offChainBalance || 0);
  const onChainBalance = Number(balances?.onChainBalance || 0);
  const totalStaked = Number(balances?.totalStaked || 0);
  const balance = offChainBalance + onChainBalance + totalStaked;
  
  let currentHibah = 0;
  if (reliabilityScore >= 95) currentHibah = 5;
  else if (reliabilityScore >= 85) currentHibah = 2;
  else if (reliabilityScore >= 70) currentHibah = 1;
  
  const usdValue = (balance * 0.15).toFixed(2);
  const totalEarned = cryptoWallet?.totalEarned || 0;
  const rewards = cryptoWallet?.recentRewards || [];

  // Mock reliability stats for SBT (would come from analytics in production)
  const totalBookings = rewards.filter((r: any) => r.type === 'RESERVATION_COMPLETION').length;
  const showRate = totalBookings > 0 ? Math.min(95, 70 + totalBookings * 2) : 0;

  if (isLoading) return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid var(--color-primary-container)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'rotateSlow 0.8s linear infinite', margin: '0 auto 12px' }} />
        <p className="font-body text-sm text-on-surface-variant">Loading wallet…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface text-on-surface pb-20 md:pb-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* ── Header ── */}
        <div className="animate-fade-up flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
          <div>
            <h1 className="font-headline text-3xl sm:text-4xl font-black text-on-surface tracking-tight">
               <img src="/logo-coin-neon.jpg" alt="PAB" className="inline-block h-8 w-8 rounded-full border border-primary/30 mr-1 align-sub" /> PAB Wallet
            </h1>
            <p className="font-body text-sm text-on-surface-variant mt-1.5">
              Earn Pabandi Reliability Tokens — withdraw on Solana, mint NFT badges
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => { setShowSBT(!showSBT); }}
              className="font-body font-bold text-xs flex items-center gap-1.5 px-4 py-2.5 rounded-xl transition-all"
              style={{
                background: showSBT ? 'var(--color-tertiary-container)' : 'var(--color-surface-container-low)',
                color: showSBT ? 'var(--color-on-tertiary-container)' : 'var(--color-on-surface-variant)',
                border: `1px solid ${showSBT ? 'var(--color-tertiary)' : 'var(--color-outline-variant)'}`,
              }}>
              🪙 NFT Badges
            </button>
            {connected ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-primary-container text-on-primary-container border border-primary/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)] inline-block" />
                  {connected.type === 'phantom' ? '👻' : '🦊'} {shortAddr(connected.address)} · {connected.chainName}
                </div>
                <button onClick={disconnect} className="p-2.5 rounded-xl cursor-pointer bg-error-container text-on-error-container border border-error/20 hover:opacity-80 transition-opacity">
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button id="btn-connect-wallet" onClick={() => { setShowModal(true); setError(''); }} className="bg-primary text-on-primary px-4 py-2.5 rounded-xl font-body text-sm font-semibold hover:opacity-90 transition-opacity flex items-center shadow-sm">
                <LinkIcon className="h-4 w-4 inline mr-2" />Connect Wallet
              </button>
            )}
          </div>
        </div>

        {/* ── SBT Panel ── */}
        {showSBT && (
          <div className="animate-fade-up mb-8">
            <div style={{ marginBottom: 16 }}>
              <h2 className="font-headline text-xl font-black text-on-surface">Soulbound Reputation NFTs</h2>
              <p className="font-body text-sm text-on-surface-variant mt-1">
                Non-transferable NFTs that live on Solana forever — your reliability, on-chain. Businesses can verify these.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {SBT_TIERS.map(tier => (
                <SBTCard key={tier.id} tier={tier}
                  earned={totalBookings >= tier.minBookings && showRate >= tier.minRate}
                  totalBookings={totalBookings} showRate={showRate}
                />
              ))}
            </div>
            <div className="mt-4 p-4 rounded-xl bg-secondary-container border border-secondary/20 flex items-start gap-2.5 font-body">
              <InformationCircleIcon className="h-5 w-5 flex-shrink-0 mt-0.5 text-secondary" />
              <p className="text-xs text-on-surface-variant leading-relaxed">
                <strong className="text-secondary font-bold">Soulbound tokens</strong> cannot be transferred or sold — they are permanently tied to your wallet address. This makes them a verifiable, tamper-proof proof of your Pabandi reliability history on-chain.
              </p>
            </div>
          </div>
        )}

        {/* ── Balance Cards ── */}
        <div className="animate-fade-up-delay-1 grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">

          {/* Loyalty Pool (Hibah) */}
          <div className="md:col-span-3 flex flex-col gap-4 relative overflow-hidden rounded-3xl p-6 shadow-md border border-secondary/20" style={{
              background: 'linear-gradient(135deg, var(--color-surface-container-low) 0%, var(--color-surface-container-highest) 100%)',
            }}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
              
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-body text-[10px] font-bold px-3 py-1.5 rounded-full bg-secondary text-on-secondary uppercase tracking-widest shadow-[0_0_10px_var(--color-secondary)]">Community Loyalty Pool</span>
                  <span className="font-body text-[10px] font-bold text-secondary">Earn up to 5% Hibah Gift</span>
                </div>
                <div>
                  <span className="font-headline text-4xl sm:text-5xl font-black text-on-surface">{totalStaked.toLocaleString()}</span>
                  <span className="font-headline text-xl font-bold text-on-surface-variant ml-2">$PAB Locked</span>
                </div>
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-surface border border-outline-variant/30 rounded-lg">
                   <FireIcon className="h-4 w-4 text-orange-500" /> 
                   <span className="font-body text-xs font-bold text-on-surface">Community Gift: <span className={currentHibah === 5 ? 'text-[#14F195]' : 'text-primary'}>{currentHibah}% Flat Bonus</span></span>
                   <span className="font-body text-[10px] text-on-surface-variant ml-1">(Based on {reliabilityScore} Trust Score)</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                 <div className="flex items-center bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm">
                    <input 
                      type="number" 
                      value={stakeAmount || ''} 
                      onChange={e => setStakeAmount(Number(e.target.value))}
                      placeholder="Amount"
                      className="bg-transparent border-none outline-none w-24 px-4 py-3 font-body text-sm text-on-surface font-bold placeholder-on-surface-variant/50" 
                    />
                    <button 
                      onClick={() => stakeMutation.mutate(stakeAmount)}
                      disabled={stakeMutation.isLoading || stakeAmount <= 0 || stakeAmount > offChainBalance}
                      className="bg-primary text-white font-bold text-sm px-5 py-3 hover:bg-primary/90 disabled:opacity-50 transition-colors border-l border-outline-variant"
                    >
                      Deposit
                    </button>
                 </div>
                 
                 <div className="flex items-center bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm">
                    <input 
                      type="number" 
                      value={unstakeAmount || ''} 
                      onChange={e => setUnstakeAmount(Number(e.target.value))}
                      placeholder="Amount"
                      className="bg-transparent border-none outline-none w-24 px-4 py-3 font-body text-sm text-on-surface font-bold placeholder-on-surface-variant/50" 
                    />
                    <button 
                      onClick={() => unstakeMutation.mutate(unstakeAmount)}
                      disabled={unstakeMutation.isLoading || unstakeAmount <= 0 || unstakeAmount > totalStaked}
                      className="bg-secondary text-white font-bold text-sm px-5 py-3 hover:bg-secondary/90 disabled:opacity-50 transition-colors border-l border-outline-variant"
                    >
                      Withdraw + Hibah
                    </button>
                 </div>
              </div>

            </div>
          </div>

          {/* Split Balance Card */}
          <div className="md:col-span-2 flex flex-col gap-4">
            
            {/* Pabandi Vault (Off-Chain) */}
            <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-md border border-primary/20" style={{
              background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-container) 100%)',
            }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%)', backgroundSize: '200% 100%', animation: 'shimmer 4s infinite', pointerEvents: 'none' }} />
              
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-body text-[10px] font-bold px-3 py-1.5 rounded-full bg-black/20 text-white uppercase tracking-widest backdrop-blur-sm">Pabandi Vault</span>
                    <span className="font-body text-[10px] text-white/70">Off-Chain</span>
                  </div>
                  <div>
                    <span className="font-headline text-4xl sm:text-5xl font-black text-white">{offChainBalance.toLocaleString()}</span>
                    <span className="font-headline text-lg text-white/80 ml-2">PAB</span>
                  </div>
                  <p className="font-body text-xs text-white/70 mt-1">Available for Staking & Direct Booking</p>
                </div>
                
                {/* Withdraw Button */}
                <div className="text-right">
                  {connected && connected.type === 'phantom' && offChainBalance > 0 && !transferSuccess && (
                    <button type="button" onClick={() => transferMutation.mutate()} disabled={transferMutation.isLoading}
                      className="font-body text-xs font-bold px-4 py-2.5 rounded-xl bg-white/20 text-white border border-white/30 hover:bg-white/30 transition-colors flex items-center gap-1.5 shadow-sm">
                      {transferMutation.isLoading ? <><ArrowPathIcon className="h-4 w-4 animate-spin" /> Sending…</> : <>↗ Withdraw to Web3</>}
                    </button>
                  )}
                  {!connected && (
                    <button onClick={() => { setShowModal(true); setError(''); }}
                      className="font-body text-xs text-white/80 hover:text-white transition-colors flex items-center gap-1.5 underline underline-offset-2">
                      <LinkIcon className="h-4 w-4" /> Connect Phantom to withdraw
                    </button>
                  )}
                </div>
              </div>
              
              {transferSuccess && (
                <div className="w-full mt-4 p-3 bg-white/10 border border-white/20 rounded-xl backdrop-blur-sm animate-fade-in">
                  <p className="text-[11px] font-bold text-white flex items-center gap-1.5 mb-1">
                    <CheckCircleIcon className="h-4 w-4 text-[#5fa98c]" />
                    Successfully withdrawn {transferSuccess.amount.toLocaleString()} PAB!
                  </p>
                  {transferSuccess.txHash && (
                    <a href={`https://solscan.io/tx/${transferSuccess.txHash}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-white/70 hover:text-white underline underline-offset-2 flex items-center gap-1">
                      View on Solscan <ArrowUpRightIcon className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Web3 Wallet (On-Chain) */}
            <div className="relative overflow-hidden rounded-3xl p-6 shadow-sm border border-outline-variant/30 bg-surface-container-lowest">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-body text-[10px] font-bold px-3 py-1.5 rounded-full bg-secondary-container text-on-secondary-container uppercase tracking-widest border border-secondary/10">Web3 Wallet</span>
                    {connected ? (
                      <span className="font-body text-[10px] text-on-surface-variant flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
                        {connected.chainName}
                      </span>
                    ) : (
                      <span className="font-body text-[10px] text-on-surface-variant">Not Connected</span>
                    )}
                  </div>
                  <div>
                    <span className="font-headline text-3xl sm:text-4xl font-black text-on-surface">{onChainBalance.toLocaleString()}</span>
                    <span className="font-headline text-base text-on-surface-variant ml-2">PAB</span>
                  </div>
                  <p className="font-body text-xs text-on-surface-variant mt-1">Self-Custodial Balance</p>
                </div>
                
                {connected && connected.type === 'phantom' && (
                  <div className="text-right flex flex-col items-end gap-2">
                    <span className="font-body text-xs font-bold text-on-surface-variant">◎ {shortAddr(connected.address)}</span>
                    <a href={`https://solscan.io/account/${connected.address}`} target="_blank" rel="noopener noreferrer" 
                      className="font-body text-[10px] text-primary hover:underline underline-offset-2 flex items-center gap-1">
                      View Account <ArrowUpRightIcon className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Total Earned', value: `${totalEarned} PAB`, colorClass: 'text-tertiary', bgClass: 'bg-tertiary-fixed', borderClass: 'border-tertiary/20', sub: 'All time', icon: <TrophyIcon className="h-5 w-5" /> },
              { label: 'USD Value', value: `$${usdValue}`, colorClass: 'text-secondary', bgClass: 'bg-secondary-container', borderClass: 'border-secondary/20', sub: '@ $0.15/PAB', icon: <CurrencyDollarIcon className="h-5 w-5" /> },
              { label: 'Recent Rewards', value: `${rewards.length}`, colorClass: 'text-primary', bgClass: 'bg-primary-container', borderClass: 'border-primary/20', sub: 'Last 20 events', icon: <FireIcon className="h-5 w-5" /> },
            ].map(s => (
              <div key={s.label} className={`flex-1 bg-surface-container-lowest border ${s.borderClass} rounded-2xl p-4 flex items-center gap-3.5 shadow-sm hover:shadow-md transition-all`}>
                <div className={`${s.colorClass} ${s.bgClass} p-2.5 rounded-xl border ${s.borderClass} flex-shrink-0`}>{s.icon}</div>
                <div>
                  <p className="font-body text-[10px] text-on-surface-variant uppercase tracking-widest font-bold mb-0.5">{s.label}</p>
                  <p className={`font-headline text-lg font-black ${s.colorClass}`}>{s.value}</p>
                  <p className="font-body text-[9px] text-on-surface-variant font-medium">{s.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Web3 Reliability Matrix ── */}
        <div className="animate-fade-up-delay-2 mb-10">
          <div className="mb-5">
            <h2 className="font-headline text-xl font-black text-on-surface">Web3 Trust Matrix</h2>
            <p className="font-body text-sm text-on-surface-variant mt-1">
              Transparent, cryptographic proof of the factors powering your Pabandi Reliability Score.
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-stretch">
            {/* The 5 Pillars */}
            <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Pillar 1: Historical Proof */}
              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 flex gap-3 shadow-sm relative overflow-hidden">
                <div className="bg-primary/10 text-primary p-2.5 rounded-xl h-fit border border-primary/20"><CheckCircleIcon className="h-6 w-6" /></div>
                <div>
                  <h4 className="font-headline text-sm font-bold text-on-surface">Historical Proof</h4>
                  <p className="font-body text-xs text-on-surface-variant mt-0.5 mb-2 leading-relaxed">On-chain ledger of your bookings and show-up rate.</p>
                  <div className="flex items-center gap-2">
                    <span className="font-body text-xs font-bold px-2 py-0.5 rounded bg-primary text-on-primary">{showRate}% Rate</span>
                    <span className="font-body text-[10px] text-on-surface-variant">{totalBookings} Bookings</span>
                  </div>
                </div>
              </div>

              {/* Pillar 2: Identity (KYC) */}
              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 flex gap-3 shadow-sm relative overflow-hidden">
                <div className="bg-secondary/10 text-secondary p-2.5 rounded-xl h-fit border border-secondary/20"><FingerPrintIcon className="h-6 w-6" /></div>
                <div>
                  <h4 className="font-headline text-sm font-bold text-on-surface">Identity Proof</h4>
                  <p className="font-body text-xs text-on-surface-variant mt-0.5 mb-2 leading-relaxed">Government-grade identity verification for ultimate trust.</p>
                  {isKycVerified ? (
                    <span className="font-body text-xs font-bold px-2 py-0.5 rounded bg-secondary text-on-secondary flex items-center w-fit gap-1"><ShieldCheckIcon className="h-3 w-3" /> Verified Identity</span>
                  ) : (
                    <span className="font-body text-xs font-bold px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant flex items-center w-fit gap-1"><UserCircleIcon className="h-3 w-3" /> Pseudonymous</span>
                  )}
                </div>
              </div>

              {/* Pillar 3: Social Graph */}
              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 flex gap-3 shadow-sm relative overflow-hidden">
                <div className="bg-tertiary/10 text-tertiary p-2.5 rounded-xl h-fit border border-tertiary/20"><ShareIcon className="h-6 w-6" /></div>
                <div>
                  <h4 className="font-headline text-sm font-bold text-on-surface">Social Graph</h4>
                  <p className="font-body text-xs text-on-surface-variant mt-0.5 mb-2 leading-relaxed">Reputation dynamically synced across global B2B and B2C platforms.</p>
                  {socialPlatformsCount > 0 ? (
                    <div className="flex items-center gap-2">
                      <span className="font-body text-xs font-bold px-2 py-0.5 rounded bg-tertiary text-on-tertiary">+{socialTrustBoost} pts Boost</span>
                      <span className="font-body text-[10px] text-on-surface-variant">{socialPlatformsCount} Connected</span>
                    </div>
                  ) : (
                    <span className="font-body text-xs font-bold px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant">0 Connected</span>
                  )}
                </div>
              </div>

              {/* Pillar 4: Web3 Custody */}
              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 flex gap-3 shadow-sm relative overflow-hidden">
                <div className="bg-[#d97706]/10 text-[#d97706] p-2.5 rounded-xl h-fit border border-[#d97706]/20"><BoltIcon className="h-6 w-6" /></div>
                <div>
                  <h4 className="font-headline text-sm font-bold text-on-surface">Web3 Custody</h4>
                  <p className="font-body text-xs text-on-surface-variant mt-0.5 mb-2 leading-relaxed">Cryptographic wallet connecting your SBTs to reality.</p>
                  {hasWeb3 ? (
                    <span className="font-body text-xs font-bold px-2 py-0.5 rounded bg-[#d97706] text-white flex items-center w-fit gap-1"><LinkIcon className="h-3 w-3" /> Wallet Linked</span>
                  ) : (
                    <span className="font-body text-xs font-bold px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant">Not Linked</span>
                  )}
                </div>
              </div>

              {/* Pillar 5: Network Trust */}
              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 flex gap-3 shadow-sm relative overflow-hidden">
                <div className="bg-[#8b5cf6]/10 text-[#8b5cf6] p-2.5 rounded-xl h-fit border border-[#8b5cf6]/20"><UsersIcon className="h-6 w-6" /></div>
                <div>
                  <h4 className="font-headline text-sm font-bold text-on-surface">Graph Trust</h4>
                  <p className="font-body text-xs text-on-surface-variant mt-0.5 mb-2 leading-relaxed">Sybil resistance through network referral scoring.</p>
                  {graphTrustBoost !== 0 ? (
                    <span className={`font-body text-xs font-bold px-2 py-0.5 rounded flex items-center w-fit gap-1 ${graphTrustBoost > 0 ? 'bg-[#8b5cf6] text-white' : 'bg-error text-on-error'}`}>
                      {graphTrustBoost > 0 ? '+' : ''}{graphTrustBoost} pts
                    </span>
                  ) : (
                    <span className="font-body text-xs font-bold px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant">No Referral Data</span>
                  )}
                </div>
              </div>

            </div>

            {/* Final Trust Score Box */}
            <div className="lg:col-span-2 relative overflow-hidden rounded-2xl p-6 shadow-sm border border-primary/20 flex flex-col justify-center items-center text-center" style={{
              background: 'linear-gradient(135deg, var(--color-surface-container-lowest) 0%, var(--color-primary-container) 150%)',
            }}>
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at center, var(--color-primary) 0%, transparent 60%)', opacity: 0.05, pointerEvents: 'none' }} />
              <ShieldCheckIcon className="h-12 w-12 text-primary mb-3 drop-shadow-md" />
              <h3 className="font-headline text-sm font-bold text-on-surface mb-1">Standard Trust Score</h3>
              <div className="flex items-baseline gap-1 mt-1 mb-2">
                <span className="font-headline text-6xl font-black text-primary drop-shadow-sm">{reliabilityScore}</span>
                <span className="font-headline text-xl font-bold text-on-surface-variant">/100</span>
              </div>
              <p className="font-body text-xs text-on-surface-variant leading-relaxed max-w-[200px]">
                Calculated transparently using your booking history, social graph, and identity proofs.
              </p>
            </div>
            
          </div>
        </div>

        {/* ── Rewards History ── */}
        <div className="animate-fade-up-delay-2 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-outline-variant/30 flex justify-between items-center bg-surface-container-low">
            <div>
              <h3 className="font-headline font-black text-on-surface text-lg">Reward History</h3>
              <p className="font-body text-[11px] text-on-surface-variant font-medium mt-0.5">Every PAB earned, logged on-chain</p>
            </div>
            <button onClick={() => refetch()} className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors">
              <ArrowPathIcon className="h-5 w-5" />
            </button>
          </div>
          {rewards.length > 0 ? (
            <div className="divide-y divide-outline-variant/20">
              {rewards.map((r: any, i: number) => <RewardRow key={r.id} reward={r} index={i} />)}
            </div>
          ) : (
            <div className="text-center py-12 text-on-surface-variant bg-surface-container-lowest">
              <BoltIcon className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="font-headline font-bold mb-1">No rewards yet</p>
              <p className="font-body text-xs">Complete bookings to earn your first PAB tokens</p>
            </div>
          )}
        </div>

      </div>

      {/* ── Connect Wallet Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="animate-fade-scale w-full max-w-sm bg-surface-container-lowest border border-outline-variant/50 rounded-3xl p-6 shadow-xl">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="font-headline text-xl font-black text-on-surface">Connect Wallet</h2>
                <p className="font-body text-[11px] text-on-surface-variant font-medium mt-1">Solana recommended · Required for $PAB</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface-variant transition-colors">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl flex items-start gap-2 bg-error-container text-on-error-container border border-error/20 font-body text-xs font-medium">
                <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5 text-error" /> {error}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <WalletOption id="btn-connect-phantom" icon="👻" name="Phantom" desc="Recommended · Solana network for $PAB" badge="Solana" onClick={connectPhantom} loading={loadingWallet === 'phantom'} disabled={loadingWallet !== null && loadingWallet !== 'phantom'} />
              <WalletOption id="btn-connect-metamask" icon="🦊" name="MetaMask" desc="BNB Smart Chain · Legacy support" badge="BSC" onClick={connectMetaMask} loading={loadingWallet === 'metamask'} disabled={loadingWallet !== null && loadingWallet !== 'metamask'} />
            </div>

            <p className="text-center font-body text-[10px] mt-6 text-on-surface-variant leading-relaxed px-4">
              By connecting, you agree to our <a href="#" className="text-primary font-bold hover:underline">Terms</a>.
              <br />Your wallet address is stored securely and never shared.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

