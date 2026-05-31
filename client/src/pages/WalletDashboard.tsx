import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'react-query';
import {
  WalletIcon, ArrowUpRightIcon,
  StarIcon, LinkIcon, XMarkIcon, CheckCircleIcon,
  ExclamationTriangleIcon, BoltIcon, ShieldCheckIcon,
  TrophyIcon, FireIcon, CurrencyDollarIcon,
  ArrowPathIcon, InformationCircleIcon,
} from '@heroicons/react/24/outline';
import apiClient, { cryptoService } from '../services/api';

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
  { id: 'silver', label: 'Silver Reliable', minBookings: 5, minRate: 80, color: '#C0C0C0', glow: 'rgba(192,192,192,0.3)', icon: '🥈', desc: 'Consistent performer — businesses trust you' },
  { id: 'gold', label: 'Gold Trustee', minBookings: 10, minRate: 90, color: '#FFB830', glow: 'rgba(255,184,48,0.4)', icon: '🥇', desc: 'Top-tier reliability, rare and respected' },
  { id: 'platinum', label: 'Platinum Oracle', minBookings: 25, minRate: 97, color: '#00E5FF', glow: 'rgba(0,229,255,0.4)', icon: '💎', desc: 'Elite. Less than 3% of users ever reach this' },
];

/* ── Soulbound NFT Card ── */
function SBTCard({ tier, earned, totalBookings, showRate }: {
  tier: typeof SBT_TIERS[0]; earned: boolean; totalBookings: number; showRate: number;
}) {
  const [minting, setMinting] = useState(false);
  const [minted, setMinted] = useState(false);

  const handleMint = async () => {
    if (!earned || minted) return;
    setMinting(true);
    await new Promise(r => setTimeout(r, 2000)); // simulated mint
    setMinted(true);
    setMinting(false);
  };

  const bookingsNeeded = Math.max(0, tier.minBookings - totalBookings);
  const rateNeeded = Math.max(0, tier.minRate - showRate);
  const progress = earned ? 100 : Math.round(Math.min(totalBookings / tier.minBookings, 1) * 50 + Math.min(showRate / tier.minRate, 1) * 50);

  return (
    <div style={{
      borderRadius: '1.25rem', padding: '1.5rem',
      background: earned ? `linear-gradient(135deg, ${tier.color}12, rgba(12,20,38,0.95))` : 'var(--color-surface)',
      border: `1px solid ${earned ? tier.color + '40' : 'rgba(255,255,255,0.06)'}`,
      boxShadow: earned ? `0 0 40px ${tier.glow}, 0 12px 40px rgba(0,0,0,0.4)` : '0 4px 20px rgba(0,0,0,0.3)',
      opacity: earned ? 1 : 0.7,
      transition: 'all 0.3s ease',
      position: 'relative', overflow: 'hidden',
    }}>
      {earned && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: `radial-gradient(${tier.color}08 1px, transparent 1px)`,
          backgroundSize: '20px 20px',
        }} />
      )}

      {/* Icon */}
      <div style={{ fontSize: 36, marginBottom: 12, filter: earned ? `drop-shadow(0 0 8px ${tier.color})` : 'grayscale(100%) opacity(0.5)' }}>
        {tier.icon}
      </div>

      <h3 style={{ fontSize: '1rem', fontWeight: 800, color: earned ? tier.color : 'var(--color-text-muted)', marginBottom: 4, fontFamily: 'Space Grotesk, sans-serif' }}>
        {tier.label}
      </h3>
      <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 14, lineHeight: 1.5 }}>{tier.desc}</p>

      {/* Requirements */}
      <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-text-muted)' }}>
          <span>Bookings: {totalBookings} / {tier.minBookings}</span>
          <span style={{ color: totalBookings >= tier.minBookings ? tier.color : 'var(--color-text-muted)' }}>
            {totalBookings >= tier.minBookings ? '✓' : `${bookingsNeeded} more`}
          </span>
        </div>
        <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
          <div style={{ height: '100%', borderRadius: 2, background: tier.color, width: `${Math.min(totalBookings / tier.minBookings * 100, 100)}%`, transition: 'width 1s ease', boxShadow: `0 0 6px ${tier.color}` }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-text-muted)' }}>
          <span>Show rate: {showRate}% / {tier.minRate}%</span>
          <span style={{ color: showRate >= tier.minRate ? tier.color : 'var(--color-text-muted)' }}>
            {showRate >= tier.minRate ? '✓' : `${rateNeeded}% gap`}
          </span>
        </div>
        <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
          <div style={{ height: '100%', borderRadius: 2, background: tier.color, width: `${Math.min(showRate / tier.minRate * 100, 100)}%`, transition: 'width 1s ease', boxShadow: `0 0 6px ${tier.color}` }} />
        </div>
      </div>

      {/* Mint / Status button */}
      {earned ? (
        minted ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: tier.color }}>
            <CheckCircleIcon className="h-4 w-4" /> Soulbound NFT Minted ✓
          </div>
        ) : (
          <button onClick={handleMint} disabled={minting} style={{
            width: '100%', padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: 'pointer',
            background: `linear-gradient(135deg, ${tier.color}30, ${tier.color}15)`,
            color: tier.color, border: `1px solid ${tier.color}50`,
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
        <div style={{ padding: '8px 0', fontSize: 10, color: 'var(--color-text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          🔒 LOCKED — Keep booking to unlock
        </div>
      )}
    </div>
  );
}

/* ── Reward Row ── */
function RewardRow({ reward, index }: { reward: any; index: number }) {
  const isReview = reward.type === 'GOOGLE_REVIEW';
  const isBusiness = reward.type?.startsWith('BUSINESS_');
  const color = isReview ? '#FFB830' : isBusiness ? '#6C63FF' : '#00FFB0';
  const glow = isReview ? 'rgba(255,184,48,0.2)' : isBusiness ? 'rgba(108,99,255,0.2)' : 'rgba(0,255,176,0.2)';
  const label = isReview ? 'Proof of Review' : isBusiness ? reward.type?.replace('BUSINESS_', '').replace(/_/g, ' ') : 'Proof of Reservation';
  const icon = isReview ? <StarIcon className="h-4 w-4" /> : isBusiness ? <BoltIcon className="h-4 w-4" /> : <CheckCircleIcon className="h-4 w-4" />;

  return (
    <div className="animate-fade-up" style={{
      animationDelay: `${index * 40}ms`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
      transition: 'background 0.2s',
    }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: `${color}15`, color, border: `1px solid ${color}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 10px ${glow}`,
        }}>{icon}</div>
        <div>
          <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#e8eef8' }}>{label}</p>
          <p style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            {reward.businessName || 'Pabandi'} · {reward.createdAt ? new Date(reward.createdAt).toLocaleDateString() : ''}
          </p>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 800, color, textShadow: `0 0 10px ${glow}` }}>+{reward.amount} PAB</span>
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
      className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      onMouseEnter={e => {
        if (!disabled && !loading) {
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(108,99,255,0.4)';
          (e.currentTarget as HTMLElement).style.background = 'rgba(108,99,255,0.06)';
        }
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)';
        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
      }}
    >
      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {loading ? <span style={{ width: 20, height: 20, border: '2px solid rgba(108,99,255,0.3)', borderTopColor: '#6C63FF', borderRadius: '50%', display: 'inline-block', animation: 'rotateSlow 0.8s linear infinite' }} /> : icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span style={{ fontWeight: 700, fontSize: 14, color: '#e8eef8' }}>{name}</span>
          {badge && <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 9999, fontWeight: 700, background: 'rgba(108,99,255,0.15)', color: '#a5b4fc', border: '1px solid rgba(108,99,255,0.2)' }}>{badge}</span>}
        </div>
        <p style={{ fontSize: 11, marginTop: 2, color: 'var(--color-text-muted)' }}>{desc}</p>
      </div>
      <ArrowUpRightIcon className="h-4 w-4 flex-shrink-0" style={{ color: '#6C63FF', opacity: 0.6 }} />
    </button>
  );
}

/* ── Main Component ── */
const WalletDashboard: React.FC = () => {
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
      const solana = (window as any).solana;
      if (!solana?.isPhantom) throw new Error('Phantom wallet not found. Please install the Phantom extension.');
      const resp = await solana.connect();
      const address: string = resp.publicKey.toString();
      saveWallet({ address, type: 'phantom', chainName: 'Solana' });
      await cryptoService.connectSolana(address).catch(() => { });
      setShowModal(false);
    } catch (err: any) { setError(err?.message || 'Connection failed.'); }
    finally { setLoadingWallet(null); }
  };

  const transferMutation = useMutation(() => cryptoService.requestSolanaTransfer(), {
    onSuccess: () => alert('✅ Transfer queued to your Solana wallet! It may take a few minutes.')
  });

  const { data: wallet, isLoading, refetch } = useQuery('pab-wallet', async () => {
    const res = await cryptoService.getWallet();
    return res.data?.data;
  }, { retry: false, refetchOnWindowFocus: false });

  const balance = Number(wallet?.balance || 0);
  const usdValue = (balance * 0.15).toFixed(2);
  const totalEarned = wallet?.totalEarned || 0;
  const rewards = wallet?.recentRewards || [];

  // Mock reliability stats for SBT (would come from analytics in production)
  const totalBookings = rewards.filter((r: any) => r.type === 'RESERVATION_COMPLETION').length;
  const showRate = totalBookings > 0 ? Math.min(95, 70 + totalBookings * 2) : 0;

  if (isLoading) return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(108,99,255,0.2)', borderTopColor: '#6C63FF', borderRadius: '50%', animation: 'rotateSlow 0.8s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Loading wallet…</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', color: 'var(--color-text)' }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* ── Header ── */}
        <div className="animate-fade-up flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
          <div>
            <h1 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 900, color: '#e8eef8', fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '-0.02em' }}>
              ⚡ PAB Wallet
            </h1>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
              Earn Pabandi Reliability Tokens — withdraw on Solana, mint NFT badges
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => { setShowSBT(!showSBT); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700,
                padding: '10px 16px', borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s',
                background: showSBT ? 'rgba(255,184,48,0.15)' : 'rgba(255,255,255,0.04)',
                color: showSBT ? '#FFB830' : 'var(--color-text-muted)',
                border: `1px solid ${showSBT ? 'rgba(255,184,48,0.3)' : 'rgba(255,255,255,0.07)'}`,
              }}>
              🪙 NFT Badges
            </button>
            {connected ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                  background: 'rgba(0,255,176,0.08)', border: '1px solid rgba(0,255,176,0.2)', color: '#00FFB0',
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00FFB0', boxShadow: '0 0 8px #00FFB0', display: 'inline-block' }} />
                  {connected.type === 'phantom' ? '👻' : '🦊'} {shortAddr(connected.address)} · {connected.chainName}
                </div>
                <button onClick={disconnect} style={{ padding: '8px', borderRadius: 8, cursor: 'pointer', background: 'rgba(255,76,106,0.08)', color: '#FF4C6A', border: '1px solid rgba(255,76,106,0.2)' }}>
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button id="btn-connect-wallet" onClick={() => { setShowModal(true); setError(''); }} className="btn-primary text-sm" style={{ padding: '10px 18px' }}>
                <LinkIcon className="h-4 w-4 inline mr-2" />Connect Wallet
              </button>
            )}
          </div>
        </div>

        {/* ── SBT Panel ── */}
        {showSBT && (
          <div className="animate-fade-up mb-8">
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#e8eef8', fontFamily: 'Space Grotesk, sans-serif' }}>Soulbound Reputation NFTs</h2>
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
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
            <div style={{ marginTop: 12, padding: '10px 16px', borderRadius: 10, background: 'rgba(108,99,255,0.06)', border: '1px solid rgba(108,99,255,0.15)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <InformationCircleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#6C63FF' }} />
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                <strong style={{ color: '#a5b4fc' }}>Soulbound tokens</strong> cannot be transferred or sold — they are permanently tied to your wallet address. This makes them a verifiable, tamper-proof proof of your Pabandi reliability history on-chain.
              </p>
            </div>
          </div>
        )}

        {/* ── Balance Cards ── */}
        <div className="animate-fade-up-delay-1 grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">

          {/* Main Balance */}
          <div className="md:col-span-2 relative overflow-hidden" style={{
            borderRadius: '1.25rem', padding: '1.75rem',
            background: 'linear-gradient(135deg, rgba(108,99,255,0.35) 0%, rgba(0,229,255,0.15) 60%, rgba(12,20,38,0.95) 100%)',
            border: '1px solid rgba(108,99,255,0.3)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 60px rgba(108,99,255,0.08)',
          }}>
            {/* Shimmer */}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.03) 50%, transparent 100%)', backgroundSize: '200% 100%', animation: 'shimmer 3s infinite', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', width: 200, height: 200, top: -60, right: -40, borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,99,255,0.25), transparent)', filter: 'blur(30px)', pointerEvents: 'none' }} />

            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div style={{ padding: '8px', borderRadius: 10, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  <WalletIcon className="h-5 w-5" style={{ color: '#fff' }} />
                </div>
                <span style={{ fontSize: 9, fontWeight: 800, padding: '4px 10px', borderRadius: 9999, background: 'rgba(255,255,255,0.12)', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Active Balance</span>
              </div>
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 900, color: '#fff', fontFamily: 'Space Grotesk, sans-serif' }}>{balance.toLocaleString()}</span>
                <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.7)', marginLeft: 8 }}>PAB</span>
              </div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 16 }}>≈ ${usdValue} USD · Based on PAB/USDT rate</p>

              {connected ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}>◎ {shortAddr(connected.address)} · Solana</span>
                  {connected.type === 'phantom' && balance > 0 && (
                    <button type="button" onClick={() => transferMutation.mutate()} disabled={transferMutation.isLoading}
                      style={{
                        fontSize: 11, fontWeight: 700, padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                        background: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)',
                        display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.2s',
                      }}>
                      {transferMutation.isLoading ? <><ArrowPathIcon className="h-3 w-3 animate-spin" /> Sending…</> : <>↗ Withdraw to Solana</>}
                    </button>
                  )}
                </div>
              ) : (
                <button onClick={() => { setShowModal(true); setError(''); }}
                  style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', textDecoration: 'underline' }}>
                  <LinkIcon className="h-3 w-3" /> Connect Phantom to withdraw
                </button>
              )}
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Total Earned', value: `${totalEarned} PAB`, color: '#00FFB0', sub: 'All time', icon: <TrophyIcon className="h-4 w-4" /> },
              { label: 'USD Value', value: `$${usdValue}`, color: '#FFB830', sub: '@ $0.15/PAB', icon: <CurrencyDollarIcon className="h-4 w-4" /> },
              { label: 'Recent Rewards', value: `${rewards.length}`, color: '#6C63FF', sub: 'Last 20 events', icon: <FireIcon className="h-4 w-4" /> },
            ].map(s => (
              <div key={s.label} style={{
                flex: 1, background: 'var(--color-surface)', border: `1px solid ${s.color}20`,
                borderRadius: '1rem', padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
                transition: 'all 0.2s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = s.color + '40'; (e.currentTarget as HTMLElement).style.transform = 'translateX(2px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = s.color + '20'; (e.currentTarget as HTMLElement).style.transform = 'translateX(0)'; }}
              >
                <div style={{ color: s.color, background: `${s.color}12`, padding: 8, borderRadius: 8, border: `1px solid ${s.color}20`, flexShrink: 0 }}>{s.icon}</div>
                <div>
                  <p style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{s.label}</p>
                  <p style={{ fontSize: '1.1rem', fontWeight: 900, color: s.color, fontFamily: 'Space Grotesk, sans-serif' }}>{s.value}</p>
                  <p style={{ fontSize: 9, color: 'var(--color-text-dim)' }}>{s.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Web3 Tech Explainer ── */}
        <div className="animate-fade-up-delay-2 grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[
            { icon: '🛡️', title: 'Soulbound Identity', desc: 'Your reliability score minted as a non-transferable NFT — permanently yours on Solana.', color: '#6C63FF' },
            { icon: '⚡', title: 'Smart Contract Escrow', desc: 'Deposits held trustlessly on-chain. Auto-release on completion. Zero chargebacks.', color: '#00E5FF' },
            { icon: '🗳️', title: 'DAO Governance', desc: 'Hold PAB = vote on platform rules. Deposit thresholds, risk parameters — community-owned.', color: '#00FFB0', badge: 'Coming Soon' },
          ].map(s => (
            <div key={s.title} style={{
              background: 'var(--color-surface)', border: `1px solid ${s.color}18`,
              borderRadius: '1rem', padding: '1.25rem', position: 'relative', overflow: 'hidden',
            }}>
              {s.badge && <span style={{ position: 'absolute', top: 12, right: 12, fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 9999, background: `${s.color}15`, color: s.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.badge}</span>}
              <div style={{ fontSize: 24, marginBottom: 10 }}>{s.icon}</div>
              <h3 style={{ fontSize: 13, fontWeight: 800, color: s.color, marginBottom: 6, fontFamily: 'Space Grotesk, sans-serif' }}>{s.title}</h3>
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>{s.desc}</p>
            </div>
          ))}
        </div>

        {/* ── Rewards History ── */}
        <div className="animate-fade-up-delay-2" style={{ background: 'var(--color-surface)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '1.25rem', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontWeight: 800, color: '#e8eef8', fontFamily: 'Space Grotesk, sans-serif', fontSize: '1rem' }}>Reward History</h3>
              <p style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 1 }}>Every PAB earned, logged on-chain</p>
            </div>
            <button onClick={() => refetch()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#6C63FF'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)'}>
              <ArrowPathIcon className="h-4 w-4" />
            </button>
          </div>
          {rewards.length > 0 ? (
            rewards.map((r: any, i: number) => <RewardRow key={r.id} reward={r} index={i} />)
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
              <BoltIcon className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--color-text-dim)' }} />
              <p style={{ fontWeight: 600, marginBottom: 4 }}>No rewards yet</p>
              <p style={{ fontSize: 12 }}>Complete bookings to earn your first PAB tokens</p>
            </div>
          )}
        </div>

      </div>

      {/* ── Connect Wallet Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="animate-fade-scale w-full max-w-sm" style={{
            background: 'rgba(11,18,32,0.95)', backdropFilter: 'blur(20px)',
            border: '1px solid rgba(108,99,255,0.25)', borderRadius: '1.5rem', padding: '1.5rem',
            boxShadow: '0 40px 80px rgba(0,0,0,0.6), 0 0 60px rgba(108,99,255,0.08)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#e8eef8', fontFamily: 'Space Grotesk, sans-serif' }}>Connect Your Wallet</h2>
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 3 }}>Solana recommended · Required for $PAB withdrawals</p>
              </div>
              <button onClick={() => setShowModal(false)} style={{ padding: 6, borderRadius: 8, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--color-text-muted)' }}>
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 8, background: 'rgba(255,76,106,0.1)', border: '1px solid rgba(255,76,106,0.2)', color: '#fca5a5', fontSize: 12 }}>
                <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#FF4C6A' }} /> {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <WalletOption id="btn-connect-phantom" icon="👻" name="Phantom" desc="Recommended · Solana network for $PAB" badge="Solana" onClick={connectPhantom} loading={loadingWallet === 'phantom'} disabled={loadingWallet !== null && loadingWallet !== 'phantom'} />
              <WalletOption id="btn-connect-metamask" icon="🦊" name="MetaMask" desc="BNB Smart Chain · Legacy support" badge="BSC" onClick={connectMetaMask} loading={loadingWallet === 'metamask'} disabled={loadingWallet !== null && loadingWallet !== 'metamask'} />
            </div>

            <p style={{ textAlign: 'center', fontSize: 10, marginTop: 16, color: 'var(--color-text-dim)', lineHeight: 1.5 }}>
              By connecting, you agree to our <a href="#" style={{ color: '#6C63FF', textDecoration: 'underline' }}>Terms</a>.
              <br />Your wallet address is stored securely and never shared.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletDashboard;
