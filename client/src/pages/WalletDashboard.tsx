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
import apiClient, { cryptoService, walletService, socialService, stakingService, treasuryService } from '../services/api';
import { executeStellarLiquidityDeposit, executeSolanaLiquidityDeposit } from '../utils/web3';
import { useAuthStore } from '../store/authStore';
import { Surface, Button, Badge, tokens } from '../design-system';

/* ── Types ── */
type WalletType = 'metamask' | 'phantom' | 'freighter' | null;
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
    <Surface style={{
      borderRadius: '1.25rem', padding: '1.5rem', overflow: 'hidden',
      background: earned ? `linear-gradient(135deg, ${tier.color}10, #ffffff)` : tokens.color.surface,
      border: `1px solid ${earned ? tier.color + '40' : tokens.color.border}`,
      boxShadow: earned ? `0 0 40px ${tier.glow}, 0 4px 20px rgba(0,0,0,0.05)` : '0 4px 12px rgba(0,0,0,0.02)',
      opacity: earned ? 1 : 0.7,
    }}>
      {earned && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: `radial-gradient(${tier.color}15 1px, transparent 1px)`, backgroundSize: '20px 20px' }} />
      )}

      <div style={{ fontSize: 36, marginBottom: 12, filter: earned ? `drop-shadow(0 0 8px ${tier.color})` : 'grayscale(100%) opacity(0.5)' }}>
        {tier.icon}
      </div>

      <h3 className="font-headline" style={{ fontSize: '1rem', fontWeight: 800, color: earned ? tier.color : tokens.color.muted, marginBottom: 4 }}>
        {tier.label}
      </h3>
      <p className="font-body" style={{ fontSize: 11, color: tokens.color.muted, marginBottom: 14, lineHeight: 1.5 }}>{tier.desc}</p>

      <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="font-body" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: tokens.color.muted }}>
          <span>Bookings: {totalBookings} / {tier.minBookings}</span>
          <span style={{ color: totalBookings >= tier.minBookings ? tier.color : tokens.color.muted }}>
            {totalBookings >= tier.minBookings ? '✓' : `${bookingsNeeded} more`}
          </span>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: tokens.color.surface }}>
          <div style={{ height: '100%', borderRadius: 2, background: tier.color, width: `${Math.min(totalBookings / tier.minBookings * 100, 100)}%`, transition: 'width 1s ease', boxShadow: `0 0 6px ${tier.color}` }} />
        </div>
        <div className="font-body" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: tokens.color.muted }}>
          <span>Show rate: {showRate}% / {tier.minRate}%</span>
          <span style={{ color: showRate >= tier.minRate ? tier.color : tokens.color.muted }}>
            {showRate >= tier.minRate ? '✓' : `${rateNeeded}% gap`}
          </span>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: tokens.color.surface }}>
          <div style={{ height: '100%', borderRadius: 2, background: tier.color, width: `${Math.min(showRate / tier.minRate * 100, 100)}%`, transition: 'width 1s ease', boxShadow: `0 0 6px ${tier.color}` }} />
        </div>
      </div>

      {earned ? (
        minted ? (
          <div className="font-body" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: tier.color }}>
            <CheckCircleIcon className="h-4 w-4" /> Soulbound NFT Minted ✓
          </div>
        ) : (
          <Button onClick={handleMint} disabled={minting} variant="outline" className="w-full justify-center" type="button">
            {minting ? <>Minting on Solana…</> : <>🪙 Mint Soulbound NFT</>}
          </Button>
        )
      ) : (
        <div className="font-body" style={{ padding: '8px 0', fontSize: 10, color: tokens.color.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          🔒 LOCKED — Keep booking to unlock
        </div>
      )}

      {aiProfile && (
        <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-black/30 p-3 animate-fade-in">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#ff6a00]">DashScope AI Analysis</span>
          </div>
          <p className="text-xs leading-relaxed text-gray-300 font-mono">{aiProfile}</p>
        </div>
      )}
    </Surface>
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
    <div className="animate-fade-up transition-colors hover:bg-white/5" style={{ animationDelay: `${index * 40}ms`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${tokens.color.borderSubtle}`, padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: `${color}15`, color, border: `1px solid ${color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 10px ${glow}` }}>
          {icon}
        </div>
        <div>
          <p className="font-headline" style={{ fontSize: '0.875rem', fontWeight: 700, color: tokens.color.text }}>{label}</p>
          <p className="font-body" style={{ fontSize: 11, color: tokens.color.muted }}>
            {reward.businessName || 'Pabandi'} · {reward.createdAt ? new Date(reward.createdAt).toLocaleDateString() : ''}
          </p>
        </div>
      </div>
      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <span className="font-headline" style={{ fontSize: '0.875rem', fontWeight: 800, color }}>+{reward.amount} PAB</span>
        {reward.metadata?.aiBonus > 0 && (
          <span className="font-body rounded px-[6px] py-[2px] text-[9px] uppercase" style={{ background: `${color}15`, color, fontWeight: 800 }}>
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
      className="flex w-full items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-left transition-all duration-200 hover:border-indigo-400/40 disabled:opacity-50"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-2xl">
        {loading ? <span style={{ width: 20, height: 20, border: '2px solid rgba(99,102,241,0.3)', borderTopColor: tokens.color.primary, borderRadius: '50%', display: 'inline-block', animation: 'rotateSlow 0.8s linear infinite' }} /> : icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-headline text-sm font-bold" style={{ color: tokens.color.text }}>{name}</span>
          {badge && <span className="rounded-full border border-indigo-400/20 bg-indigo-500/15 px-2 py-0.5 text-[9px] font-bold text-indigo-200">{badge}</span>}
        </div>
        <p className="mt-0.5 font-body text-[11px]" style={{ color: tokens.color.muted }}>{desc}</p>
      </div>
      <ArrowUpRightIcon className="h-4 w-4 shrink-0 opacity-60" style={{ color: tokens.color.primary }} />
    </button>
  );
}

/* ── Main Component ── */
export default function WalletDashboard() {
  const { fetchWalletData } = useAuthStore();
  const [showModal, setShowModal] = useState(false);
  const [showSBT, setShowSBT] = useState(false);
  const [connected, setConnected] = useState<ConnectedWallet | null>(null);
  const [error, setError] = useState('');
  const [loadingWallet, setLoadingWallet] = useState<WalletType>(null);

  useEffect(() => {
    const saved = localStorage.getItem('pabandi_wallet');
    if (saved) { try { setConnected(JSON.parse(saved)); } catch { } }
    fetchWalletData();
  }, []);

  const saveWallet = (w: ConnectedWallet) => {
    localStorage.setItem('pabandi_wallet', JSON.stringify(w));
    setConnected(w);
  };
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
      await fetchWalletData();
      setShowModal(false);
    } catch (err: any) { setError(err?.message || 'Connection failed.'); }
    finally { setLoadingWallet(null); }
  };

  const connectFreighter = async () => {
    setError(''); setLoadingWallet('freighter');
    try {
      const api = (window as any).freighterApi;
      if (!api?.isConnected || !(await api.isConnected())) throw new Error('Freighter wallet not found. Please install the Freighter browser extension.');
      if (!(await api.isAllowed())) await api.setAllowed();
      const publicKey = await api.getPublicKey();
      if (!publicKey) throw new Error('Could not get public key from Freighter.');
      saveWallet({ address: publicKey, type: 'freighter', chainName: 'Stellar' });
      await apiClient.put('/auth/wallet', { address: publicKey, chain: 'STELLAR' }).catch(() => { });
      await fetchWalletData();
      setShowModal(false);
    } catch (err: any) {
      console.error('Stellar Connection Error:', err);
      setError(err?.message || 'Connection failed.');
    }
    finally { setLoadingWallet(null); }
  };

  const connectPhantom = async () => {
    setError(''); setLoadingWallet('phantom');
    try {
      let provider: any = null;
      if ('phantom' in window && (window as any).phantom?.solana) provider = (window as any).phantom.solana;
      else if ((window as any).solana) provider = (window as any).solana;
      if (!provider) throw new Error('No Solana wallet found. Please install Phantom or enable Brave Wallet.');
      let resp;
      try { resp = await provider.connect(); } catch (e: any) { if (e.code === 4001) throw new Error('Connection rejected by user.'); throw e; }
      const address: string = resp.publicKey ? resp.publicKey.toString() : provider.publicKey.toString();
      if (!address) throw new Error('Could not read wallet address.');
      saveWallet({ address, type: 'phantom', chainName: 'Solana' });
      await cryptoService.connectSolana(address).catch(() => { });
      await fetchWalletData();
      setShowModal(false);
    } catch (err: any) {
      console.error('Solana Connection Error:', err);
      setError(err?.message || 'Connection failed.');
    }
    finally { setLoadingWallet(null); }
  };

  const [transferSuccess, setTransferSuccess] = useState<{ amount: number; txHash?: string } | null>(null);

  const [stakeAmount, setStakeAmount] = useState<number>(0);
  const [stellarPabAmount, setStellarPabAmount] = useState<number>(0);
  const [stellarOtherAmount, setStellarOtherAmount] = useState<number>(0);
  const [isStellarLoading, setIsStellarLoading] = useState<boolean>(false);
  const [solanaPabAmount, setSolanaPabAmount] = useState<number>(0);
  const [solanaOtherAmount, setSolanaOtherAmount] = useState<number>(0);
  const [isSolanaLoading, setIsSolanaLoading] = useState<boolean>(false);
  const [totalTreasury, setTotalTreasury] = useState(0);
  const [treasuryOp, setTreasuryOp] = useState(0);
  const [treasuryLp, setTreasuryLp] = useState(0);

  const handleStellarLpDeposit = async () => {
    if (!stellarPabAmount || !stellarOtherAmount) return;
    setIsStellarLoading(true);
    try {
      const result = await executeStellarLiquidityDeposit(stellarPabAmount.toString(), stellarOtherAmount.toString());
      alert(result.success ? 'Liquidity successfully provided to Stellar AMM!' : (result.error || 'Failed to provide liquidity on Stellar.'));
    } finally { setIsStellarLoading(false); }
  };

  const handleSolanaLpDeposit = async () => {
    if (!solanaPabAmount || !solanaOtherAmount) return;
    setIsSolanaLoading(true);
    try {
      const result = await executeSolanaLiquidityDeposit(solanaPabAmount, solanaOtherAmount);
      alert(result.success ? 'Liquidity successfully provided to Solana AMM!' : (result.error || 'Failed to provide liquidity on Solana.'));
    } finally { setIsSolanaLoading(false); }
  };

  const { data: poolStatus, refetch: refetchPool } = useQuery('yield-pool-status', async () => {
    const res = await stakingService.getPoolStatus();
    return res.data;
  }, { refetchOnWindowFocus: false });

  const stakeMutation = useMutation((amount: number) => stakingService.stakeYield(amount), {
    onSuccess: (res) => {
      alert(res.data?.message || 'Staked successfully');
      refetch();
      refetchPool();
      setStakeAmount(0);
    },
    onError: (err: any) => alert(err?.response?.data?.error || 'Failed to stake')
  });

  const unstakeMutation = useMutation((positionId: string) => stakingService.unstakeYield(positionId), {
    onSuccess: (res) => {
      alert(res.data?.message || 'Unstaked successfully');
      refetch();
      refetchPool();
    },
    onError: (err: any) => alert(err?.response?.data?.error || 'Failed to unstake')
  });

  const transferMutation = useMutation(() => cryptoService.requestSolanaTransfer(), {
    onSuccess: (res) => {
      setTransferSuccess({ amount: res.data?.data?.amount || balance, txHash: res.data?.data?.txHash });
      refetch();
    },
    onError: (err: any) => alert(err?.response?.data?.message || err?.response?.data?.error || 'Failed to withdraw to Solana')
  });

  const { data: balances, isLoading, refetch } = useQuery('pab-wallet-balances', async () => {
    const res = await walletService.getBalances();
    return res.data?.data;
  }, { retry: false, refetchOnWindowFocus: false });

  const { data: cryptoWallet } = useQuery('pab-wallet-rewards', async () => {
    const res = await cryptoService.getWallet();
    return res.data?.data;
  }, { retry: false, refetchOnWindowFocus: false });

  const { data: badgeData } = useQuery('my-badge-dashboard', async () => {
    const res = await socialService.getMyBadge();
    return res.data?.data;
  }, { retry: false, refetchOnWindowFocus: false });

  const { data: userData } = useQuery('auth-me-dashboard', async () => {
    const res = await apiClient.get('/auth/me');
    return res.data?.data;
  }, { retry: false, refetchOnWindowFocus: false });

  const reliabilityScore = badgeData?.reliabilityScore || 100;
  const commerceScore = badgeData?.commerceScore || 100;
  const hospitalityScore = badgeData?.hospitalityScore || 100;
  const appointmentScore = badgeData?.appointmentScore || 100;
  const freelanceScore = badgeData?.freelanceScore || 100;
  const socialTrustBoost = badgeData?.socialTrustBoost || 0;
  const graphTrustBoost = badgeData?.graphTrustBoost || 0;
  const isKycVerified = userData?.isEmailVerified && userData?.isPhoneVerified;
  const socialPlatformsCount = badgeData?.socialSignals?.length || 0;
  const hasWeb3 = !!connected;

  const offChainBalance = Number(balances?.offChainBalance || 0);
  const onChainBalance = Number(balances?.onChainBalance || 0);
  const totalStaked = Number(balances?.totalStaked || 0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await treasuryService.getSummary();
        const data = res.data;
        if (cancelled) return;
        setTotalTreasury(data?.total || 0);
        setTreasuryOp(data?.byBucket?.OPERATING || 0);
        setTreasuryLp((data?.byBucket?.LP_PROVISION || 0) + (data?.byBucket?.YIELD_REINVEST || 0));
      } catch { }
    };
    load();
    const timer = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  const balance = offChainBalance + onChainBalance + totalStaked;
  const usdValue = (balance * 0.15).toFixed(2);
  const totalEarned = cryptoWallet?.totalEarned || 0;
  const rewards = cryptoWallet?.recentRewards || [];

  const totalBookings = rewards.filter((r: any) => r.type === 'RESERVATION_COMPLETION').length;
  const showRate = totalBookings > 0 ? Math.min(95, 70 + totalBookings * 2) : 0;

  if (isLoading) return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(99,102,241,0.3)', borderTopColor: tokens.color.primary, borderRadius: '50%', animation: 'rotateSlow 0.8s linear infinite', margin: '0 auto 12px' }} />
        <p className="font-body text-sm" style={{ color: tokens.color.muted }}>Loading wallet…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-20 md:pb-8 font-body" style={{ background: tokens.color.background, color: tokens.color.text, fontFamily: tokens.font.body }}>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 sm:py-10">

        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="w-full md:w-auto">
            <h1 className="font-headline text-3xl font-black tracking-tight sm:text-4xl flex items-center gap-2" style={{ color: tokens.color.text }}>
              <img src="/logo-coin-neon.jpg" alt="PAB" className="h-8 w-8 rounded-full border border-indigo-500/30" />
              PAB Wallet
            </h1>
            <p className="mt-1.5 font-body text-sm leading-relaxed" style={{ color: tokens.color.muted }}>
              Earn Pabandi Reliability Tokens — Available on Solana, BNB Chain, and Stellar.
            </p>
          </div>
          <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-2 w-full md:w-auto">
            <Button onClick={() => { setShowSBT(!showSBT); }} variant="outline" className="w-full sm:w-auto justify-center" type="button" style={{
              background: showSBT ? tokens.color.primary : undefined,
              color: showSBT ? '#ffffff' : undefined,
              border: `1px solid ${showSBT ? tokens.color.primary : tokens.color.border}`,
            }}>
              🪙 NFT Badges
            </Button>
            {connected ? (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-3.5 py-3 text-xs font-bold sm:py-2 sm:text-sm" style={{ color: tokens.color.text }}>
                  <span className="inline-block h-1.5 w-1.5 rounded-full shadow-[0_0_8px_var(--color-primary)]" style={{ background: tokens.color.primary }} />
                  {connected.type === 'phantom' ? '👻' : connected.type === 'freighter' ? '🚢' : '🦊'} {shortAddr(connected.address)} · {connected.chainName}
                </div>
                <button onClick={disconnect} className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-red-300 transition-opacity hover:opacity-80 sm:p-2.5 shrink-0">
                  <XMarkIcon className="h-5 w-5 sm:h-4 sm:w-4" />
                </button>
              </div>
            ) : (
              <Button onClick={() => { setShowModal(true); setError(''); }} variant="default" className="w-full sm:w-auto justify-center shadow-sm" type="button">
                <LinkIcon className="h-4 w-4 sm:h-5 sm:w-5 inline mr-2" />Connect Wallet
              </Button>
            )}
          </div>
        </div>

        {showSBT && (
          <Surface className="animate-fade-up mb-8">
            <div className="mb-4">
              <h2 className="font-headline text-xl font-black" style={{ color: tokens.color.text }}>Soulbound Reputation NFTs</h2>
              <p className="mt-1 font-body text-sm" style={{ color: tokens.color.muted }}>
                Non-transferable NFTs that live on Solana forever — your reliability, on-chain. Businesses can verify these.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {SBT_TIERS.map(tier => (
                <SBTCard key={tier.id} tier={tier}
                  earned={totalBookings >= tier.minBookings && showRate >= tier.minRate}
                  totalBookings={totalBookings} showRate={showRate}
                />
              ))}
            </div>
            <div className="mt-4 flex gap-2.5 rounded-xl border border-white/10 bg-white/5 p-4">
              <InformationCircleIcon className="h-5 w-5 shrink-0 mt-0.5 text-indigo-400" />
              <p className="text-xs leading-relaxed" style={{ color: tokens.color.muted }}>
                <strong className="font-bold" style={{ color: tokens.color.text }}>Soulbound tokens</strong> cannot be transferred or sold — they are permanently tied to your wallet address. This makes them a verifiable, tamper-proof proof of your Pabandi reliability history on-chain.
              </p>
            </div>
          </Surface>
        )}

        <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-3">

          <div className="flex flex-col gap-4 md:col-span-2">
            <Surface style={{
              padding: '1.5rem', color: '#ffffff', border: '1px solid rgba(129,140,248,0.25)',
              background: `linear-gradient(135deg, ${tokens.color.primary} 0%, rgba(129,140,248,0.35) 100%)`,
            }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%)', backgroundSize: '200% 100%', animation: 'shimmer 4s infinite', pointerEvents: 'none' }} />

              <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="rounded-full bg-black/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur-sm">Pabandi Vault</span>
                    <span className="text-[10px] text-white/70">Off-Chain</span>
                  </div>
                  <div>
                    <span className="font-headline text-4xl font-black text-white sm:text-5xl">{offChainBalance.toLocaleString()}</span>
                    <span className="ml-2 font-headline text-lg text-white/80">PAB</span>
                  </div>
                  <p className="mt-1 font-body text-xs text-white/70">Available for Staking & Direct Booking</p>
                </div>

                <div className="text-right">
                  {connected && offChainBalance > 0 && !transferSuccess && (
                    <Button onClick={() => transferMutation.mutate()} disabled={transferMutation.isLoading} variant="default" className="mt-3 sm:mt-0 w-full sm:w-auto bg-white/20 text-white hover:bg-white/30" type="button">
                      {transferMutation.isLoading ? <><ArrowPathIcon className="h-4 w-4 animate-spin" /> Sending…</> : <>↗ Withdraw to Web3</>}
                    </Button>
                  )}
                  {!connected && (
                    <button onClick={() => { setShowModal(true); setError(''); }} className="mt-3 text-xs text-white/80 hover:text-white sm:text-sm underline underline-offset-2 sm:mt-0">
                      <LinkIcon className="h-4 w-4 inline" /> Connect Web3 wallet
                    </button>
                  )}
                </div>
              </div>

              {transferSuccess && (
                <div className="mt-4 w-full rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur-sm">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold text-white">
                    <CheckCircleIcon className="h-4 w-4 text-[#5fa98c]" />
                    Successfully withdrawn {transferSuccess.amount.toLocaleString()} PAB!
                  </p>
                  {transferSuccess.txHash && (
                    <a href={`https://solscan.io/tx/${transferSuccess.txHash}`} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-1 text-[10px] text-white/70 hover:text-white underline underline-offset-2">
                      View on Solscan <ArrowUpRightIcon className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
            </Surface>

            <Surface>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: tokens.color.muted }}>Web3 Wallet</span>
                    {connected ? (
                      <span className="flex items-center gap-1 text-[10px]" style={{ color: tokens.color.muted }}>
                        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: tokens.color.primary }} />
                        {connected.chainName}
                      </span>
                    ) : (
                      <span className="text-[10px]" style={{ color: tokens.color.muted }}>Not Connected</span>
                    )}
                  </div>
                  <div>
                    <span className="font-headline text-3xl font-black sm:text-4xl" style={{ color: tokens.color.text }}>{onChainBalance.toLocaleString()}</span>
                    <span className="ml-2 font-headline text-base" style={{ color: tokens.color.muted }}>PAB</span>
                  </div>
                  <p className="mt-1 font-body text-xs" style={{ color: tokens.color.muted }}>Self-Custodial Balance</p>
                  <div className="mt-2 w-fit select-all cursor-copy border border-white/10 bg-white/5 px-2 py-1 rounded text-[9px] font-mono" style={{ color: tokens.color.muted }} title="Copy Contract Address">
                    CA: Cc2nwBNc8Zo5e6QwmtV3JQfEi2gTfEYNrDGgxPmGaZLZ
                  </div>
                  <div className="mt-4 flex gap-2">
                    <span className="rounded border border-[#14F195]/20 bg-[#14F195]/10 px-2 py-1 text-[9px] font-bold text-[#14F195]">Solana</span>
                    <span className="rounded border border-[#F3BA2F]/20 bg-[#F3BA2F]/10 px-2 py-1 text-[9px] font-bold text-[#F3BA2F]">BNB Chain</span>
                    <span className="rounded border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-bold" style={{ color: tokens.color.text }}>Stellar</span>
                  </div>
                </div>

                {connected && (
                  <div className="flex flex-col items-end gap-2 mt-4 sm:mt-0 text-right">
                    <button onClick={disconnect} className="flex items-center gap-1 p-1 text-xs transition-colors hover:text-white" style={{ color: tokens.color.muted }}>
                      <XMarkIcon className="h-4 w-4 sm:h-3 sm:w-3" /> Disconnect
                    </button>
                    <span className="font-body text-xs font-bold" style={{ color: tokens.color.muted }}>◎ {shortAddr(connected.address)}</span>
                    {connected.type === 'phantom' ? (
                      <a href={`https://solscan.io/account/${connected.address}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 p-1 text-[11px] underline underline-offset-2 hover:text-white" style={{ color: tokens.color.primary }}>
                        View Account <ArrowUpRightIcon className="h-3 w-3" />
                      </a>
                    ) : connected.type === 'freighter' ? (
                      <a href={`https://stellar.expert/explorer/testnet/account/${connected.address}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 p-1 text-[11px] underline underline-offset-2 hover:text-white" style={{ color: tokens.color.primary }}>
                        View Account <ArrowUpRightIcon className="h-3 w-3" />
                      </a>
                    ) : (
                      <a href={`https://testnet.bscscan.com/address/${connected.address}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 p-1 text-[11px] underline underline-offset-2 hover:text-white" style={{ color: tokens.color.primary }}>
                        View Account <ArrowUpRightIcon className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </Surface>

            <Surface style={{ border: '1px solid rgba(16,185,129,0.35)', background: 'linear-gradient(135deg, rgba(16,185,129,0.05) 0%, rgba(5,150,105,0.05) 100%)' }}>
              <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-400">Halal Staking Pool</span>
                    <span className="text-[10px] text-emerald-500/70">Mudarabah Profit-Share</span>
                  </div>
                  <div>
                    <span className="font-headline text-3xl font-black text-white">{poolStatus?.totalStaked?.toFixed(2) || '0.00'}</span>
                    <span className="ml-2 font-headline text-base text-emerald-400">PAB Staked</span>
                  </div>
                  <p className="mt-1 font-body text-xs text-white/70">Est. Platform Yield: <strong className="text-emerald-400">{poolStatus?.estimatedYield || 0}%</strong></p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    value={stakeAmount || ''}
                    onChange={(e) => setStakeAmount(Number(e.target.value))}
                    placeholder={`Stake PAB (Max: ${offChainBalance})`}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50 sm:py-2.5"
                  />
                  <button onClick={() => setStakeAmount(offChainBalance)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[10px] font-bold uppercase text-emerald-400 hover:text-emerald-300">
                    Max
                  </button>
                </div>
                <Button onClick={() => stakeMutation.mutate(stakeAmount)} disabled={stakeMutation.isLoading || !stakeAmount || stakeAmount <= 0 || stakeAmount > offChainBalance} className="w-full sm:w-auto" type="button">
                  {stakeMutation.isLoading ? 'Staking...' : 'Stake PAB'}
                </Button>
              </div>

              {poolStatus?.positions && poolStatus.positions.length > 0 && (
                <div className="mt-6 border-t border-white/10 pt-6">
                  <p className="mb-3 text-[10px] font-bold text-white/50 uppercase tracking-widest">Active Positions</p>
                  <div className="space-y-2">
                    {poolStatus.positions.map((pos: any) => (
                      <div key={pos.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-black/20 p-3">
                        <div>
                          <p className="text-sm font-bold text-white">{pos.amount} PAB</p>
                          <p className="text-[10px] text-white/50">Staked on {new Date(pos.createdAt).toLocaleDateString()}</p>
                        </div>
                        <Button onClick={() => unstakeMutation.mutate(pos.id)} disabled={unstakeMutation.isLoading} variant="outline" className="px-3 py-1.5 text-[10px]" type="button">
                          {unstakeMutation.isLoading ? '...' : 'Unstake'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Surface>

            <Surface>
              <p className="font-label text-[10px] font-bold uppercase tracking-widest" style={{ color: tokens.color.muted }}>Treasury / Price Defense</p>
              <h3 className="font-headline text-lg font-black" style={{ color: tokens.color.text }}>Held Capital & Liquidity Backstop</h3>
              <p className="mt-1 font-body text-[11px]" style={{ color: tokens.color.muted }}>
                Treasury draws a small tribute from minted rewards to support LP depth, buybacks, and protocol-level defense. The balance below represents accumulated idle capital working for price resilience and revenue generation.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-white/5 p-4">
                  <p className="font-label text-[10px] font-bold" style={{ color: tokens.color.muted }}>Total Treasury</p>
                  <p className="font-headline text-xl font-bold" style={{ color: tokens.color.text }}>{totalTreasury.toLocaleString()} PAB</p>
                </div>
                <div className="rounded-lg bg-white/5 p-4">
                  <p className="font-label text-[10px] font-bold" style={{ color: tokens.color.muted }}>Operating Reserve</p>
                  <p className="font-headline text-xl font-bold" style={{ color: tokens.color.text }}>{treasuryOp.toLocaleString()} PAB</p>
                </div>
                <div className="rounded-lg bg-white/5 p-4">
                  <p className="font-label text-[10px] font-bold" style={{ color: tokens.color.muted }}>LP / Yield Reserve</p>
                  <p className="font-headline text-xl font-bold" style={{ color: tokens.color.text }}>{treasuryLp.toLocaleString()} PAB</p>
                </div>
              </div>
            </Surface>

            <Surface style={{ border: '1px solid rgba(59,130,246,0.35)', background: 'linear-gradient(135deg, rgba(59,130,246,0.05) 0%, rgba(37,99,235,0.05) 100%)' }}>
              <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="rounded-full border border-blue-500/30 bg-blue-500/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-blue-400">Stellar AMM Pool</span>
                    <span className="text-[10px] text-blue-500/70">PAB / BENJI (FOBXX)</span>
                  </div>
                  <div>
                    <span className="font-headline text-3xl font-black text-white">RWA Yield</span>
                  </div>
                  <p className="mt-1 font-body text-xs text-white/70">Earn DEX Trading Fees <strong className="text-blue-400">+ U.S. Treasury Yield</strong></p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="number"
                    value={stellarPabAmount || ''}
                    onChange={(e) => setStellarPabAmount(Number(e.target.value))}
                    placeholder="PAB Amount"
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 sm:w-1/2"
                  />
                  <input
                    type="number"
                    value={stellarOtherAmount || ''}
                    onChange={(e) => setStellarOtherAmount(Number(e.target.value))}
                    placeholder="BENJI Amount"
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 sm:w-1/2"
                  />
                </div>
                <Button onClick={handleStellarLpDeposit} disabled={isStellarLoading || !stellarPabAmount || !stellarOtherAmount} className="w-full" type="button">
                  {isStellarLoading ? 'Depositing...' : 'Provide Liquidity on Stellar'}
                </Button>
              </div>
            </Surface>

            <Surface style={{ border: '1px solid rgba(168,85,247,0.35)', background: 'linear-gradient(135deg, rgba(168,85,247,0.05) 0%, rgba(147,51,234,0.05) 100%)' }}>
              <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="rounded-full border border-purple-500/30 bg-purple-500/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-purple-400">Raydium LP Pool</span>
                    <span className="text-[10px] text-purple-500/70">PAB / SOL</span>
                  </div>
                  <div>
                    <span className="font-headline text-3xl font-black text-white">DEX Yield</span>
                  </div>
                  <p className="mt-1 font-body text-xs text-white/70">High-frequency trading fees on <strong className="text-purple-400">Solana</strong></p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="number"
                    value={solanaPabAmount || ''}
                    onChange={(e) => setSolanaPabAmount(Number(e.target.value))}
                    placeholder="PAB Amount"
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50 sm:w-1/2"
                  />
                  <input
                    type="number"
                    value={solanaOtherAmount || ''}
                    onChange={(e) => setSolanaOtherAmount(Number(e.target.value))}
                    placeholder="SOL Amount"
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50 sm:w-1/2"
                  />
                </div>
                <Button onClick={handleSolanaLpDeposit} disabled={isSolanaLoading || !solanaPabAmount || !solanaOtherAmount} className="w-full" type="button">
                  {isSolanaLoading ? 'Depositing...' : 'Provide Liquidity on Raydium'}
                </Button>
              </div>
            </Surface>
          </div>

          <div className="flex flex-col gap-3">
            {[
              { label: 'Total Earned', value: `${totalEarned} PAB`, color: '#c084fc', bg: 'rgba(192,132,252,0.12)', border: 'rgba(192,132,252,0.2)', sub: 'All time', icon: <TrophyIcon className="h-5 w-5" /> },
              { label: 'USD Value', value: `$${usdValue}`, color: tokens.color.muted, bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.15)', sub: '@ $0.15/PAB', icon: <CurrencyDollarIcon className="h-5 w-5" /> },
              { label: 'Recent Rewards', value: `${rewards.length}`, color: tokens.color.primary, bg: 'rgba(129,140,248,0.08)', border: 'rgba(129,140,248,0.15)', sub: 'Last 20 events', icon: <FireIcon className="h-5 w-5" /> },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-3.5 rounded-2xl border p-4 shadow-sm transition-all hover:shadow-md" style={{ background: tokens.color.surface + 'aa', borderColor: s.border }}>
                <div className="shrink-0 rounded-xl border p-2.5" style={{ background: s.bg, color: s.color, borderColor: s.border }}>{s.icon}</div>
                <div>
                  <p className="font-body text-[10px] font-bold uppercase tracking-widest" style={{ color: tokens.color.muted }}>{s.label}</p>
                  <p className="font-headline text-lg font-black" style={{ color: s.color }}>{s.value}</p>
                  <p className="font-body text-[9px] font-medium" style={{ color: tokens.color.muted }}>{s.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-10">
          <div className="mb-5">
            <h2 className="font-headline text-xl font-black" style={{ color: tokens.color.text }}>Web3 Trust Matrix</h2>
            <p className="mt-1 font-body text-sm" style={{ color: tokens.color.muted }}>
              Transparent, cryptographic proof of the factors powering your Pabandi Reliability Score.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-5 items-stretch">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-3">
              <Surface>
                <div className="flex gap-3">
                  <div className="flex h-fit shrink-0 items-center justify-center rounded-xl border border-indigo-400/20 bg-indigo-500/10 p-2.5 text-indigo-400"><CheckCircleIcon className="h-6 w-6" /></div>
                  <div>
                    <h4 className="font-headline text-sm font-bold" style={{ color: tokens.color.text }}>Historical Proof</h4>
                    <p className="mt-0.5 mb-2 font-body text-xs leading-relaxed" style={{ color: tokens.color.muted }}>On-chain ledger of your bookings and show-up rate.</p>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-indigo-500 px-2 py-0.5 text-xs font-bold text-white">{showRate}% Rate</span>
                      <span className="font-body text-[10px]" style={{ color: tokens.color.muted }}>{totalBookings} Bookings</span>
                    </div>
                  </div>
                </div>
              </Surface>

              <Surface>
                <div className="flex gap-3">
                  <div className="flex h-fit shrink-0 items-center justify-center rounded-xl border border-indigo-400/20 bg-indigo-500/10 p-2.5 text-indigo-400"><FingerPrintIcon className="h-6 w-6" /></div>
                  <div>
                    <h4 className="font-headline text-sm font-bold" style={{ color: tokens.color.text }}>Identity Proof</h4>
                    <p className="mt-0.5 mb-2 font-body text-xs leading-relaxed" style={{ color: tokens.color.muted }}>Government-grade identity verification for ultimate trust.</p>
                    {isKycVerified ? (
                      <span className="inline-flex items-center gap-1 rounded bg-indigo-500 px-2 py-0.5 text-xs font-bold text-white"><ShieldCheckIcon className="h-3 w-3" /> Verified Identity</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-white/5 px-2 py-0.5 text-xs font-bold" style={{ color: tokens.color.muted }}><UserCircleIcon className="h-3 w-3" /> Pseudonymous</span>
                    )}
                  </div>
                </div>
              </Surface>

              <Surface>
                <div className="flex gap-3">
                  <div className="flex h-fit shrink-0 items-center justify-center rounded-xl border border-indigo-400/20 bg-indigo-500/10 p-2.5 text-indigo-400"><ShareIcon className="h-6 w-6" /></div>
                  <div>
                    <h4 className="font-headline text-sm font-bold" style={{ color: tokens.color.text }}>Social Graph</h4>
                    <p className="mt-0.5 mb-2 font-body text-xs leading-relaxed" style={{ color: tokens.color.muted }}>Reputation dynamically synced across global B2B and B2C platforms.</p>
                    {socialPlatformsCount > 0 ? (
                      <div className="flex items-center gap-2">
                        <Badge tone="info">+{socialTrustBoost} pts Boost</Badge>
                        <span className="font-body text-[10px]" style={{ color: tokens.color.muted }}>{socialPlatformsCount} Connected</span>
                      </div>
                    ) : (
                      <span className="rounded bg-white/5 px-2 py-0.5 text-xs font-bold" style={{ color: tokens.color.muted }}>0 Connected</span>
                    )}
                  </div>
                </div>
              </Surface>

              <Surface>
                <div className="flex gap-3">
                  <div className="flex h-fit shrink-0 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10 p-2.5 text-orange-400"><BoltIcon className="h-6 w-6" /></div>
                  <div>
                    <h4 className="font-headline text-sm font-bold" style={{ color: tokens.color.text }}>Web3 Custody</h4>
                    <p className="mt-0.5 mb-2 font-body text-xs leading-relaxed" style={{ color: tokens.color.muted }}>Cryptographic wallet connecting your SBTs to reality.</p>
                    {hasWeb3 ? (
                      <span className="inline-flex items-center gap-1 rounded bg-orange-500 px-2 py-0.5 text-xs font-bold text-white"><LinkIcon className="h-3 w-3" /> Wallet Linked</span>
                    ) : (
                      <span className="rounded bg-white/5 px-2 py-0.5 text-xs font-bold" style={{ color: tokens.color.muted }}>Not Linked</span>
                    )}
                  </div>
                </div>
              </Surface>

              <Surface>
                <div className="flex gap-3">
                  <div className="flex h-fit shrink-0 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-2.5 text-indigo-400"><UsersIcon className="h-6 w-6" /></div>
                  <div>
                    <h4 className="font-headline text-sm font-bold" style={{ color: tokens.color.text }}>Graph Trust</h4>
                    <p className="mt-0.5 mb-2 font-body text-xs leading-relaxed" style={{ color: tokens.color.muted }}>Sybil resistance through network referral scoring.</p>
                    {graphTrustBoost !== 0 ? (
                      <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold text-white ${graphTrustBoost > 0 ? 'bg-indigo-500' : 'bg-red-500'}`}>
                        {graphTrustBoost > 0 ? '+' : ''}{graphTrustBoost} pts
                      </span>
                    ) : (
                      <span className="rounded bg-white/5 px-2 py-0.5 text-xs font-bold" style={{ color: tokens.color.muted }}>No Referral Data</span>
                    )}
                  </div>
                </div>
              </Surface>
            </div>

            <Surface className="flex flex-col items-center justify-center text-center lg:col-span-2" style={{ border: '1px solid rgba(129,140,248,0.25)' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at center, rgba(129,140,248,0.25) 0%, transparent 60%)', opacity: 0.08, pointerEvents: 'none' }} />
              <ShieldCheckIcon className="mb-3 h-12 w-12 drop-shadow-md" style={{ color: tokens.color.primary }} />
              <h3 className="mb-1 font-headline text-sm font-bold" style={{ color: tokens.color.text }}>Standard Trust Score</h3>
              <div className="mt-1 flex items-baseline gap-1 mb-2">
                <span className="font-headline text-6xl font-black drop-shadow-sm" style={{ color: tokens.color.primary }}>{reliabilityScore}</span>
                <span className="font-headline text-xl font-bold" style={{ color: tokens.color.muted }}>/100</span>
              </div>
              <p className="max-w-[200px] font-body text-xs leading-relaxed" style={{ color: tokens.color.muted }}>
                Calculated transparently using your booking history, social graph, and identity proofs.
              </p>
            </Surface>
          </div>
        </div>

        <div className="mb-10">
          <div className="mb-5">
            <h2 className="font-headline text-xl font-black" style={{ color: tokens.color.text }}>Industry-Specific Trust</h2>
            <p className="mt-1 font-body text-sm" style={{ color: tokens.color.muted }}>
              Your reliability rating customized for different business sectors based on resource scarcity and risk.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: 'E-Commerce', score: commerceScore, icon: '🛍️', color: '#0ea5e9' },
              { label: 'Hospitality', score: hospitalityScore, icon: '🏨', color: '#f59e0b' },
              { label: 'Appointments', score: appointmentScore, icon: '📅', color: '#ec4899' },
              { label: 'Freelance', score: freelanceScore, icon: '💻', color: '#8b5cf6' },
            ].map((v) => (
              <Surface key={v.label} className="flex flex-col items-center text-center">
                <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${v.color}10 0%, transparent 100%)`, pointerEvents: 'none' }} />
                <div className="mb-2 text-3xl" style={{ filter: `drop-shadow(0 0 8px ${v.color}40)`, position: 'relative', zIndex: 1 }}>{v.icon}</div>
                <h4 className="font-headline text-sm font-bold" style={{ color: tokens.color.text, position: 'relative', zIndex: 1 }}>{v.label}</h4>
                <div className="mt-2 flex items-baseline gap-1" style={{ position: 'relative', zIndex: 1 }}>
                  <span className="font-headline text-3xl font-black" style={{ color: v.color }}>{v.score}</span>
                  <span className="font-headline text-xs font-bold" style={{ color: tokens.color.muted }}>/100</span>
                </div>
              </Surface>
            ))}
          </div>
        </div>

        {(reliabilityScore ?? 0) >= 90 && (
          <Surface className="mb-10 bg-gradient-to-r from-indigo-500/10 to-indigo-500/10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <TrophyIcon className="h-6 w-6" style={{ color: tokens.color.primary }} />
                  <h2 className="font-headline text-xl font-black" style={{ color: tokens.color.primary }}>Decentralized Peer Jury</h2>
                </div>
                <p className="mt-2 max-w-2xl font-body text-sm" style={{ color: tokens.color.muted }}>
                  Your Trust Score is Elite (&gt;90). You have been granted access to the Decentralized Peer Jury. Review disputes between users and businesses. You will earn PAB tokens for resolving disputes accurately.
                </p>
              </div>
              <Button variant="default" className="shrink-0 shadow hover:opacity-90" type="button">View Active Cases</Button>
            </div>

            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-headline text-sm font-bold" style={{ color: tokens.color.text }}>Case #DIS-9812: Filer vs Hotel California</p>
                <p className="mt-1 text-xs" style={{ color: tokens.color.muted }}>Status: <span className="font-bold text-indigo-400">VOTING</span> • 2/3 Votes needed</p>
              </div>
              <Button variant="outline" className="sm:w-auto" type="button">Review Evidence & Vote</Button>
            </div>
          </Surface>
        )}

        <Surface className="overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-white/10 bg-white/5 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-headline font-black text-lg" style={{ color: tokens.color.text }}>Reward History</h3>
              <p className="mt-0.5 font-body text-[11px] font-medium" style={{ color: tokens.color.muted }}>Every PAB earned, logged on-chain</p>
            </div>
            <button onClick={() => refetch()} className="flex w-fit items-center gap-2 rounded-lg p-2 transition-colors hover:bg-white/5">
              <ArrowPathIcon className="h-5 w-5" style={{ color: tokens.color.muted }} />
            </button>
          </div>
          {rewards.length > 0 ? (
            <div className="divide-y" style={{ borderColor: tokens.color.borderSubtle }}>
              {rewards.map((r: any, i: number) => <RewardRow key={r.id} reward={r} index={i} />)}
            </div>
          ) : (
            <div className="py-12 text-center" style={{ background: tokens.color.surface }}>
              <BoltIcon className="mx-auto mb-3 h-10 w-10 opacity-50" style={{ color: tokens.color.muted }} />
              <p className="font-headline mb-1 font-bold" style={{ color: tokens.color.text }}>No rewards yet</p>
              <p className="font-body text-xs" style={{ color: tokens.color.muted }}>Complete bookings to earn your first PAB tokens</p>
            </div>
          )}
        </Surface>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="w-full max-w-sm animate-fade-scale rounded-3xl border border-indigo-500/20 bg-[#0f172a] p-6 shadow-xl">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-headline text-xl font-black" style={{ color: tokens.color.text }}>Connect Wallet</h2>
                <p className="mt-1 font-body text-[11px] font-medium" style={{ color: tokens.color.muted }}>Solana recommended · Required for $PAB</p>
              </div>
              <button onClick={() => setShowModal(false)} className="self-start rounded-xl bg-white/5 p-1.5 transition-colors hover:bg-white/10">
                <XMarkIcon className="h-5 w-5" style={{ color: tokens.color.muted }} />
              </button>
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 font-body text-xs font-medium text-red-300">
                <ExclamationTriangleIcon className="h-4 w-4 shrink-0 mt-0.5 text-red-400" /> {error}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <WalletOption id="btn-connect-phantom" icon="👻" name="Phantom" desc="Recommended · Solana network for $PAB" badge="Solana" onClick={connectPhantom} loading={loadingWallet === 'phantom'} disabled={!!loadingWallet && loadingWallet !== 'phantom'} />
              <WalletOption id="btn-connect-freighter" icon="🚢" name="Freighter" desc="Stellar network · Franklin Templeton FOBXX" badge="Stellar" onClick={connectFreighter} loading={loadingWallet === 'freighter'} disabled={!!loadingWallet && loadingWallet !== 'freighter'} />
              <WalletOption id="btn-connect-metamask" icon="🦊" name="MetaMask" desc="BNB Smart Chain · Legacy support" badge="BSC" onClick={connectMetaMask} loading={loadingWallet === 'metamask'} disabled={!!loadingWallet && loadingWallet !== 'metamask'} />
            </div>

            <p className="mt-6 text-center font-body text-[10px] leading-relaxed px-4" style={{ color: tokens.color.muted }}>
              By connecting, you agree to our <a href="#" className="font-bold hover:underline" style={{ color: tokens.color.primary }}>Terms</a>.
              <br />Your wallet address is stored securely and never shared.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
