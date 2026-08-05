import { useParams, Link, useNavigate } from 'react-router-dom';
import { getProfile } from './ProfilesPage';
import { tokens } from '../design-system';
import { useAuthStore } from '../store/authStore';

function Avatar({ initials, category }: { initials: string; category: string }) {
  const hue = ['freelance-dev','small-biz-owner','project-owner','solopreneur'].indexOf(category) * 90;
  return (
    <div
      className="flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-black shadow-lg"
      style={{
        background: `linear-gradient(135deg, hsl(${hue},70%,55%), hsl(${hue + 40},60%,40%))`,
        color: 'white',
      }}
    >
      {initials}
    </div>
  );
}

export default function ProfileDetailPage() {
  const { id } = useParams<{ id: string }>();
  const profile = id ? getProfile(id) : undefined;
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  if (!profile) {
    return (
      <div className="min-h-screen font-body" style={{ background: tokens.color.background, color: tokens.color.text }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <p className="text-sm text-on-surface-variant">Profile not found.</p>
          <Link to="/profiles" className="text-primary text-sm font-bold mt-2 inline-block">Back to profiles</Link>
        </div>
      </div>
    );
  }

  const initials = `${profile.firstName[0]}${profile.lastName[0]}`.toUpperCase();
  const categoryLabel = ({freelance_dev:'Freelance Dev',small_biz_owner:'Business Owner',project_owner:'Project Owner',solopreneur:'Solopreneur'} as any)[profile.category.replace('-', '_')] || profile.category;

  return (
    <div className="min-h-screen font-body" style={{ background: tokens.color.background, color: tokens.color.text }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform: translateY(12px);} to { opacity:1; transform: translateY(0);} }
        .anim-fade-up { animation: fadeUp .45s ease-out both; }
      `}</style>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
        <Link to="/profiles" className="text-primary text-sm font-bold anim-fade-up">← Back to profiles</Link>

        <section className="relative overflow-hidden rounded-3xl border border-outline-variant/20 bg-surface-container-low p-6 sm:p-8 md:p-10 anim-fade-up">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-60 h-60 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
            <Avatar initials={initials} category={profile.category} />
            <div className="min-w-0">
              <h1 className="font-headline text-2xl sm:text-3xl md:text-4xl font-black leading-tight">{profile.firstName} {profile.lastName}</h1>
              <p className="mt-1 text-sm sm:text-base text-on-surface-variant">{profile.headline}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Pill label={categoryLabel} />
                <Pill label={`${profile.company}`} />
                <Pill label={profile.location} />
              </div>
            </div>
          </div>

          <div className="relative mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Connections" value={String(profile.connectionCount)} />
            <Stat label="Trust velocity" value={profile.trustVelocity.toFixed(2)} />
            <Stat label="Category" value={categoryLabel} />
            <Stat label="Wallet" value={`${profile.walletAddress?.slice(0,8)}...${profile.walletAddress?.slice(-6)}`} copy={profile.walletAddress} />
          </div>

          <div className="relative mt-6 flex flex-wrap gap-3">
            {profile.githubUrl && (
              <a href={profile.githubUrl} target="_blank" rel="noreferrer" className="px-4 py-2.5 rounded-2xl border border-outline-variant/20 bg-surface-container-high font-headline font-bold text-sm hover:bg-surface-container-high/80">Open GitHub</a>
            )}
            {isAuthenticated ? (
              <button onClick={() => navigate(`/search?q=${encodeURIComponent(profile.headline || profile.category)}&category=${encodeURIComponent(profile.category)}`)} className="px-4 py-2.5 rounded-2xl bg-primary text-on-primary font-headline font-bold text-sm shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30">Book similar</button>
            ) : (
              <Link to={`/login?redirect=${encodeURIComponent(`/search?q=${encodeURIComponent(profile.headline || profile.category)}&category=${encodeURIComponent(profile.category)}`)}`} className="px-4 py-2.5 rounded-2xl bg-primary text-on-primary font-headline font-bold text-sm shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30">Log in to book</Link>
            )}
          </div>
        </section>
      </div>

      {isAuthenticated && (
        <div className="fixed bottom-0 inset-x-0 border-t border-outline-variant/20 bg-surface-bright/80 backdrop-blur-xl">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-on-surface-variant font-bold">Book with escrow</p>
              <p className="text-sm font-headline font-black">{profile.firstName} {profile.lastName}</p>
            </div>
            <button onClick={() => navigate(`/search?q=${encodeURIComponent(profile.headline || profile.category)}&category=${encodeURIComponent(profile.category)}`)} className="px-4 py-2.5 rounded-2xl bg-primary text-on-primary font-headline font-bold text-sm shadow-lg shadow-primary/20">Book now</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Pill({ label }: { label: string }) {
  return <span className="px-3 py-1.5 rounded-full border border-outline-variant/20 bg-surface-container-high text-xs font-bold text-on-surface">{label}</span>;
}

function Stat({ label, value, copy }: { label: string; value: string; copy?: string }) {
  return (
    <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-high p-3">
      <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">{label}</p>
      <p className="font-headline font-black text-sm mt-1 break-all">{value}</p>
      {copy && (
        <button
          className="text-[11px] text-primary font-bold mt-1"
          onClick={() => navigator.clipboard.writeText(copy)}
        >Copy</button>
      )}
    </div>
  );
}
