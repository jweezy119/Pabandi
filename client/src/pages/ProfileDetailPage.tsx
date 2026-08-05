import { useParams, Link } from 'react-router-dom';
import { getProfile } from './ProfilesPage';
import { tokens } from '../design-system';

export default function ProfileDetailPage() {
  const { id } = useParams<{ id: string }>();
  const profile = id ? getProfile(id) : undefined;

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

  return (
    <div className="min-h-screen font-body" style={{ background: tokens.color.background, color: tokens.color.text }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
        <Link to="/profiles" className="text-primary text-sm font-bold">← Back to profiles</Link>
        <section className="rounded-3xl border border-outline-variant/20 bg-surface-container-low p-6 sm:p-8 md:p-10">
          <h1 className="font-headline text-2xl sm:text-3xl md:text-4xl font-black">{profile.firstName} {profile.lastName}</h1>
          <p className="mt-2 text-sm sm:text-base text-on-surface-variant">{profile.headline}</p>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-high p-4">
              <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">Company</p>
              <p className="font-headline font-black text-sm mt-1">{profile.company}</p>
            </div>
            <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-high p-4">
              <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">Location</p>
              <p className="font-headline font-black text-sm mt-1">{profile.location}</p>
            </div>
            <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-high p-4">
              <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">Category</p>
              <p className="font-headline font-black text-sm mt-1">{profile.category}</p>
            </div>
            <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-high p-4">
              <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">Trust Velocity</p>
              <p className="font-headline font-black text-sm mt-1">{profile.trustVelocity.toFixed(2)}</p>
            </div>
            <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-high p-4">
              <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">Connections</p>
              <p className="font-headline font-black text-sm mt-1">{profile.connectionCount}</p>
            </div>
            <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-high p-4">
              <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-bold">Wallet</p>
              <p className="font-headline font-black text-xs mt-1 break-all">{profile.walletAddress}</p>
            </div>
          </div>
          <div className="mt-6">
            <a href={profile.githubUrl} target="_blank" rel="noreferrer" className="px-4 py-2.5 rounded-2xl bg-primary text-on-primary font-headline font-bold text-sm">View GitHub Profile</a>
          </div>
        </section>
      </div>
    </div>
  );
}
