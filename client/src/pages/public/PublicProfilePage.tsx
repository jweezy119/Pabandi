import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { userProfileService } from '../../services/api';
import {
  MapPin, Globe, ExternalLink, Check, Star, Shield,
  ArrowLeft, Share2, Copy
} from 'lucide-react';

interface SocialLink {
  id: string;
  platform: string;
  url: string;
  displayName?: string;
  verified: boolean;
}

interface PortfolioItem {
  id: string;
  title: string;
  description?: string;
  mediaUrl?: string;
  linkUrl?: string;
  position: number;
}

interface PublicProfile {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  bio: string;
  tagline: string;
  location: string;
  websiteUrl: string;
  avatarUrl: string;
  bannerUrl: string;
  bannerColor: string;
  accentColor: string;
  isPublic: boolean;
  showScores: boolean;
  showSocialLinks: boolean;
  showPortfolio: boolean;
  layoutStyle: string;
  reliabilityScore: number;
  trustScore: number;
  verificationTier: string;
  attestationCount: number;
  socialLinks: SocialLink[];
  portfolioItems: PortfolioItem[];
}

const PLATFORM_META: Record<string, { icon: string; label: string }> = {
  linkedin: { icon: '💼', label: 'LinkedIn' },
  x: { icon: '𝕏', label: 'X / Twitter' },
  github: { icon: '🐙', label: 'GitHub' },
  instagram: { icon: '📷', label: 'Instagram' },
  youtube: { icon: '▶️', label: 'YouTube' },
  tiktok: { icon: '🎵', label: 'TikTok' },
  website: { icon: '🌐', label: 'Website' },
  custom: { icon: '🔗', label: 'Link' },
};

function VerifiedBadge({ verified }: { verified: boolean }) {
  if (verified) {
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold text-[var(--sage)] bg-[var(--sage)]/10 px-2 py-0.5 rounded-full">
        <Check size={10} /> Verified
      </span>
    );
  }
  return <span className="w-2 h-2 rounded-full bg-[var(--muted-ochre)] inline-block" title="Could not verify" />;
}

function TrustScoresRow({ profile }: { profile: PublicProfile }) {
  if (!profile.showScores) return null;
  return (
    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
      <div className="text-center p-3 rounded-xl bg-white/60 border border-[rgba(191,179,163,0.15)] min-w-[80px]">
        <p className="text-2xl font-black" style={{ color: profile.accentColor }}>{Math.round(profile.reliabilityScore)}</p>
        <p className="text-[10px] uppercase tracking-wider text-[var(--soft-stone)] font-semibold mt-0.5">Reliability</p>
      </div>
      <div className="text-center p-3 rounded-xl bg-white/60 border border-[rgba(191,179,163,0.15)] min-w-[80px]">
        <p className="text-2xl font-black" style={{ color: profile.accentColor }}>{Math.round(profile.trustScore)}</p>
        <p className="text-[10px] uppercase tracking-wider text-[var(--soft-stone)] font-semibold mt-0.5">Trust</p>
      </div>
      <div className="text-center p-3 rounded-xl bg-white/60 border border-[rgba(191,179,163,0.15)] min-w-[80px]">
        <p className="text-sm font-bold px-2 py-1 rounded-md inline-block" style={{ background: profile.accentColor + '20', color: profile.accentColor }}>
          {profile.verificationTier}
        </p>
        <p className="text-[10px] uppercase tracking-wider text-[var(--soft-stone)] font-semibold mt-1">Tier</p>
      </div>
    </div>
  );
}

function ClassicLayout({ profile }: { profile: PublicProfile }) {
  const displayName = `${profile.firstName} ${profile.lastName}`.trim() || profile.username;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="h-48 md:h-56 relative" style={{ background: profile.bannerUrl ? `url(${profile.bannerUrl}) center/cover` : `linear-gradient(135deg, ${profile.bannerColor}, ${profile.bannerColor}CC)` }}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
      </div>

      <div className="px-5 pb-10 -mt-16 relative">
        <div className="w-28 h-28 rounded-full border-4 border-[var(--cream)] overflow-hidden mb-4 shadow-lg" style={{ background: profile.accentColor + '30' }}>
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt={displayName} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl font-bold" style={{ color: profile.accentColor }}>
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <h1 className="text-2xl md:text-3xl font-bold text-[var(--warm-ink)] font-headline">{displayName}</h1>
        <p className="text-base font-medium mt-0.5" style={{ color: profile.accentColor }}>@{profile.username}</p>
        {profile.tagline && <p className="text-[var(--soft-stone)] mt-1">{profile.tagline}</p>}

        <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-[var(--soft-stone)]">
          {profile.location && <span className="flex items-center gap-1"><MapPin size={14} /> {profile.location}</span>}
          {profile.websiteUrl && (
            <a href={profile.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline" style={{ color: profile.accentColor }}>
              <Globe size={14} /> {profile.websiteUrl.replace(/^https?:\/\//, '')}
            </a>
          )}
        </div>

        <div className="mt-6">
          <TrustScoresRow profile={profile} />
        </div>

        {profile.bio && (
          <div className="mt-6 p-4 rounded-xl bg-white/50 border border-[rgba(191,179,163,0.1)]">
            <p className="text-[var(--warm-ink)] leading-relaxed text-sm">{profile.bio}</p>
          </div>
        )}

        {profile.showSocialLinks && profile.socialLinks.length > 0 && (
          <div className="mt-6">
            <h3 className="text-xs uppercase tracking-wider text-[var(--soft-stone)] font-semibold mb-3">Connect</h3>
            <div className="space-y-2">
              {profile.socialLinks.map(link => {
                const meta = PLATFORM_META[link.platform] || PLATFORM_META.custom;
                return (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/60 border border-[rgba(191,179,163,0.15)] hover:border-[var(--clay)]/30 transition-colors group"
                  >
                    <span className="text-xl w-8 text-center">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--warm-ink)] group-hover:text-[var(--clay)] transition-colors">
                        {link.displayName || meta.label}
                      </p>
                      <p className="text-xs text-[var(--soft-stone)] truncate">{link.url.replace(/^https?:\/\//, '')}</p>
                    </div>
                    <VerifiedBadge verified={link.verified} />
                    <ExternalLink size={14} className="text-[var(--soft-stone)]" />
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {profile.showPortfolio && profile.portfolioItems.length > 0 && (
          <div className="mt-6">
            <h3 className="text-xs uppercase tracking-wider text-[var(--soft-stone)] font-semibold mb-3">Portfolio</h3>
            <div className="space-y-3">
              {profile.portfolioItems.map((item, i) => (
                <div key={item.id} className="p-4 rounded-xl bg-white/60 border border-[rgba(191,179,163,0.15)]">
                  <div className="flex items-start gap-3">
                    {i < 3 && <Star size={16} className="text-[var(--muted-ochre)] fill-[var(--muted-ochre)] mt-0.5 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-[var(--warm-ink)]">{item.title}</h4>
                      {item.description && <p className="text-sm text-[var(--soft-stone)] mt-1">{item.description}</p>}
                      {item.linkUrl && (
                        <a href={item.linkUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium mt-2 hover:underline" style={{ color: profile.accentColor }}>
                          <ExternalLink size={12} /> View project
                        </a>
                      )}
                    </div>
                    {item.mediaUrl && (
                      <img src={item.mediaUrl} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" loading="lazy" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {profile.attestationCount > 0 && (
          <div className="mt-6 flex items-center gap-2 text-sm text-[var(--soft-stone)]">
            <Shield size={14} className="text-[var(--sage)]" />
            <span>{profile.attestationCount} onchain attestation{profile.attestationCount !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function CompactLayout({ profile }: { profile: PublicProfile }) {
  const displayName = `${profile.firstName} ${profile.lastName}`.trim() || profile.username;

  return (
    <div className="max-w-lg mx-auto">
      <div className="rounded-2xl overflow-hidden border border-[rgba(191,179,163,0.2)] bg-white/60 backdrop-blur-sm">
        <div className="h-20 relative" style={{ background: profile.bannerUrl ? `url(${profile.bannerUrl}) center/cover` : profile.bannerColor }} />

        <div className="px-5 pb-5 -mt-8 relative">
          <div className="flex items-end gap-3">
            <div className="w-16 h-16 rounded-full border-3 border-white overflow-hidden shadow-md shrink-0" style={{ background: profile.accentColor + '30' }}>
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xl font-bold" style={{ color: profile.accentColor }}>
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="pb-1">
              <h1 className="text-lg font-bold text-[var(--warm-ink)] font-headline">{displayName}</h1>
              <p className="text-xs font-medium" style={{ color: profile.accentColor }}>@{profile.username}</p>
            </div>
          </div>

          {profile.tagline && <p className="text-sm text-[var(--soft-stone)] mt-3">{profile.tagline}</p>}

          {profile.showScores && (
            <div className="flex items-center gap-4 mt-3 p-2 rounded-lg bg-[var(--warm-sand)]/30">
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-black" style={{ color: profile.accentColor }}>{Math.round(profile.reliabilityScore)}</span>
                <span className="text-[10px] text-[var(--soft-stone)] uppercase">Reliability</span>
              </div>
              <div className="w-px h-6 bg-[rgba(191,179,163,0.2)]" />
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-black" style={{ color: profile.accentColor }}>{Math.round(profile.trustScore)}</span>
                <span className="text-[10px] text-[var(--soft-stone)] uppercase">Trust</span>
              </div>
              <div className="w-px h-6 bg-[rgba(191,179,163,0.2)]" />
              <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: profile.accentColor + '20', color: profile.accentColor }}>
                {profile.verificationTier}
              </span>
            </div>
          )}

          {profile.bio && <p className="text-sm text-[var(--warm-ink)] mt-3 leading-relaxed line-clamp-3">{profile.bio}</p>}

          <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-[var(--soft-stone)]">
            {profile.location && <span className="flex items-center gap-1"><MapPin size={12} /> {profile.location}</span>}
            {profile.websiteUrl && (
              <a href={profile.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline" style={{ color: profile.accentColor }}>
                <Globe size={12} /> {profile.websiteUrl.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>

          {profile.showSocialLinks && profile.socialLinks.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {profile.socialLinks.map(link => {
                const meta = PLATFORM_META[link.platform] || PLATFORM_META.custom;
                return (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--warm-sand)]/50 text-[var(--warm-ink)] hover:bg-[var(--warm-sand)] transition-colors"
                  >
                    <span>{meta.icon}</span>
                    {link.displayName || meta.label}
                    {link.verified && <Check size={10} className="text-[var(--sage)]" />}
                  </a>
                );
              })}
            </div>
          )}

          {profile.showPortfolio && profile.portfolioItems.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {profile.portfolioItems.slice(0, 4).map((item, i) => (
                <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/40">
                  {i < 3 && <Star size={12} className="text-[var(--muted-ochre)] fill-[var(--muted-ochre)]" />}
                  <span className="text-sm font-medium text-[var(--warm-ink)] truncate">{item.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ShowcaseLayout({ profile }: { profile: PublicProfile }) {
  const displayName = `${profile.firstName} ${profile.lastName}`.trim() || profile.username;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="relative rounded-3xl overflow-hidden min-h-[280px]" style={{ background: profile.bannerUrl ? `url(${profile.bannerUrl}) center/cover` : `linear-gradient(135deg, ${profile.bannerColor} 0%, ${profile.bannerColor}99 100%)` }}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        <div className="relative px-6 md:px-10 pt-20 pb-8">
          <div className="flex flex-col md:flex-row items-start md:items-end gap-5">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl border-4 border-white/20 overflow-hidden shadow-2xl" style={{ background: profile.accentColor + '40' }}>
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl md:text-4xl font-bold text-white">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl md:text-4xl font-bold text-white font-headline">{displayName}</h1>
              <p className="text-white/80 font-medium mt-1">@{profile.username}</p>
              {profile.tagline && <p className="text-white/70 mt-2 text-sm md:text-base">{profile.tagline}</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 md:px-10 py-6 space-y-6">
        {profile.showScores && (
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            <div className="text-center p-4 rounded-xl bg-white/60 border border-[rgba(191,179,163,0.15)] min-w-[100px]">
              <p className="text-3xl font-black" style={{ color: profile.accentColor }}>{Math.round(profile.reliabilityScore)}</p>
              <p className="text-[10px] uppercase tracking-wider text-[var(--soft-stone)] font-semibold mt-0.5">Reliability</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-white/60 border border-[rgba(191,179,163,0.15)] min-w-[100px]">
              <p className="text-3xl font-black" style={{ color: profile.accentColor }}>{Math.round(profile.trustScore)}</p>
              <p className="text-[10px] uppercase tracking-wider text-[var(--soft-stone)] font-semibold mt-0.5">Trust</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-white/60 border border-[rgba(191,179,163,0.15)] min-w-[100px]">
              <p className="text-sm font-bold px-3 py-1.5 rounded-md inline-block" style={{ background: profile.accentColor + '20', color: profile.accentColor }}>
                {profile.verificationTier}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-[var(--soft-stone)] font-semibold mt-1">Tier</p>
            </div>
            {profile.attestationCount > 0 && (
              <div className="text-center p-4 rounded-xl bg-white/60 border border-[rgba(191,179,163,0.15)] min-w-[100px]">
                <p className="text-3xl font-black text-[var(--sage)]">{profile.attestationCount}</p>
                <p className="text-[10px] uppercase tracking-wider text-[var(--soft-stone)] font-semibold mt-0.5">Attestations</p>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--soft-stone)]">
          {profile.location && <span className="flex items-center gap-1.5"><MapPin size={14} /> {profile.location}</span>}
          {profile.websiteUrl && (
            <a href={profile.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:underline" style={{ color: profile.accentColor }}>
              <Globe size={14} /> {profile.websiteUrl.replace(/^https?:\/\//, '')}
            </a>
          )}
        </div>

        {profile.bio && (
          <div className="p-5 rounded-2xl bg-white/60 border border-[rgba(191,179,163,0.15)]">
            <p className="text-[var(--warm-ink)] leading-relaxed">{profile.bio}</p>
          </div>
        )}

        {profile.showSocialLinks && profile.socialLinks.length > 0 && (
          <div>
            <h3 className="text-xs uppercase tracking-wider text-[var(--soft-stone)] font-semibold mb-3">Connect</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {profile.socialLinks.map(link => {
                const meta = PLATFORM_META[link.platform] || PLATFORM_META.custom;
                return (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/60 border border-[rgba(191,179,163,0.15)] hover:border-[var(--clay)]/30 transition-colors"
                  >
                    <span className="text-xl">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--warm-ink)] truncate">{link.displayName || meta.label}</p>
                      <p className="text-xs text-[var(--soft-stone)] truncate">{link.url.replace(/^https?:\/\//, '')}</p>
                    </div>
                    <VerifiedBadge verified={link.verified} />
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {profile.showPortfolio && profile.portfolioItems.length > 0 && (
          <div>
            <h3 className="text-xs uppercase tracking-wider text-[var(--soft-stone)] font-semibold mb-3">Featured Work</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {profile.portfolioItems.map((item, i) => (
                <div key={item.id} className="rounded-xl overflow-hidden bg-white/60 border border-[rgba(191,179,163,0.15)]">
                  {item.mediaUrl && (
                    <div className="h-40 overflow-hidden">
                      <img src={item.mediaUrl} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start gap-2">
                      {i < 3 && <Star size={14} className="text-[var(--muted-ochre)] fill-[var(--muted-ochre)] mt-0.5 shrink-0" />}
                      <div>
                        <h4 className="font-semibold text-[var(--warm-ink)] text-sm">{item.title}</h4>
                        {item.description && <p className="text-xs text-[var(--soft-stone)] mt-1 line-clamp-2">{item.description}</p>}
                        {item.linkUrl && (
                          <a href={item.linkUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium mt-2 hover:underline" style={{ color: profile.accentColor }}>
                            <ExternalLink size={10} /> View
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PublicProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await userProfileService.getPublicProfile(username!);
        setProfile(res.data.data);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    if (username) load();
  }, [username]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareX = () => {
    const text = `Check out ${profile?.firstName}'s Trust Passport on Pabandi`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleShareLinkedIn = () => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[var(--clay)]/20 border-t-[var(--clay)] rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-[var(--cream)] flex flex-col items-center justify-center p-6">
        <div className="w-16 h-16 rounded-full bg-[var(--warm-sand)] flex items-center justify-center mb-4">
          <Shield size={28} className="text-[var(--soft-stone)]" />
        </div>
        <h1 className="text-xl font-bold text-[var(--warm-ink)] font-headline">Profile not found</h1>
        <p className="text-[var(--soft-stone)] mt-2 text-center">This profile doesn't exist or is set to private.</p>
        <Link to="/" className="mt-6 flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--clay)] text-white text-sm font-medium hover:bg-[var(--terracotta)] transition-colors">
          <ArrowLeft size={14} /> Back to home
        </Link>
      </div>
    );
  }

  const displayName = `${profile.firstName} ${profile.lastName}`.trim() || profile.username;
  const layouts = { classic: ClassicLayout, compact: CompactLayout, showcase: ShowcaseLayout };
  const LayoutComponent = layouts[profile.layoutStyle as keyof typeof layouts] || ClassicLayout;

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <Helmet>
        <title>{displayName} — Verified Trust Passport</title>
        <meta property="og:title" content={displayName} />
        <meta property="og:description" content={profile.tagline || profile.bio || `${displayName}'s Trust Passport on Pabandi`} />
        <meta property="og:image" content={profile.avatarUrl || ''} />
        <meta property="og:url" content={`https://pabandi.com/u/${profile.username}`} />
        <meta name="twitter:card" content="summary" />
      </Helmet>

      <div className="sticky top-0 z-20 bg-[var(--cream)]/80 backdrop-blur-md border-b border-[rgba(191,179,163,0.1)]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm font-medium text-[var(--soft-stone)] hover:text-[var(--warm-ink)] transition-colors">
            <ArrowLeft size={16} /> Home
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--warm-sand)]/50 text-[var(--warm-ink)] hover:bg-[var(--warm-sand)] transition-colors"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <button
              onClick={handleShareX}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--warm-sand)]/50 text-[var(--warm-ink)] hover:bg-[var(--warm-sand)] transition-colors"
            >
              <Share2 size={12} /> Share to X
            </button>
            <button
              onClick={handleShareLinkedIn}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--warm-sand)]/50 text-[var(--warm-ink)] hover:bg-[var(--warm-sand)] transition-colors"
            >
              <Linkedin size={12} /> LinkedIn
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 md:py-10">
        <LayoutComponent profile={profile} />
      </div>

      <div className="border-t border-[rgba(191,179,163,0.1)] py-6 text-center">
        <p className="text-xs text-[var(--soft-stone)]">
          Powered by <span className="font-semibold text-[var(--clay)]">Pabandi</span> Trust Passport
        </p>
      </div>
    </div>
  );
}
