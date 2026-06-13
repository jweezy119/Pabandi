import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { useAuthStore } from '../store/authStore';
import { reservationService, cryptoService } from '../services/api';
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
} from '@heroicons/react/24/outline';

/* ── Animated Arc Gauge ── */
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

/* ── Achievement Badge ── */
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

/* ── Booking Timeline Item ── */
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
      {/* Date badge */}
      <div className="w-11 shrink-0 text-center bg-surface-container-lowest border border-outline-variant/30 rounded-lg py-1.5 shadow-sm">
        <div className={`text-[9px] font-bold tracking-wider ${sc.colorClass}`}>{month}</div>
        <div className="text-[1.1rem] font-black text-on-surface leading-none mt-0.5 font-headline">{day}</div>
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-on-surface mb-0.5 truncate font-headline">
          {reservation.business?.name || 'Booking'}
        </p>
        <p className="text-[11px] text-on-surface-variant font-body">
          {reservation.reservationTime} · {reservation.numberOfGuests} guest{reservation.numberOfGuests !== 1 ? 's' : ''}
        </p>
      </div>
      {/* Status */}
      <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${sc.bgClass} ${sc.colorClass} border border-outline-variant/10 shadow-sm whitespace-nowrap`}>
        {sc.label}
      </span>
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState({ firstName: user?.firstName || '', lastName: user?.lastName || '' });
  const [activeTab, setActiveTab] = useState<'history' | 'badges' | 'connections'>('history');
  const [connected, setConnected] = useState<Record<string, boolean>>({});

  const SOCIAL_PLATFORMS = [
    { id: 'LINKEDIN', name: 'LinkedIn', emoji: '💼', color: '#0A66C2', boost: 5 },
    { id: 'FIVERR', name: 'Fiverr', emoji: '🟢', color: '#1DBF73', boost: 8 },
    { id: 'UPWORK', name: 'Upwork', emoji: '🔵', color: '#14A800', boost: 8 },
    { id: 'X_TWITTER', name: 'X (Twitter)', emoji: '🐦', color: '#E7E9EA', boost: 3 },
    { id: 'TRUTH_SOCIAL', name: 'Truth Social', emoji: '🇺🇸', color: '#FF6A00', boost: 3 },
  ];

  const totalSocialBoost = SOCIAL_PLATFORMS.filter(p => connected[p.id]).reduce((s, p) => s + p.boost, 0);
  const connectedCount = Object.values(connected).filter(Boolean).length;

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
  const reliabilityScore = reservations.length > 0 ? Math.round(((reservations.length - noShows) / reservations.length) * 100) : 100;

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

      {/* ── Profile Banner ── */}
      <div className="relative overflow-hidden">
        {/* Cover gradient */}
        <div className="h-[200px] bg-gradient-to-r from-primary-container to-secondary-container relative">
          {/* Animated orbs */}
          <div className="absolute w-[300px] h-[300px] -top-24 left-[30%] rounded-full bg-primary/20 blur-3xl pointer-events-none mix-blend-multiply" />
          <div className="absolute w-[200px] h-[200px] -top-12 right-[20%] rounded-full bg-secondary/20 blur-2xl pointer-events-none mix-blend-multiply delay-700" />
          {/* Grid dots */}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(rgba(0,0,0,0.05)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        </div>

        {/* Avatar + name row */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 relative">
          <div className="flex items-end gap-5 -mt-12 pb-6">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-primary-container border-4 border-surface flex items-center justify-center text-3xl font-black text-on-primary font-headline shadow-lg">
                {initials}
              </div>
              {/* Online indicator */}
              <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-tertiary-fixed border-2 border-surface shadow-sm" />
            </div>
            {/* Name + handle */}
            <div className="flex-1 pb-1">
              {!editing ? (
                <>
                  <div className="flex items-center gap-2.5">
                    <h1 className="text-2xl md:text-3xl font-black text-on-surface font-headline tracking-tight">
                      {user.firstName} {user.lastName}
                    </h1>
                    {reliabilityScore === 100 && (
                      <div className="text-tertiary flex items-center" title="Verified Reliable Customer">
                        <CheckBadgeIcon className="h-6 w-6 drop-shadow-sm" />
                      </div>
                    )}
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
            {/* Edit button */}
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
            { label: 'PAB Tokens', value: pabBalance, colorClass: 'text-secondary' },
            { label: 'No-Shows', value: noShows, colorClass: 'text-error' },
          ].map(s => (
            <div key={s.label} className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-5 text-center shadow-sm hover:shadow-md transition-shadow">
              <p className={`text-2xl md:text-3xl font-black font-headline ${s.colorClass}`}>{s.value}</p>
              <p className="text-[10px] text-on-surface-variant mt-1 uppercase tracking-widest font-semibold">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Gauges Row ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

          {/* Trust Score */}
          <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-6 text-center shadow-sm">
            <p className="text-[11px] font-bold text-on-surface-variant mb-4 uppercase tracking-widest">Trust Score</p>
            <div className="flex justify-center">
              <ArcGauge value={reliabilityScore} color={reliabilityScore >= 90 ? '#5fa98c' : reliabilityScore >= 70 ? '#4c637d' : '#ba1a1a'} label="Trust %" />
            </div>
            <p className="text-[11px] font-medium text-on-surface-variant mt-3">
              {reliabilityScore >= 90 ? '🌟 Elite Reliability' : reliabilityScore >= 70 ? '⚡ Good Standing' : '⚠️ Needs Improvement'}
            </p>
          </div>

          {/* PAB Token display */}
          <div className="bg-gradient-to-br from-primary to-primary-container border border-outline-variant/20 rounded-2xl p-6 text-center shadow-md relative overflow-hidden">
            <div className="absolute w-[120px] h-[120px] -top-8 -right-8 rounded-full bg-secondary-container/20 blur-xl pointer-events-none" />
            <div className="text-3xl mb-1 text-secondary-fixed">⚡</div>
            <p className="text-[11px] font-bold text-secondary-fixed mb-2 uppercase tracking-widest">PAB Balance</p>
            <p className="text-4xl font-black font-headline text-white drop-shadow-sm">
              {pabBalance.toLocaleString()}
            </p>
            <p className="text-[10px] text-secondary-fixed-dim mt-1.5 font-medium">Pabandi Reliability Tokens</p>
            <Link to="/wallet" className="inline-flex items-center gap-1 mt-3.5 text-[11px] font-bold px-3.5 py-1.5 rounded-lg bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-colors">
              View Wallet →
            </Link>
          </div>

          {/* Booking completion */}
          <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-6 text-center shadow-sm">
            <p className="text-[11px] font-bold text-on-surface-variant mb-4 uppercase tracking-widest">Completion Rate</p>
            <div className="flex justify-center">
              <ArcGauge value={reservations.length > 0 ? Math.round((completed / reservations.length) * 100) : 0} color="#031f38" label="Completed %" />
            </div>
            <p className="text-[11px] font-medium text-on-surface-variant mt-3">
              {completed} of {reservations.length} bookings completed
            </p>
          </div>
        </div>

        {/* ── Tabs: History / Badges ── */}
        <div>
          {/* Tab bar */}
          <div className="flex gap-1 mb-6 bg-surface-container-low border border-outline-variant/10 rounded-xl p-1 w-max">
            {(['history', 'badges', 'connections'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 rounded-lg text-sm font-bold transition-all capitalize ${
                  activeTab === tab
                  ? 'bg-surface-container-lowest text-primary shadow-sm border border-outline-variant/20'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}>
                {tab === 'history' ? '📅 Booking History' : tab === 'badges' ? '🏅 Achievements' : '🔗 Connected Accounts'}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'history' ? (
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
          ) : activeTab === 'badges' ? (
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
            </div>
          ) : (
            /* ── Connected Accounts Tab ── */
            <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-6 shadow-sm">
              <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
                <div>
                  <h2 className="text-lg font-black text-on-surface font-headline">Connected Accounts</h2>
                  <p className="text-[11px] text-on-surface-variant mt-0.5 font-medium">
                    Each connection enriches your reliability score with cross-platform trust signals.
                  </p>
                </div>
                {connectedCount > 0 && (
                  <div className="flex items-center gap-2 bg-tertiary-fixed/20 text-on-tertiary-fixed-variant px-3 py-1.5 rounded-lg border border-tertiary-fixed/30">
                    <span className="text-sm font-black text-tertiary">+{totalSocialBoost} pts</span>
                    <span className="text-[10px] font-semibold text-on-surface-variant">from {connectedCount} platform{connectedCount > 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    {connected[platform.id] ? (
                      <button
                        onClick={() => setConnected(prev => ({ ...prev, [platform.id]: false }))}
                        className="w-full py-2 rounded-lg text-[11px] font-bold text-error bg-error-container/20 hover:bg-error-container/40 border border-error/10 transition-colors"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => setConnected(prev => ({ ...prev, [platform.id]: true }))}
                        className="w-full py-2 rounded-lg text-[11px] font-bold transition-colors"
                        style={{ background: `${platform.color}15`, color: platform.color, border: `1px solid ${platform.color}30` }}
                      >
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
