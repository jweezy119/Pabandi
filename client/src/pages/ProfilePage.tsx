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
    <div style={{ position: 'relative', width: 120, height: 120 }}>
      <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="9" />
        <circle cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: 'stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '1.3rem', fontWeight: 900, color, fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1 }}>{value}</span>
        <span style={{ fontSize: 9, color: 'var(--color-text-muted)', marginTop: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      </div>
    </div>
  );
}

/* ── Achievement Badge ── */
function AchievementBadge({ icon, label, description, earned, color }: {
  icon: React.ReactNode; label: string; description: string; earned: boolean; color: string;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      padding: '16px 12px', borderRadius: 14, textAlign: 'center',
      background: earned ? `${color}10` : 'rgba(255,255,255,0.02)',
      border: `1px solid ${earned ? color + '30' : 'rgba(255,255,255,0.05)'}`,
      opacity: earned ? 1 : 0.45,
      transition: 'all 0.3s',
      cursor: earned ? 'default' : 'not-allowed',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: earned ? `${color}20` : 'rgba(255,255,255,0.04)',
        border: `1px solid ${earned ? color + '40' : 'rgba(255,255,255,0.08)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: earned ? color : 'var(--color-text-dim)',
        boxShadow: earned ? `0 0 16px ${color}40` : 'none',
      }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 11, fontWeight: 800, color: earned ? color : 'var(--color-text-muted)', letterSpacing: '0.04em' }}>{label}</p>
        <p style={{ fontSize: 9, color: 'var(--color-text-dim)', marginTop: 2, lineHeight: 1.4 }}>{description}</p>
      </div>
      {earned && (
        <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 9999, background: `${color}20`, color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Earned
        </span>
      )}
    </div>
  );
}

/* ── Booking Timeline Item ── */
function BookingItem({ reservation, index }: { reservation: any; index: number }) {
  const statusColors: Record<string, { color: string; label: string }> = {
    CONFIRMED: { color: '#6C63FF', label: 'Confirmed' },
    COMPLETED: { color: '#00FFB0', label: 'Completed' },
    CANCELLED: { color: '#6b7fa3', label: 'Cancelled' },
    NO_SHOW:   { color: '#FF4C6A', label: 'No-Show' },
    PENDING:   { color: '#FFB830', label: 'Pending' },
  };
  const sc = statusColors[reservation.status] || statusColors.PENDING;
  const date = new Date(reservation.reservationDate);
  const month = date.toLocaleString('default', { month: 'short' }).toUpperCase();
  const day = date.getDate();

  return (
    <div className="animate-fade-up" style={{
      animationDelay: `${index * 60}ms`,
      display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      {/* Date badge */}
      <div style={{
        width: 44, flexShrink: 0, textAlign: 'center',
        background: 'var(--color-surface)', border: `1px solid ${sc.color}25`,
        borderRadius: 10, padding: '6px 4px',
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: sc.color, letterSpacing: '0.06em' }}>{month}</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#e8eef8', fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1 }}>{day}</div>
      </div>
      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#e8eef8', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {reservation.business?.name || 'Booking'}
        </p>
        <p style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          {reservation.reservationTime} · {reservation.numberOfGuests} guest{reservation.numberOfGuests !== 1 ? 's' : ''}
        </p>
      </div>
      {/* Status */}
      <span style={{
        fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 9999,
        background: `${sc.color}15`, color: sc.color, border: `1px solid ${sc.color}25`,
        whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.06em',
        boxShadow: `0 0 8px ${sc.color}30`,
      }}>
        {sc.label}
      </span>
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState({ firstName: user?.firstName || '', lastName: user?.lastName || '' });
  const [activeTab, setActiveTab] = useState<'history' | 'badges'>('history');

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
    { icon: <TrophyIcon className="h-5 w-5" />, label: 'First Booking', description: 'Made your first reservation', earned: reservations.length >= 1, color: '#FFB830' },
    { icon: <FireIcon className="h-5 w-5" />, label: '5-Booking Streak', description: 'Completed 5 bookings', earned: completed >= 5, color: '#FF6B9D' },
    { icon: <StarIcon className="h-5 w-5" />, label: 'Star Patron', description: 'Completed 10 bookings', earned: completed >= 10, color: '#00E5FF' },
    { icon: <ShieldCheckIcon className="h-5 w-5" />, label: 'Perfect Record', description: '100% show-up rate', earned: noShows === 0 && reservations.length >= 3, color: '#00FFB0' },
    { icon: <BoltIcon className="h-5 w-5" />, label: 'PAB Collector', description: 'Earned 100 PAB tokens', earned: pabBalance >= 100, color: '#6C63FF' },
    { icon: <HeartIcon className="h-5 w-5" />, label: 'Loyal Customer', description: 'Visited same business 3x', earned: false, color: '#FF4C6A' },
  ];

  if (!user) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 16 }}>Please sign in to view your profile.</p>
          <Link to="/login" className="btn-primary">Sign In</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', color: 'var(--color-text)' }}>

      {/* ── Profile Banner ── */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Cover gradient */}
        <div style={{
          height: 220,
          background: 'linear-gradient(135deg, rgba(108,99,255,0.4) 0%, rgba(0,229,255,0.2) 50%, rgba(0,255,176,0.15) 100%)',
          position: 'relative',
        }}>
          {/* Animated orbs */}
          <div className="animate-orb" style={{
            position: 'absolute', width: 300, height: 300, top: -100, left: '30%',
            borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,99,255,0.3), transparent)',
            filter: 'blur(40px)', pointerEvents: 'none',
          }} />
          <div className="animate-float" style={{
            position: 'absolute', width: 200, height: 200, top: -50, right: '20%',
            borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,229,255,0.2), transparent)',
            filter: 'blur(30px)', pointerEvents: 'none', animationDelay: '2s',
          }} />
          {/* Grid dots */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            maskImage: 'linear-gradient(to bottom, black, transparent)',
            WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)',
          }} />
        </div>

        {/* Avatar + name row */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6" style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, marginTop: -52, paddingBottom: 24 }}>
            {/* Avatar */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{
                width: 96, height: 96, borderRadius: '50%',
                background: 'linear-gradient(135deg, #6C63FF, #00E5FF)',
                border: '4px solid var(--color-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 32, fontWeight: 900, color: '#fff', fontFamily: 'Space Grotesk, sans-serif',
                boxShadow: '0 0 40px rgba(108,99,255,0.5), 0 8px 32px rgba(0,0,0,0.6)',
              }}>
                {initials}
              </div>
              {/* Online indicator */}
              <div style={{
                position: 'absolute', bottom: 4, right: 4,
                width: 16, height: 16, borderRadius: '50%',
                background: '#00FFB0', border: '2px solid var(--color-bg)',
                boxShadow: '0 0 10px rgba(0,255,176,0.6)',
              }} />
            </div>
            {/* Name + handle */}
            <div style={{ flex: 1, paddingBottom: 4 }}>
              {!editing ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h1 style={{ fontSize: 'clamp(1.3rem, 3vw, 1.75rem)', fontWeight: 900, color: '#e8eef8', fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '-0.02em' }}>
                      {user.firstName} {user.lastName}
                    </h1>
                    {reliabilityScore === 100 && (
                      <div style={{ color: '#00E5FF', display: 'flex', alignItems: 'center' }} title="Verified Reliable Customer">
                        <CheckBadgeIcon className="h-5 w-5" style={{ filter: 'drop-shadow(0 0 6px #00E5FF)' }} />
                      </div>
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
                    @{user.email.split('@')[0]} · {user.role === 'BUSINESS_OWNER' ? 'Business Owner' : 'Customer'}
                  </p>
                </>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input value={editName.firstName} onChange={e => setEditName(n => ({ ...n, firstName: e.target.value }))}
                    className="input-field" style={{ maxWidth: 130, padding: '8px 12px' }} placeholder="First name" />
                  <input value={editName.lastName} onChange={e => setEditName(n => ({ ...n, lastName: e.target.value }))}
                    className="input-field" style={{ maxWidth: 130, padding: '8px 12px' }} placeholder="Last name" />
                  <button onClick={() => setEditing(false)} className="btn-primary" style={{ padding: '8px 16px', fontSize: 12 }}>Save</button>
                  <button onClick={() => setEditing(false)} style={{ fontSize: 12, color: 'var(--color-text-muted)', cursor: 'pointer' }}>Cancel</button>
                </div>
              )}
            </div>
            {/* Edit button */}
            {!editing && (
              <button onClick={() => setEditing(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
                  padding: '8px 14px', borderRadius: 10, cursor: 'pointer', transition: 'all 0.2s',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--color-text-muted)',
                  marginBottom: 6,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(108,99,255,0.4)'; (e.currentTarget as HTMLElement).style.color = '#e8eef8'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)'; }}
              >
                <PencilIcon className="h-3.5 w-3.5" /> Edit Profile
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">

        {/* ── Stats Row ── */}
        <div className="animate-fade-up grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Bookings', value: reservations.length, color: '#6C63FF' },
            { label: 'Completed', value: completed, color: '#00FFB0' },
            { label: 'PAB Tokens', value: pabBalance, color: '#FFB830' },
            { label: 'No-Shows', value: noShows, color: '#FF4C6A' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'var(--color-surface)', border: `1px solid ${s.color}20`,
              borderRadius: '1rem', padding: '1.25rem', textAlign: 'center',
              boxShadow: `0 4px 20px rgba(0,0,0,0.3)`,
              transition: 'all 0.3s',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = s.color + '40'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = s.color + '20'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
            >
              <p style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', fontWeight: 900, color: s.color, fontFamily: 'Space Grotesk, sans-serif', textShadow: `0 0 20px ${s.color}60` }}>{s.value}</p>
              <p style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Gauges Row ── */}
        <div className="animate-fade-up-delay-1 grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

          {/* Trust Score */}
          <div style={{ background: 'var(--color-surface)', border: '1px solid rgba(108,99,255,0.2)', borderRadius: '1.25rem', padding: '1.5rem', textAlign: 'center', boxShadow: '0 0 40px rgba(108,99,255,0.05)' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Trust Score</p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <ArcGauge value={reliabilityScore} color={reliabilityScore >= 90 ? '#00FFB0' : reliabilityScore >= 70 ? '#FFB830' : '#FF4C6A'} label="Trust %" />
            </div>
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 10 }}>
              {reliabilityScore >= 90 ? '🌟 Elite Reliability' : reliabilityScore >= 70 ? '⚡ Good Standing' : '⚠️ Needs Improvement'}
            </p>
          </div>

          {/* PAB Token display */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(255,184,48,0.12) 0%, rgba(12,20,38,0.95) 100%)',
            border: '1px solid rgba(255,184,48,0.25)', borderRadius: '1.25rem', padding: '1.5rem', textAlign: 'center',
            position: 'relative', overflow: 'hidden',
            boxShadow: '0 12px 40px rgba(0,0,0,0.3), 0 0 40px rgba(255,184,48,0.05)',
          }}>
            <div style={{
              position: 'absolute', width: 120, height: 120, top: -30, right: -30,
              borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,184,48,0.25), transparent)',
              filter: 'blur(20px)', pointerEvents: 'none',
            }} />
            <div style={{ fontSize: 32, marginBottom: 4 }}>⚡</div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#FFB830', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>PAB Balance</p>
            <p style={{ fontSize: '2.25rem', fontWeight: 900, color: '#FFB830', fontFamily: 'Space Grotesk, sans-serif', textShadow: '0 0 20px rgba(255,184,48,0.6)' }}>
              {pabBalance.toLocaleString()}
            </p>
            <p style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 6 }}>Pabandi Reliability Tokens</p>
            <Link to="/wallet" style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 14,
              fontSize: 11, fontWeight: 700, padding: '6px 14px', borderRadius: 8,
              background: 'rgba(255,184,48,0.12)', color: '#FFB830', border: '1px solid rgba(255,184,48,0.25)',
            }}>
              View Wallet →
            </Link>
          </div>

          {/* Booking completion */}
          <div style={{ background: 'var(--color-surface)', border: '1px solid rgba(0,229,255,0.2)', borderRadius: '1.25rem', padding: '1.5rem', textAlign: 'center', boxShadow: '0 0 40px rgba(0,229,255,0.04)' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Completion Rate</p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <ArcGauge value={reservations.length > 0 ? Math.round((completed / reservations.length) * 100) : 0} color="#00E5FF" label="Completed %" />
            </div>
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 10 }}>
              {completed} of {reservations.length} bookings completed
            </p>
          </div>
        </div>

        {/* ── Tabs: History / Badges ── */}
        <div className="animate-fade-up-delay-2">
          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 4, width: 'fit-content' }}>
            {(['history', 'badges'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{
                  padding: '8px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                  background: activeTab === tab ? 'rgba(108,99,255,0.2)' : 'transparent',
                  color: activeTab === tab ? '#a5b4fc' : 'var(--color-text-muted)',
                  border: activeTab === tab ? '1px solid rgba(108,99,255,0.3)' : '1px solid transparent',
                  boxShadow: activeTab === tab ? '0 0 20px rgba(108,99,255,0.2)' : 'none',
                  textTransform: 'capitalize',
                }}>
                {tab === 'history' ? '📅 Booking History' : '🏅 Achievements'}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'history' ? (
            <div style={{ background: 'var(--color-surface)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '1.25rem', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#e8eef8', fontFamily: 'Space Grotesk, sans-serif' }}>Recent Bookings</h2>
                <Link to="/reservations" style={{ fontSize: 12, fontWeight: 700, color: '#6C63FF' }}>View All →</Link>
              </div>
              {reservations.length > 0 ? (
                <div>
                  {reservations.slice(0, 10).map((r, i) => (
                    <BookingItem key={r.id} reservation={r} index={i} />
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                  <CalendarIcon className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--color-text-dim)' }} />
                  <p style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 4 }}>No bookings yet</p>
                  <p style={{ fontSize: 12, marginBottom: 20 }}>Your booking history will appear here</p>
                  <Link to="/" className="btn-primary" style={{ fontSize: 13, padding: '8px 20px' }}>Find a Business</Link>
                </div>
              )}
            </div>
          ) : (
            <div style={{ background: 'var(--color-surface)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '1.25rem', padding: '1.5rem' }}>
              <div style={{ marginBottom: 16 }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#e8eef8', fontFamily: 'Space Grotesk, sans-serif' }}>Achievements</h2>
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {achievements.filter(a => a.earned).length} / {achievements.length} unlocked
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {achievements.map(a => (
                  <AchievementBadge key={a.label} {...a} />
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
