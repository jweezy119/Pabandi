import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

interface TrustProfile {
  displayName: string;
  category: string;
  handle: string;
  paymentScore: number;
  showUpScore: number;
  deliveryScore: number;
  paymentSampleSize: number;
  showUpSampleSize: number;
  deliverySampleSize: number;
  verifiedIdentity: boolean;
  totalEvents: number;
  memberSince: string;
}

function getTier(payment: number, showUp: number, delivery: number): { label: string; color: string; bg: string } {
  const avg = (payment + showUp + delivery) / 3;
  if (avg >= 700) return { label: 'Reliable', color: '#2D6A4F', bg: '#D8F3DC' };
  if (avg >= 450) return { label: 'Building', color: '#B08D57', bg: '#FFF3E0' };
  return { label: 'New', color: '#7A736E', bg: '#F0ECE6' };
}

function ScoreRing({ score, label, sampleSize }: { score: number; label: string; sampleSize: number }) {
  const pct = Math.min(score / 1000, 1);
  const r = 42;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  const color = score >= 700 ? '#2D6A4F' : score >= 450 ? '#B08D57' : '#BFB3A3';

  return (
    <div style={{ textAlign: 'center' }}>
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#F0ECE6" strokeWidth="6" />
        <circle
          cx="50" cy="50" r={r} fill="none"
          stroke={color} strokeWidth="6"
          strokeDasharray={`${circ}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
        <text x="50" y="46" textAnchor="middle" fontSize="18" fontWeight="700" fill="#3A322B">{score}</text>
        <text x="50" y="62" textAnchor="middle" fontSize="9" fill="#7A736E">/ 1000</text>
      </svg>
      <p style={{ margin: '4px 0 0', fontWeight: 600, fontSize: '14px', color: '#3A322B' }}>{label}</p>
      <p style={{ fontSize: '11px', color: '#7A736E' }}>
        {sampleSize === 0 ? 'No data yet' : `${sampleSize} event${sampleSize !== 1 ? 's' : ''}`}
      </p>
    </div>
  );
}

export function TrustProfilePage() {
  const { passportId } = useParams<{ passportId: string }>();
  const [profile, setProfile] = useState<TrustProfile | null>(null);
  const [attestations, setAttestations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!passportId) return;
    const baseUrl = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
    Promise.all([
      fetch(`${baseUrl}/api/v1/trust-profile/${passportId}`).then(res => {
        if (!res.ok) throw new Error('Profile not found');
        return res.json();
      }),
      fetch(`${baseUrl}/api/v1/trust/${passportId}/attestations`).then(res => res.ok ? res.json() : { success: true, data: { attestations: [] } }),
    ]).then(([profileData, attestationsData]) => {
      setProfile(profileData.data);
      setAttestations(attationsData.data?.attestations || []);
    }).catch(() => setError('Trust profile not found or is private.'))
      .finally(() => setLoading(false));
  }, [passportId]);

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <p style={{ textAlign: 'center', color: '#7A736E' }}>Loading trust profile…</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <span style={{ fontSize: '48px' }}>🔒</span>
            <h2 style={{ margin: '16px 0 8px', color: '#3A322B' }}>Profile Not Found</h2>
            <p style={{ color: '#7A736E' }}>{error || 'This trust profile does not exist or is set to private.'}</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const tier = getTier(profile.paymentScore, profile.showUpScore, profile.deliveryScore);
  const profileUrl = `${window.location.origin}/trust/${passportId}`;

  return (
    <div style={styles.page}>
      <Helmet>
        <title>{profile.displayName} — Trust Profile | Pabandi</title>
        <meta name="description" content={`${profile.displayName} has a verified trust profile on Pabandi. View their reliability scores.`} />
      </Helmet>

      <div style={styles.card}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #C4A882, #A85A3C)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: 24,
            boxShadow: '0 4px 12px rgba(168,90,60,0.3)',
          }}>
            {profile.displayName.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#3A322B' }}>{profile.displayName}</h1>
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#7A736E' }}>
              {profile.category.replace(/_/g, ' ')} · Member since {new Date(profile.memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </p>
          </div>
          <div style={{
            padding: '4px 12px', borderRadius: 20,
            background: tier.bg, color: tier.color,
            fontWeight: 700, fontSize: '13px',
          }}>
            {tier.label}
          </div>
        </div>

        {/* Scores */}
        <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '16px', padding: '16px 0', borderTop: '1px solid #F0ECE6', borderBottom: '1px solid #F0ECE6' }}>
          <ScoreRing score={profile.paymentScore} label="Payment" sampleSize={profile.paymentSampleSize} />
          <ScoreRing score={profile.showUpScore} label="Show-Up" sampleSize={profile.showUpSampleSize} />
          <ScoreRing score={profile.deliveryScore} label="Delivery" sampleSize={profile.deliverySampleSize} />
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '16px 0' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '24px', fontWeight: 700, color: '#3A322B', margin: 0 }}>{profile.totalEvents}</p>
            <p style={{ fontSize: '12px', color: '#7A736E', margin: '2px 0 0' }}>Verified Events</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '24px', fontWeight: 700, color: profile.verifiedIdentity ? '#2D6A4F' : '#BFB3A3', margin: 0 }}>
              {profile.verifiedIdentity ? '✓' : '—'}
            </p>
            <p style={{ fontSize: '12px', color: '#7A736E', margin: '2px 0 0' }}>ID Verified</p>
          </div>
          {attestations.length > 0 && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '24px', fontWeight: 700, color: '#14b8a6', margin: 0 }}>{attestations.length}</p>
              <p style={{ fontSize: '12px', color: '#7A736E', margin: '2px 0 0' }}>Onchain Verified</p>
            </div>
          )}
        </div>

        {/* Onchain attestations */}
        {attestations.length > 0 && (
          <div style={{
            background: '#F0FDFA', borderRadius: 12, padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 12, marginTop: 12,
            border: '1px solid #99F6E4',
          }}>
            <span style={{ fontSize: 24 }}>⛓️</span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: '#0F766E' }}>Verified on Solana</p>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#7A736E' }}>
                {attestations.length} trust event{attestations.length !== 1 ? 's' : ''} attested on-chain
              </p>
            </div>
            {attestations[0]?.explorerUrl && (
              <a
                href={attestations[0].explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '4px 12px', borderRadius: 8, background: '#14b8a6', color: '#fff',
                  fontWeight: 700, fontSize: '11px', textDecoration: 'none',
                }}
              >
                View on Solscan
              </a>
            )}
            <button
              onClick={() => {
                const baseUrl = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
                window.open(`${baseUrl}/api/v1/trust/${passportId}/attestations/export`, '_blank');
              }}
              style={{
                padding: '4px 12px', borderRadius: 8, background: 'transparent',
                color: '#0F766E', fontWeight: 700, fontSize: '11px', border: '1px solid #5EEAD4',
                cursor: 'pointer',
              }}
            >
              Export JSON
            </button>
          </div>
        )}

        {/* Badge */}
        <div style={{
          background: '#F5EFE6', borderRadius: 12, padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 12, marginTop: 8,
        }}>
          <span style={{ fontSize: 28 }}>◈</span>
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: '#3A322B' }}>Reliability Verified by Pabandi</p>
            <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#7A736E' }}>
              Trust scores are calculated from real transaction history across the Pabandi network.
            </p>
          </div>
        </div>

        {/* QR section */}
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(profileUrl)}&bgcolor=F5EFE6&color=3A322B`}
            alt="QR code for this trust profile"
            width={120} height={120}
            style={{ borderRadius: 8 }}
          />
          <p style={{ fontSize: '11px', color: '#7A736E', marginTop: 8 }}>Scan to view this profile</p>
        </div>
      </div>

      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <div style={{ textAlign: 'center', padding: '24px 0' }}>
      <a
        href="https://pabandi.com"
        style={{ color: '#7A736E', fontSize: '13px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        <span style={{ fontSize: 16 }}>◈</span>
        Powered by PabandiOS
      </a>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #F5EFE6 0%, #EDE5D8 100%)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '24px 16px',
    fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
  },
  card: {
    background: '#FFFFFF',
    borderRadius: 20,
    padding: '28px',
    maxWidth: 440,
    width: '100%',
    boxShadow: '0 8px 32px rgba(58,50,43,0.08), 0 2px 8px rgba(58,50,43,0.04)',
  },
};
