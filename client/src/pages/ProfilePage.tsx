import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { useAuthStore } from '../store/authStore';
import { reservationService, cryptoService, socialService } from '../services/api';
import {
  CalendarIcon,
  StarIcon,
  ShieldCheckIcon,
  PencilIcon,
  CheckBadgeIcon,
  BoltIcon,
  TrophyIcon,
  FireIcon,
  HeartIcon,
  CheckCircleIcon,
  XCircleIcon,
  GiftIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { ScoreReceipts } from '../components/ScoreReceipts';

// ─────────────────────────────────────────────────────────────────────────────
// Loyalty tier definitions (Pabandi-global)
// ─────────────────────────────────────────────────────────────────────────────
const LOYALTY_TIERS = [
  {
    id: 'guest',
    name: 'Guest',
    emoji: '🌱',
    color: '#6b7280',
    glow: 'rgba(107,114,128,0.2)',
    minBookings: 0,
    minShowRate: 0,
    perks: [
      'Access to all listed businesses',
      'Standard booking priority',
      'Basic PAB token earnings',
    ],
    pabBonus: 0,
    badge: null,
  },
  {
    id: 'bronze',
    name: 'Bronze Patron',
    emoji: '🥉',
    color: '#CD7F32',
    glow: 'rgba(205,127,50,0.25)',
    minBookings: 1,
    minShowRate: 70,
    perks: [
      '+10 bonus PAB per completed booking',
      'Priority customer support',
      'Early access to new businesses',
      'Bronze badge on your profile',
    ],
    pabBonus: 10,
    badge: 'Bronze',
  },
  {
    id: 'silver',
    name: 'Silver Reliable',
    emoji: '🥈',
    color: '#8A9BB0',
    glow: 'rgba(138,155,176,0.25)',
    minBookings: 5,
    minShowRate: 80,
    perks: [
      '+15 bonus PAB per completed booking',
      'Extended cancellation window (30 min before)',
      'Verified Reliable badge shown to businesses',
      'Access to Silver-only deals',
    ],
    pabBonus: 15,
    badge: 'Silver',
  },
  {
    id: 'gold',
    name: 'Gold Trustee',
    emoji: '🥇',
    color: '#D97706',
    glow: 'rgba(217,119,6,0.25)',
    minBookings: 10,
    minShowRate: 90,
    perks: [
      '+25 bonus PAB per completed booking',
      'Booking deposits waived at select businesses',
      'VIP badge displayed to business owners',
      'Skip-the-queue booking at peak times',
      'Dedicated Gold concierge line',
    ],
    pabBonus: 25,
    badge: 'Gold',
  },
  {
    id: 'platinum',
    name: 'Platinum Oracle',
    emoji: '💎',
    color: '#0284C7',
    glow: 'rgba(2,132,199,0.25)',
    minBookings: 25,
    minShowRate: 97,
    perks: [
      '+40 bonus PAB per completed booking',
      'Instant booking confirmations (no wait)',
      'All deposits permanently waived',
      'Featured customer status with businesses',
      'Exclusive Platinum-only events and offers',
      'Personal Pabandi concierge',
    ],
    pabBonus: 40,
    badge: 'Platinum',
  },
] as const;

type LoyaltyTier = typeof LOYALTY_TIERS[number];

function computeLoyaltyTier(
  totalBookings: number,
  showRate: number
): { current: LoyaltyTier; next: LoyaltyTier | null; progressToNext: number } {
  let current: LoyaltyTier = LOYALTY_TIERS[0];
  for (const tier of LOYALTY_TIERS) {
    if (totalBookings >= tier.minBookings && showRate >= tier.minShowRate) {
      current = tier as LoyaltyTier;
    }
  }
  const currentIndex = LOYALTY_TIERS.indexOf(current as any);
  const next = currentIndex < LOYALTY_TIERS.length - 1 ? LOYALTY_TIERS[currentIndex + 1] : null;

  let progressToNext = 0;
  if (next) {
    const bookingProg = next.minBookings > 0
      ? Math.min(totalBookings / next.minBookings, 1) * 100
      : 100;
    const rateProg = next.minShowRate > 0
      ? Math.min(showRate / next.minShowRate, 1) * 100
      : 100;
    progressToNext = Math.round((bookingProg + rateProg) / 2);
  } else {
    progressToNext = 100;
  }

  return { current, next: next as LoyaltyTier | null, progressToNext };
}

// ─────────────────────────────────────────────────────────────────────────────
// Toast notification
// ─────────────────────────────────────────────────────────────────────────────
interface Toast { id: number; message: string; type: 'success' | 'error' | 'info'; }

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-bold animate-in slide-in-from-right-4 fade-in duration-300 ${
            t.type === 'success' ? 'bg-tertiary-fixed text-on-tertiary-fixed border-tertiary/20' :
            t.type === 'error'   ? 'bg-error-container text-on-error-container border-error/20' :
                                   'bg-primary-container text-on-primary-container border-primary/20'
          }`}
        >
          {t.type === 'success' ? <CheckCircleIcon className="h-4 w-4 shrink-0" /> :
           t.type === 'error'   ? <XCircleIcon     className="h-4 w-4 shrink-0" /> :
                                  <BoltIcon        className="h-4 w-4 shrink-0" />}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Arc Gauge
// ─────────────────────────────────────────────────────────────────────────────
function ArcGauge({ value, max = 100, color, label }: { value: number; max?: number; color: string; label: string }) {
  const pct = Math.min(value / max, 1);
  const circumference = 2 * Math.PI * 42;
  const dash = pct * circumference;
  return (
    <div className="relative w-[120px] h-[120px]">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" className="text-surface-variant opacity-30" strokeWidth="9" />
        <circle cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[1.3rem] font-black leading-none" style={{ color }}>{value}</span>
        <span className="text-[9px] font-semibold text-on-surface-variant uppercase tracking-wider mt-1">{label}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Achievement Badge
// ─────────────────────────────────────────────────────────────────────────────
function AchievementBadge({ icon, label, description, earned, colorClass, bgClass }: {
  icon: React.ReactNode; label: string; description: string; earned: boolean; colorClass: string; bgClass: string;
}) {
  return (
    <div className={`flex flex-col items-center gap-2 p-4 rounded-xl text-center transition-all ${earned ? `${bgClass} border border-outline-variant/30` : 'bg-surface-container-lowest border border-outline-variant/10 opacity-50 cursor-not-allowed'}`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${earned ? `${colorClass} ${bgClass} border border-outline-variant/10 shadow-sm` : 'bg-surface-container-low text-outline'}`}>
        {icon}
      </div>
      <div>
        <p className={`text-[11px] font-bold tracking-wide ${earned ? colorClass : 'text-on-surface-variant'}`}>{label}</p>
        <p className="text-[9px] text-on-surface-variant mt-0.5 leading-relaxed">{description}</p>
      </div>
      {earned && (
        <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest mt-1 ${bgClass} ${colorClass}`}>
          Earned
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Booking Timeline Item
// ─────────────────────────────────────────────────────────────────────────────
function BookingItem({ reservation, index }: { reservation: any; index: number }) {
  const statusColors: Record<string, { colorClass: string; bgClass: string; label: string }> = {
    CONFIRMED: { colorClass: 'text-tertiary', bgClass: 'bg-tertiary-fixed', label: 'Confirmed' },
    COMPLETED: { colorClass: 'text-primary', bgClass: 'bg-primary-container', label: 'Completed' },
    CANCELLED: { colorClass: 'text-on-surface-variant', bgClass: 'bg-surface-variant', label: 'Cancelled' },
    NO_SHOW:   { colorClass: 'text-error', bgClass: 'bg-error-container', label: 'No-Show' },
    PENDING:   { colorClass: 'text-secondary', bgClass: 'bg-secondary-container', label: 'Pending' },
  };
  const sc = statusColors[reservation.status] || statusColors.PENDING;
  const date = new Date(reservation.reservationDate);
  const month = date.toLocaleString('default', { month: 'short' }).toUpperCase();
  const day = date.getDate();

  return (
    <div className="flex items-start gap-4 py-4 border-b border-outline-variant/20 animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="w-11 shrink-0 text-center bg-surface-container-lowest border border-outline-variant/30 rounded-lg py-1.5 shadow-sm">
        <div className={`text-[9px] font-bold tracking-wider ${sc.colorClass}`}>{month}</div>
        <div className="text-[1.1rem] font-black text-on-surface leading-none mt-0.5 font-headline">{day}</div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-on-surface mb-0.5 truncate font-headline">
          {reservation.business?.name || 'Booking'}
        </p>
        <p className="text-[11px] text-on-surface-variant font-body">
          {reservation.reservationTime} · {reservation.numberOfGuests} guest{reservation.numberOfGuests !== 1 ? 's' : ''}
        </p>
      </div>
      <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${sc.bgClass} ${sc.colorClass} border border-outline-variant/10 shadow-sm whitespace-nowrap`}>
        {sc.label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loyalty Tab
// ─────────────────────────────────────────────────────────────────────────────
function LoyaltyTab({
  totalBookings,
  showRate,
  pabBalance,
  streak,
}: {
  totalBookings: number;
  showRate: number;
  pabBalance: number;
  streak: number;
}) {
  const { current, next, progressToNext } = computeLoyaltyTier(totalBookings, showRate);

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="relative p-6 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${current.color}18, transparent)`,
          borderBottom: `1px solid ${current.color}25`,
        }}
      >
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full pointer-events-none opacity-10"
          style={{ background: `radial-gradient(circle, ${current.color}, transparent)` }} />

        <div className="relative flex items-center gap-4 flex-wrap">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-md shrink-0"
            style={{
              background: `linear-gradient(135deg, ${current.color}30, ${current.color}10)`,
              border: `1.5px solid ${current.color}40`,
              boxShadow: `0 0 20px ${current.glow}`,
            }}
          >
            {current.emoji}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-on-surface font-headline">{current.name}</h2>
              <span
                className="text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest"
                style={{ background: `${current.color}20`, color: current.color, border: `1px solid ${current.color}30` }}
              >
                Current Tier
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1.5 flex-wrap">
              <span className="text-[11px] text-on-surface-variant font-medium">
                🔥 {streak} booking streak
              </span>
              <span className="text-[11px] text-on-surface-variant font-medium">
                ⚡ {pabBalance.toLocaleString()} PAB earned
              </span>
            </div>
          </div>
          {current.pabBonus > 0 && (
            <div className="text-center bg-surface-container-lowest rounded-xl px-4 py-2.5 border border-outline-variant/20 shadow-sm">
              <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wider">Bonus per booking</p>
              <p className="text-xl font-black font-headline" style={{ color: current.color }}>+{current.pabBonus}</p>
              <p className="text-[9px] text-on-surface-variant">PAB tokens</p>
            </div>
          )}
        </div>
      </div>

      {/* Progress to next tier */}
      {next && (
        <div className="px-6 py-5 border-b border-outline-variant/15">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-bold text-on-surface">
                Progress to {next.emoji} <span style={{ color: next.color }}>{next.name}</span>
              </p>
              <p className="text-[10px] text-on-surface-variant mt-0.5">
                {next.minBookings > totalBookings && `${next.minBookings - totalBookings} more bookings`}
                {next.minBookings > totalBookings && next.minShowRate > showRate && ' · '}
                {next.minShowRate > showRate && `${next.minShowRate - showRate}% show rate gap`}
              </p>
            </div>
            <span className="text-sm font-black font-headline" style={{ color: next.color }}>
              {progressToNext}%
            </span>
          </div>
          <div className="h-2.5 bg-surface-container rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{
                width: `${progressToNext}%`,
                background: `linear-gradient(90deg, ${current.color}, ${next.color})`,
                boxShadow: `0 0 8px ${next.color}60`,
              }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[9px] text-on-surface-variant">{totalBookings} bookings</span>
            <span className="text-[9px] text-on-surface-variant">{next.minBookings} needed</span>
          </div>
        </div>
      )}

      {/* Tier Ladder */}
      <div className="p-6">
        <h3 className="text-sm font-black text-on-surface font-headline mb-4">All Loyalty Tiers</h3>
        <div className="space-y-3">
          {LOYALTY_TIERS.map((tier, idx) => {
            const isEarned = totalBookings >= tier.minBookings && showRate >= tier.minShowRate;
            const isCurrent = tier.id === current.id;

            return (
              <div
                key={tier.id}
                className="rounded-xl border transition-all duration-200"
                style={{
                  background: isCurrent ? `${tier.color}10` : isEarned ? `${tier.color}06` : undefined,
                  borderColor: isCurrent ? `${tier.color}40` : isEarned ? `${tier.color}25` : undefined,
                  boxShadow: isCurrent ? `0 0 16px ${tier.glow}` : undefined,
                }}
              >
                {/* Tier header — always visible */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="text-2xl" style={{ filter: isEarned ? 'none' : 'grayscale(100%) opacity(0.4)' }}>
                    {tier.emoji}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black font-headline" style={{ color: isEarned ? tier.color : undefined }}>
                        {tier.name}
                      </p>
                      {isCurrent && (
                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                          style={{ background: `${tier.color}20`, color: tier.color }}>
                          You
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-on-surface-variant">
                      {tier.minBookings} bookings · {tier.minShowRate}% show rate
                    </p>
                  </div>
                  {tier.pabBonus > 0 && (
                    <span className="text-[11px] font-black shrink-0" style={{ color: tier.color }}>
                      +{tier.pabBonus} PAB
                    </span>
                  )}
                  {isEarned && !isCurrent && (
                    <CheckCircleIcon className="h-4 w-4 shrink-0" style={{ color: tier.color }} />
                  )}
                </div>

                {/* Perks — shown for current and earned tiers */}
                {(isCurrent || (isEarned && idx > 0)) && (
                  <div className="px-4 pb-3 pt-0">
                    <div className="grid grid-cols-1 gap-1">
                      {tier.perks.map((perk, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-[10px] mt-0.5" style={{ color: tier.color }}>✓</span>
                          <span className="text-[11px] text-on-surface-variant leading-relaxed">{perk}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* How to earn */}
        <div className="mt-6 p-4 rounded-xl border border-outline-variant/15 bg-surface-container-low">
          <div className="flex items-center gap-2 mb-3">
            <SparklesIcon className="h-4 w-4 text-secondary" />
            <p className="text-sm font-black text-on-surface font-headline">How to Earn PAB</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { action: '✅ Honored booking', amount: '+50 PAB' },
              { action: '⭐ Google review', amount: '+200 PAB' },
              { action: '👥 Referral', amount: '+100 PAB' },
              { action: '🔥 5-booking streak', amount: '+25 PAB' },
            ].map(item => (
              <div key={item.action} className="flex items-center justify-between bg-surface-container-lowest rounded-lg px-3 py-2 border border-outline-variant/10">
                <span className="text-[11px] text-on-surface-variant">{item.action}</span>
                <span className="text-[11px] font-black text-secondary ml-2 shrink-0">{item.amount}</span>
              </div>
            ))}
          </div>
          <Link to="/wallet" className="mt-3 inline-flex items-center text-[11px] font-bold text-primary hover:underline">
            View full wallet & history →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState({ firstName: user?.firstName || '', lastName: user?.lastName || '' });
  const [activeTab, setActiveTab] = useState<'history' | 'badges' | 'connections' | 'loyalty'>('history');
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [socialErrors, setSocialErrors] = useState<Record<string, string>>({});

  const addToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const SOCIAL_PLATFORMS = [
    { id: 'LINKEDIN', name: 'LinkedIn', emoji: '💼', color: '#0A66C2', boost: 5 },
    { id: 'FIVERR', name: 'Fiverr', emoji: '🟢', color: '#1DBF73', boost: 8 },
    { id: 'UPWORK', name: 'Upwork', emoji: '🟩', color: '#14A800', boost: 8 },
    { id: 'X_TWITTER', name: 'X (Twitter)', emoji: '𝕏', color: '#000000', boost: 3 },
    { id: 'TIKTOK', name: 'TikTok', emoji: '🎵', color: '#000000', boost: 3 },
  ];

  const META_PLATFORMS = [
    { id: 'WHATSAPP', name: 'WhatsApp', emoji: '💬', color: '#25D366', boost: 4 },
    { id: 'INSTAGRAM', name: 'Instagram', emoji: '📸', color: '#E4405F', boost: 4 },
    { id: 'FACEBOOK', name: 'Facebook', emoji: '📘', color: '#1877F2', boost: 4 },
  ];

  const ALL_PLATFORMS = [...SOCIAL_PLATFORMS, ...META_PLATFORMS];

  // Fetch social identities
  const { refetch: refetchIdentities } = useQuery(
    'social-identities',
    () => socialService.getIdentities(),
    {
      enabled: !!user,
      onSuccess: (res: any) => {
        const identities = res?.data?.data?.identities || [];
        const map: Record<string, boolean> = {};
        identities.forEach((i: any) => { map[i.platform] = true; });
        setConnected(map);
      },
    }
  );

  // Fetch the server-computed badge (includes social trust boost)
  const { data: badgeData, refetch: refetchBadge } = useQuery(
    'my-badge',
    () => socialService.getMyBadge(),
    { enabled: !!user }
  );

  const effectiveScore: number = (badgeData as any)?.data?.data?.reliabilityScore ?? 100;
  const socialTrustBoost: number = (badgeData as any)?.data?.data?.socialTrustBoost ?? 0;

  // ── Social connect handlers ──────────────────────────────────────────────

  const handleConnect = async (platformId: string) => {
    setConnectingPlatform(platformId);
    setSocialErrors(prev => ({ ...prev, [platformId]: '' }));
    try {
      const res: any = await socialService.connect(platformId);
      const boost = res?.data?.data?.trustBoost ?? 0;
      setConnected(prev => ({ ...prev, [platformId]: true }));
      await Promise.all([refetchIdentities(), refetchBadge()]);
      addToast(`${platformId.replace('_', ' ')} connected! +${boost} pts added to your score 🎉`, 'success');
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Connection failed. Please try again.';
      setSocialErrors(prev => ({ ...prev, [platformId]: msg }));
      addToast(msg, 'error');
    } finally {
      setConnectingPlatform(null);
    }
  };

  const handleDisconnect = async (platformId: string) => {
    setConnectingPlatform(platformId);
    setSocialErrors(prev => ({ ...prev, [platformId]: '' }));
    try {
      await socialService.disconnect(platformId);
      setConnected(prev => ({ ...prev, [platformId]: false }));
      await Promise.all([refetchIdentities(), refetchBadge()]);
      addToast(`${platformId.replace('_', ' ')} disconnected. Score updated.`, 'info');
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Disconnect failed.';
      setSocialErrors(prev => ({ ...prev, [platformId]: msg }));
      addToast(msg, 'error');
    } finally {
      setConnectingPlatform(null);
    }
  };

  const handleConnectMeta = async () => {
    setConnectingPlatform('META');
    setSocialErrors(prev => ({ ...prev, META: '' }));
    try {
      const res: any = await socialService.connectMeta();
      setConnected(prev => ({ ...prev, WHATSAPP: true, INSTAGRAM: true, FACEBOOK: true }));
      await Promise.all([refetchIdentities(), refetchBadge()]);
      const boost = res?.data?.data?.totalBoost ?? 0;
      addToast(`Meta platforms connected! Total boost +${boost} pts 🎉`, 'success');
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Meta connection failed.';
      setSocialErrors(prev => ({ ...prev, META: msg }));
      addToast(msg, 'error');
    } finally {
      setConnectingPlatform(null);
    }
  };

  const handleDisconnectMeta = async () => {
    setConnectingPlatform('META');
    try {
      await socialService.disconnectMeta();
      setConnected(prev => ({ ...prev, WHATSAPP: false, INSTAGRAM: false, FACEBOOK: false }));
      await Promise.all([refetchIdentities(), refetchBadge()]);
      addToast('Meta platforms disconnected.', 'info');
    } catch (err: any) {
      addToast(err?.response?.data?.error || 'Disconnect failed.', 'error');
    } finally {
      setConnectingPlatform(null);
    }
  };

  const metaConnected = connected['WHATSAPP'] && connected['INSTAGRAM'] && connected['FACEBOOK'];

  const totalSocialBoost = ALL_PLATFORMS.filter(p => connected[p.id]).reduce((s, p) => s + p.boost, 0);
  const connectedCount = Object.values(connected).filter(Boolean).length;

  // ── Reservation data ─────────────────────────────────────────────────────

  const { data: reservationsData } = useQuery(
    'my-reservations-profile',
    () => reservationService.getUserReservations({ limit: 20 }),
    { enabled: !!user }
  );

  const { data: walletData } = useQuery(
    'wallet-profile',
    () => cryptoService.getWallet(),
    { enabled: !!user }
  );

  const reservations: any[] = reservationsData?.data?.data?.reservations || [];
  const pabBalance = (walletData as any)?.data?.data?.wallet?.balance ?? (walletData as any)?.data?.data?.balance ?? 0;

  const completed = reservations.filter(r => r.status === 'COMPLETED').length;
  const noShows = reservations.filter(r => r.status === 'NO_SHOW').length;
  const attended = reservations.filter(r => r.status !== 'NO_SHOW').length;
  const showRate = reservations.length > 0
    ? Math.round((attended / reservations.length) * 100)
    : 100;

  // Streak = consecutive completed bookings from latest backwards
  let streak = 0;
  const sorted = [...reservations].sort((a, b) =>
    new Date(b.reservationDate).getTime() - new Date(a.reservationDate).getTime()
  );
  for (const r of sorted) {
    if (r.status === 'COMPLETED') streak++;
    else if (r.status === 'NO_SHOW') break;
  }

  const { current: loyaltyTier } = computeLoyaltyTier(completed, showRate);

  const initials = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : '';

  const achievements = [
    { icon: <TrophyIcon className="h-5 w-5" />, label: 'First Booking', description: 'Made your first reservation', earned: reservations.length >= 1, colorClass: 'text-tertiary', bgClass: 'bg-tertiary-fixed' },
    { icon: <FireIcon className="h-5 w-5" />, label: '5-Booking Streak', description: 'Completed 5 bookings', earned: completed >= 5, colorClass: 'text-error', bgClass: 'bg-error-container' },
    { icon: <StarIcon className="h-5 w-5" />, label: 'Star Patron', description: 'Completed 10 bookings', earned: completed >= 10, colorClass: 'text-primary', bgClass: 'bg-primary-container' },
    { icon: <ShieldCheckIcon className="h-5 w-5" />, label: 'Perfect Record', description: '100% show-up rate', earned: noShows === 0 && reservations.length >= 3, colorClass: 'text-tertiary-fixed-variant', bgClass: 'bg-tertiary-fixed' },
    { icon: <BoltIcon className="h-5 w-5" />, label: 'PAB Collector', description: 'Earned 100 PAB tokens', earned: pabBalance >= 100, colorClass: 'text-secondary', bgClass: 'bg-secondary-container' },
    { icon: <HeartIcon className="h-5 w-5" />, label: 'Loyal Customer', description: 'Visited same business 3x', earned: false, colorClass: 'text-error', bgClass: 'bg-error-container' },
  ];

  if (!user) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-surface">
        <div className="text-center">
          <p className="text-on-surface-variant mb-4 font-body">Please sign in to view your profile.</p>
          <Link to="/login" className="bg-primary text-on-primary px-6 py-2.5 rounded-md font-body text-sm font-medium hover:opacity-90 transition-opacity">Sign In</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body pb-24 md:pb-8">
      <ToastContainer toasts={toasts} />

      {/* ── Profile Banner ── */}
      <div className="relative overflow-hidden">
        <div className="h-[200px] bg-gradient-to-r from-primary-container to-secondary-container relative">
          <div className="absolute w-[300px] h-[300px] -top-24 left-[30%] rounded-full bg-primary/20 blur-3xl pointer-events-none mix-blend-multiply" />
          <div className="absolute w-[200px] h-[200px] -top-12 right-[20%] rounded-full bg-secondary/20 blur-2xl pointer-events-none mix-blend-multiply delay-700" />
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(rgba(0,0,0,0.05)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 relative">
          <div className="flex items-end gap-5 -mt-12 pb-6">
            <div className="relative shrink-0">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-primary-container border-4 border-surface flex items-center justify-center text-3xl font-black text-on-primary font-headline shadow-lg">
                {initials}
              </div>
              <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-tertiary-fixed border-2 border-surface shadow-sm" />
            </div>
            <div className="flex-1 pb-1">
              {!editing ? (
                <>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className="text-2xl md:text-3xl font-black text-on-surface font-headline tracking-tight">
                      {user.firstName} {user.lastName}
                    </h1>
                    {effectiveScore >= 90 && (
                      <div className="text-tertiary flex items-center" title="Verified Reliable Customer">
                        <CheckBadgeIcon className="h-6 w-6 drop-shadow-sm" />
                      </div>
                    )}
                    {/* Loyalty tier badge */}
                    <span
                      className="text-[10px] font-black px-2.5 py-1 rounded-full"
                      style={{
                        background: `${loyaltyTier.color}20`,
                        color: loyaltyTier.color,
                        border: `1px solid ${loyaltyTier.color}30`,
                      }}
                    >
                      {loyaltyTier.emoji} {loyaltyTier.name}
                    </span>
                  </div>
                  <p className="text-sm text-on-surface-variant mt-0.5">
                    @{user.email.split('@')[0]} · {user.role === 'BUSINESS_OWNER' ? 'Business Owner' : 'Customer'}
                  </p>
                </>
              ) : (
                <div className="flex gap-2 items-center">
                  <input value={editName.firstName} onChange={e => setEditName(n => ({ ...n, firstName: e.target.value }))}
                    className="w-32 bg-surface-container-lowest border border-outline-variant/30 text-on-surface rounded-md focus:ring-1 focus:ring-primary px-3 py-1.5 outline-none font-body text-sm" placeholder="First name" />
                  <input value={editName.lastName} onChange={e => setEditName(n => ({ ...n, lastName: e.target.value }))}
                    className="w-32 bg-surface-container-lowest border border-outline-variant/30 text-on-surface rounded-md focus:ring-1 focus:ring-primary px-3 py-1.5 outline-none font-body text-sm" placeholder="Last name" />
                  <button onClick={() => setEditing(false)} className="bg-primary text-on-primary px-4 py-1.5 rounded-md font-body text-xs font-medium hover:opacity-90">Save</button>
                  <button onClick={() => setEditing(false)} className="text-xs text-on-surface-variant hover:text-on-surface cursor-pointer font-medium">Cancel</button>
                </div>
              )}
            </div>
            {!editing && (
              <button onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg cursor-pointer transition-all bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 text-on-surface-variant hover:text-on-surface mb-1 shadow-sm"
              >
                <PencilIcon className="h-3.5 w-3.5" /> Edit Profile
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-16 mt-4">

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Bookings', value: reservations.length, colorClass: 'text-primary' },
            { label: 'Completed', value: completed, colorClass: 'text-tertiary' },
            { label: 'PAB Tokens', value: pabBalance.toLocaleString(), colorClass: 'text-secondary' },
            { label: 'Loyalty Tier', value: loyaltyTier.emoji, colorClass: 'text-on-surface', sub: loyaltyTier.name },
          ].map(s => (
            <div key={s.label} className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-5 text-center shadow-sm hover:shadow-md transition-shadow">
              <p className={`text-2xl md:text-3xl font-black font-headline ${s.colorClass}`}>{s.value}</p>
              {s.sub && <p className="text-[9px] font-black uppercase tracking-widest mt-0.5" style={{ color: loyaltyTier.color }}>{s.sub}</p>}
              <p className="text-[10px] text-on-surface-variant mt-1 uppercase tracking-widest font-semibold">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Gauges Row ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Trust Score — uses server-computed effective score */}
          <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-6 text-center shadow-sm">
            <p className="text-[11px] font-bold text-on-surface-variant mb-4 uppercase tracking-widest">Reliability Score</p>
            <div className="flex justify-center">
              <ArcGauge
                value={effectiveScore}
                color={effectiveScore >= 90 ? '#5fa98c' : effectiveScore >= 70 ? '#4c637d' : '#ba1a1a'}
                label="Score"
              />
            </div>
            <p className="text-[11px] font-medium text-on-surface-variant mt-3">
              {effectiveScore >= 90 ? '🌟 Elite Reliability' : effectiveScore >= 70 ? '⚡ Good Standing' : '⚠️ Needs Improvement'}
            </p>
            {socialTrustBoost > 0 && (
              <p className="text-[10px] mt-1.5 font-bold text-tertiary">
                Includes +{socialTrustBoost} social boost
              </p>
            )}
          </div>

          {/* PAB Balance */}
          <div className="bg-gradient-to-br from-primary to-primary-container border border-outline-variant/20 rounded-2xl p-6 text-center shadow-md relative overflow-hidden">
            <div className="absolute w-[120px] h-[120px] -top-8 -right-8 rounded-full bg-secondary-container/20 blur-xl pointer-events-none" />
            <div className="text-3xl mb-1 text-secondary-fixed">⚡</div>
            <p className="text-[11px] font-bold text-secondary-fixed mb-2 uppercase tracking-widest">PAB Balance</p>
            <p className="text-4xl font-black font-headline text-white drop-shadow-sm">
              {pabBalance.toLocaleString()}
            </p>
            <p className="text-[10px] text-secondary-fixed-dim mt-1.5 font-medium">Pabandi Reliability Tokens</p>
            <div className="flex items-center gap-2 justify-center mt-3">
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-white/10 text-white border border-white/20">
                {loyaltyTier.emoji} {loyaltyTier.name}
              </span>
            </div>
            <Link to="/wallet" className="inline-flex items-center gap-1 mt-3 text-[11px] font-bold px-3.5 py-1.5 rounded-lg bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-colors">
              {pabBalance > 0 ? '↗ Withdraw to Solana' : 'View Wallet →'}
            </Link>
          </div>

          {/* Show rate gauge */}
          <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-6 text-center shadow-sm">
            <p className="text-[11px] font-bold text-on-surface-variant mb-4 uppercase tracking-widest">Show Rate</p>
            <div className="flex justify-center">
              <ArcGauge value={showRate} color="#031f38" label="Show %" />
            </div>
            <p className="text-[11px] font-medium text-on-surface-variant mt-3">
              {attended} of {reservations.length} bookings honored
            </p>
            {streak > 0 && (
              <p className="text-[10px] mt-1.5 font-bold text-error">
                🔥 {streak} booking streak
              </p>
            )}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div>
          <div className="flex gap-1 mb-6 bg-surface-container-low border border-outline-variant/10 rounded-xl p-1 flex-wrap">
            {(['history', 'loyalty', 'badges', 'connections'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all capitalize ${
                  activeTab === tab
                  ? 'bg-surface-container-lowest text-primary shadow-sm border border-outline-variant/20'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}>
                {tab === 'history'     ? '📅 Booking History' :
                 tab === 'loyalty'     ? '🏆 Loyalty Program' :
                 tab === 'badges'      ? '🏅 Achievements'    :
                                        '🔗 Connected Accounts'}
              </button>
            ))}
          </div>

          {/* ── History & Receipts Tab ── */}
          {activeTab === 'history' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-black text-on-surface font-headline">Recent Bookings</h2>
                  <Link to="/reservations" className="text-xs font-bold text-primary hover:underline">View All →</Link>
                </div>
                {reservations.length > 0 ? (
                  <div className="divide-y divide-outline-variant/10">
                    {reservations.slice(0, 10).map((r, i) => (
                      <BookingItem key={r.id} reservation={r} index={i} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <CalendarIcon className="h-10 w-10 mx-auto mb-3 text-outline" />
                    <p className="text-sm font-semibold mb-1 text-on-surface">No bookings yet</p>
                    <p className="text-xs text-on-surface-variant mb-5">Your booking history will appear here</p>
                    <Link to="/" className="bg-primary text-on-primary px-5 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity">Find a Business</Link>
                  </div>
                )}
              </div>
              
              <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-6 shadow-sm">
                <h2 className="text-lg font-black text-on-surface font-headline mb-4">Score Receipts</h2>
                <ScoreReceipts />
              </div>
            </div>
          )}

          {/* ── Loyalty Tab ── */}
          {activeTab === 'loyalty' && (
            <LoyaltyTab
              totalBookings={completed}
              showRate={showRate}
              pabBalance={pabBalance}
              streak={streak}
            />
          )}

          {/* ── Achievements Tab ── */}
          {activeTab === 'badges' && (
            <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-6 shadow-sm">
              <div className="mb-4">
                <h2 className="text-lg font-black text-on-surface font-headline">Achievements</h2>
                <p className="text-[11px] text-on-surface-variant mt-0.5 font-medium">
                  {achievements.filter(a => a.earned).length} / {achievements.length} unlocked
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {achievements.map(a => (
                  <AchievementBadge key={a.label} {...a} />
                ))}
              </div>
              <div className="mt-6 p-4 bg-secondary/5 rounded-xl border border-secondary/10 flex items-start gap-3">
                <GiftIcon className="h-5 w-5 text-secondary shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-on-surface mb-0.5">Mint as Soulbound NFTs</p>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    Your reliability badges can be minted as non-transferable NFTs on BSC or Solana.
                    Connect a wallet and visit your <Link to="/wallet" className="text-primary font-bold hover:underline">Wallet Dashboard</Link>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Connected Accounts Tab ── */}
          {activeTab === 'connections' && (
            <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-6 shadow-sm">
              <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
                <div>
                  <h2 className="text-lg font-black text-on-surface font-headline">Connected Accounts</h2>
                  <p className="text-[11px] text-on-surface-variant mt-0.5 font-medium">
                    Each connection enriches your reliability score with cross-platform trust signals.
                  </p>
                  <p className="text-[10px] text-on-surface-variant mt-1 italic">
                    Demo mode — social identity stubs are saved to your profile.
                  </p>
                </div>
                {connectedCount > 0 && (
                  <div className="flex items-center gap-2 bg-tertiary-fixed/20 text-on-tertiary-fixed-variant px-3 py-1.5 rounded-lg border border-tertiary-fixed/30">
                    <span className="text-sm font-black text-tertiary">+{totalSocialBoost} pts</span>
                    <span className="text-[10px] font-semibold text-on-surface-variant">from {connectedCount} platform{connectedCount > 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>

              {/* Meta ecosystem */}
              <div className={`rounded-xl p-5 border-2 transition-all mb-5 ${metaConnected ? 'border-[#0081FB]/30 bg-[#0081FB]/5' : 'border-outline-variant/20 bg-surface-container-low/50'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0081FB] to-[#00C6FF] flex items-center justify-center text-white text-lg font-black shadow-sm">M</div>
                    <div>
                      <p className="font-bold text-sm text-on-surface">Meta Platforms</p>
                      <p className="text-[10px] text-on-surface-variant">
                        {metaConnected ? 'WhatsApp + Instagram + Facebook connected' : 'Connect WhatsApp, Instagram & Facebook together'}
                      </p>
                    </div>
                  </div>
                  {metaConnected && (
                    <span className="text-[9px] font-black px-2 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant uppercase tracking-wider">
                      Connected
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {META_PLATFORMS.map(mp => (
                    <div key={mp.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                      connected[mp.id]
                        ? 'border-tertiary-fixed/30 bg-tertiary-fixed/10 text-on-tertiary-fixed-variant'
                        : 'border-outline-variant/20 bg-surface-container-lowest text-on-surface-variant'
                    }`}>
                      <span>{mp.emoji}</span> {mp.name}
                      {connected[mp.id] && <span className="text-tertiary">✓</span>}
                    </div>
                  ))}
                </div>

                <p className="text-[10px] text-on-surface-variant mb-3">Up to +{META_PLATFORMS.reduce((s, p) => s + p.boost, 0)} pts combined</p>

                {socialErrors.META && (
                  <p className="text-[11px] text-error mb-2 font-medium">{socialErrors.META}</p>
                )}

                {metaConnected ? (
                  <button
                    onClick={handleDisconnectMeta}
                    disabled={connectingPlatform === 'META'}
                    className="w-full py-2.5 rounded-lg text-[11px] font-bold text-error bg-error-container/20 hover:bg-error-container/40 border border-error/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {connectingPlatform === 'META' ? <div className="w-3 h-3 border-2 border-error/30 border-t-error rounded-full animate-spin" /> : null}
                    Disconnect All Meta Platforms
                  </button>
                ) : (
                  <button
                    onClick={handleConnectMeta}
                    disabled={connectingPlatform === 'META'}
                    className="w-full py-2.5 rounded-lg text-[11px] font-bold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                    style={{ background: 'linear-gradient(135deg, #0081FB 0%, #00C6FF 100%)' }}
                  >
                    {connectingPlatform === 'META' ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                    Connect with Meta →
                  </button>
                )}
              </div>

              {/* Individual platform cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {SOCIAL_PLATFORMS.map(platform => (
                  <div
                    key={platform.id}
                    className="rounded-xl p-4 border transition-all"
                    style={{
                      background: connected[platform.id] ? `${platform.color}08` : undefined,
                      borderColor: connected[platform.id] ? `${platform.color}30` : undefined,
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{platform.emoji}</span>
                        <div>
                          <p className="font-bold text-sm text-on-surface">{platform.name}</p>
                          <p className="text-[10px] text-on-surface-variant">
                            {connected[platform.id] ? `+${platform.boost} pts active` : `Up to +${platform.boost} pts`}
                          </p>
                        </div>
                      </div>
                      {connected[platform.id] && (
                        <span className="text-[9px] font-black px-2 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant uppercase tracking-wider">
                          Connected
                        </span>
                      )}
                    </div>

                    {socialErrors[platform.id] && (
                      <p className="text-[10px] text-error mb-2 font-medium">{socialErrors[platform.id]}</p>
                    )}

                    {connected[platform.id] ? (
                      <button
                        onClick={() => handleDisconnect(platform.id)}
                        disabled={connectingPlatform === platform.id}
                        className="w-full py-2 rounded-lg text-[11px] font-bold text-error bg-error-container/20 hover:bg-error-container/40 border border-error/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {connectingPlatform === platform.id ? <div className="w-3 h-3 border-2 border-error/30 border-t-error rounded-full animate-spin" /> : null}
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnect(platform.id)}
                        disabled={connectingPlatform === platform.id}
                        className="w-full py-2 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        style={{ background: `${platform.color}15`, color: platform.color, border: `1px solid ${platform.color}30` }}
                      >
                        {connectingPlatform === platform.id
                          ? <div className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: `${platform.color}30`, borderTopColor: platform.color }} />
                          : null}
                        Connect {platform.name} →
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-primary/5 rounded-xl border border-primary/10 flex items-start gap-3">
                <span className="text-lg mt-0.5">🔒</span>
                <div>
                  <p className="text-sm font-bold text-on-surface mb-0.5">Privacy First</p>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    We only access public metadata. No posts, messages, or private data. Disconnect any time — no penalty.
                  </p>
                  <Link to="/trust" className="text-[11px] text-primary font-bold hover:underline mt-1 inline-block">Learn more about how this works →</Link>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
