import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { userProfileService } from '../../services/api';
import toast from 'react-hot-toast';
import {
  User, Link2, Briefcase, Palette, ChevronDown, ChevronUp, GripVertical,
  Plus, Trash2, ExternalLink, Eye, EyeOff, Star, Check, X, RotateCcw,
  Globe, MapPin, Camera, Image
} from 'lucide-react';

interface SocialLink {
  id: string;
  platform: string;
  url: string;
  displayName?: string;
  position: number;
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

interface ProfileData {
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
  socialLinks: SocialLink[];
  portfolioItems: PortfolioItem[];
}

const PLATFORMS = [
  { value: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { value: 'x', label: 'X / Twitter', icon: '𝕏' },
  { value: 'github', label: 'GitHub', icon: '🐙' },
  { value: 'instagram', label: 'Instagram', icon: '📷' },
  { value: 'youtube', label: 'YouTube', icon: '▶️' },
  { value: 'tiktok', label: 'TikTok', icon: '🎵' },
  { value: 'website', label: 'Website', icon: '🌐' },
  { value: 'custom', label: 'Custom', icon: '🔗' },
];

const CLAY_PRESETS = ['#C97B5A', '#A85A3C', '#D4A5A5', '#D9A854', '#8A9A7B', '#B8C9D4', '#5A5348', '#2A2520'];
const ACCENT_PRESETS = ['#8A9A7B', '#C97B5A', '#D9A854', '#B8C9D4', '#D4A5A5', '#5A5348'];

const DEFAULT_PROFILE: Partial<ProfileData> = {
  username: '', bio: '', tagline: '', location: '', websiteUrl: '',
  avatarUrl: '', bannerUrl: '', bannerColor: '#C97B5A', accentColor: '#8A9A7B',
  isPublic: true, showScores: true, showSocialLinks: true, showPortfolio: true,
  layoutStyle: 'classic',
};

function CharCount({ current, max }: { current: number; max: number }) {
  return <span className={`text-xs ${current > max ? 'text-red-500' : 'text-[var(--soft-stone)]'}`}>{current}/{max}</span>;
}

function Section({ title, icon: Icon, children, defaultOpen = true }: {
  title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white/60 backdrop-blur-sm border border-[rgba(191,179,163,0.2)] rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-5 hover:bg-[var(--warm-sand)]/30 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--clay)]/10 flex items-center justify-center">
            <Icon size={16} className="text-[var(--clay)]" />
          </div>
          <span className="font-semibold text-[var(--warm-ink)]">{title}</span>
        </div>
        {open ? <ChevronUp size={18} className="text-[var(--soft-stone)]" /> : <ChevronDown size={18} className="text-[var(--soft-stone)]" />}
      </button>
      {open && <div className="px-5 pb-5 space-y-4 border-t border-[rgba(191,179,163,0.1)]">{children}</div>}
    </div>
  );
}

function Toggle({ label, description, checked, onChange }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium text-[var(--warm-ink)]">{label}</p>
        {description && <p className="text-xs text-[var(--soft-stone)] mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-[var(--sage)]' : 'bg-[var(--warm-sand)]'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}

function ColorPicker({ label, value, presets, onChange }: {
  label: string; value: string; presets: string[]; onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-[var(--warm-ink)] mb-2">{label}</p>
      <div className="flex items-center gap-2 flex-wrap">
        {presets.map(c => (
          <button
            key={c}
            onClick={() => onChange(c)}
            className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${value === c ? 'border-[var(--warm-ink)] scale-110' : 'border-transparent'}`}
            style={{ backgroundColor: c }}
          />
        ))}
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-8 h-8 rounded-full cursor-pointer border-0 p-0 bg-transparent"
        />
      </div>
    </div>
  );
}

function LivePreview({ profile }: { profile: ProfileData }) {
  const displayName = profile.firstName || profile.lastName
    ? `${profile.firstName} ${profile.lastName}`.trim()
    : profile.username || 'Your Name';

  return (
    <div className="w-[375px] mx-auto">
      <div className="rounded-[28px] overflow-hidden shadow-2xl border border-[rgba(191,179,163,0.2)]" style={{ background: 'var(--cream)' }}>
        {/* Banner */}
        <div className="h-32 relative" style={{ background: profile.bannerUrl ? `url(${profile.bannerUrl}) center/cover` : profile.bannerColor }}>
          {profile.isPublic && (
            <div className="absolute top-3 right-3 bg-black/30 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1">
              <Globe size={10} /> Public
            </div>
          )}
        </div>

        {/* Avatar + Info */}
        <div className="px-5 pb-5 -mt-12 relative">
          <div className="w-24 h-24 rounded-full border-4 border-[var(--cream)] overflow-hidden mb-3" style={{ background: profile.accentColor + '30' }}>
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl font-bold" style={{ color: profile.accentColor }}>
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <h2 className="text-xl font-bold text-[var(--warm-ink)] font-headline">{displayName}</h2>
          {profile.username && <p className="text-sm text-[var(--clay)] font-medium">@{profile.username}</p>}
          {profile.tagline && <p className="text-sm text-[var(--soft-stone)] mt-1">{profile.tagline}</p>}
          {profile.location && (
            <p className="text-xs text-[var(--soft-stone)] mt-1 flex items-center gap-1"><MapPin size={12} /> {profile.location}</p>
          )}

          {/* Trust Scores */}
          {profile.showScores && (
            <div className="mt-4 p-3 rounded-xl bg-white/60 border border-[rgba(191,179,163,0.15)]">
              <p className="text-[10px] uppercase tracking-wider text-[var(--soft-stone)] font-semibold mb-2">Trust Score</p>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-2xl font-black" style={{ color: profile.accentColor }}>{Math.round(profile.reliabilityScore || 0)}</p>
                  <p className="text-[10px] text-[var(--soft-stone)]">Reliability</p>
                </div>
                <div className="w-px h-8 bg-[rgba(191,179,163,0.2)]" />
                <div className="text-center">
                  <p className="text-2xl font-black" style={{ color: profile.accentColor }}>{Math.round(profile.trustScore || 0)}</p>
                  <p className="text-[10px] text-[var(--soft-stone)]">Trust</p>
                </div>
                <div className="w-px h-8 bg-[rgba(191,179,163,0.2)]" />
                <div className="text-center">
                  <p className="text-sm font-bold px-2 py-1 rounded-md" style={{ background: profile.accentColor + '20', color: profile.accentColor }}>
                    {profile.verificationTier || 'BASIC'}
                  </p>
                  <p className="text-[10px] text-[var(--soft-stone)] mt-1">Tier</p>
                </div>
              </div>
            </div>
          )}

          {/* Bio */}
          {profile.bio && <p className="mt-4 text-sm text-[var(--warm-ink)] leading-relaxed">{profile.bio}</p>}

          {/* Social Links */}
          {profile.showSocialLinks && profile.socialLinks.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.socialLinks.slice(0, 5).map(link => {
                const platform = PLATFORMS.find(p => p.value === link.platform);
                return (
                  <span key={link.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/70 border border-[rgba(191,179,163,0.2)] text-[var(--warm-ink)]">
                    <span>{platform?.icon}</span>
                    {link.displayName || platform?.label || link.platform}
                    {link.verified && <Check size={12} className="text-[var(--sage)]" />}
                  </span>
                );
              })}
            </div>
          )}

          {/* Portfolio */}
          {profile.showPortfolio && profile.portfolioItems.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] uppercase tracking-wider text-[var(--soft-stone)] font-semibold mb-2">Portfolio</p>
              <div className="space-y-2">
                {profile.portfolioItems.slice(0, 3).map((item, i) => (
                  <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/50 border border-[rgba(191,179,163,0.1)]">
                    {i < 3 && <Star size={14} className="text-[var(--muted-ochre)] fill-[var(--muted-ochre)]" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--warm-ink)] truncate">{item.title}</p>
                      {item.description && <p className="text-xs text-[var(--soft-stone)] truncate">{item.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Website */}
          {profile.websiteUrl && (
            <a href={profile.websiteUrl} target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center gap-1.5 text-xs font-medium hover:underline" style={{ color: profile.accentColor }}>
              <ExternalLink size={12} /> {profile.websiteUrl.replace(/^https?:\/\//, '')}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProfileEditorPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<ProfileData>({
    id: '', username: '', firstName: '', lastName: '', bio: '', tagline: '',
    location: '', websiteUrl: '', avatarUrl: '', bannerUrl: '',
    bannerColor: '#C97B5A', accentColor: '#8A9A7B',
    isPublic: true, showScores: true, showSocialLinks: true, showPortfolio: true,
    layoutStyle: 'classic', reliabilityScore: 750, trustScore: 50, verificationTier: 'BASIC',
    socialLinks: [], portfolioItems: [],
  });
  const [original, setOriginal] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [newPlatform, setNewPlatform] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [showAddLink, setShowAddLink] = useState(false);
  const [newPortfolio, setNewPortfolio] = useState({ title: '', description: '', mediaUrl: '', linkUrl: '' });
  const [showAddPortfolio, setShowAddPortfolio] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await userProfileService.getProfile();
        const data = res.data.data;
        setProfile(data);
        setOriginal(JSON.parse(JSON.stringify(data)));
      } catch (err) {
        toast.error('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const update = useCallback((patch: Partial<ProfileData>) => {
    setProfile(prev => ({ ...prev, ...patch }));
    setDirty(true);
  }, []);

  const handleUsernameChange = (val: string) => {
    update({ username: val });
    if (val && !/^[a-z0-9-]{3,20}$/.test(val)) {
      setUsernameError('3-20 chars, lowercase letters, numbers, dashes only');
    } else {
      setUsernameError('');
    }
  };

  const handleSave = async () => {
    if (usernameError) { toast.error('Fix username before saving'); return; }
    setSaving(true);
    try {
      const { socialLinks, portfolioItems, ...profileFields } = profile;
      await userProfileService.updateProfile(profileFields);
      setOriginal(JSON.parse(JSON.stringify(profile)));
      setDirty(false);
      toast.success('Profile saved');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (original) {
      setProfile(JSON.parse(JSON.stringify(original)));
      setDirty(false);
    }
  };

  const handleAddSocialLink = async () => {
    if (!newPlatform || !newUrl) { toast.error('Platform and URL required'); return; }
    try {
      const res = await userProfileService.createSocialLink({ platform: newPlatform, url: newUrl, displayName: newDisplayName || undefined });
      update({ socialLinks: [...profile.socialLinks, res.data.data] });
      setNewPlatform(''); setNewUrl(''); setNewDisplayName(''); setShowAddLink(false);
      toast.success('Link added');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add link');
    }
  };

  const handleVerifySocialLink = async (id: string) => {
    try {
      const res = await userProfileService.verifySocialLink(id);
      const updated = res.data.data;
      update({ socialLinks: profile.socialLinks.map(l => l.id === id ? updated : l) });
      toast.success(updated.verified ? 'Link verified' : 'Could not verify link');
    } catch { toast.error('Verification failed'); }
  };

  const handleDeleteSocialLink = async (id: string) => {
    try {
      await userProfileService.deleteSocialLink(id);
      update({ socialLinks: profile.socialLinks.filter(l => l.id !== id) });
      toast.success('Link removed');
    } catch { toast.error('Failed to remove link'); }
  };

  const handleReorderSocialLinks = async (newOrder: SocialLink[]) => {
    update({ socialLinks: newOrder });
    try {
      await userProfileService.reorderSocialLinks(newOrder.map(l => l.id));
    } catch { /* silent */ }
  };

  const handleAddPortfolio = async () => {
    if (!newPortfolio.title) { toast.error('Title required'); return; }
    try {
      const res = await userProfileService.createPortfolioItem(newPortfolio);
      update({ portfolioItems: [...profile.portfolioItems, res.data.data] });
      setNewPortfolio({ title: '', description: '', mediaUrl: '', linkUrl: '' });
      setShowAddPortfolio(false);
      toast.success('Portfolio item added');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add item');
    }
  };

  const handleDeletePortfolio = async (id: string) => {
    try {
      await userProfileService.deletePortfolioItem(id);
      update({ portfolioItems: profile.portfolioItems.filter(i => i.id !== id) });
      toast.success('Item removed');
    } catch { toast.error('Failed to remove item'); }
  };

  const handleReorderPortfolio = async (newOrder: PortfolioItem[]) => {
    update({ portfolioItems: newOrder });
    try {
      await userProfileService.reorderPortfolioItems(newOrder.map(i => i.id));
    } catch { /* silent */ }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Max 2MB'); return; }
    const reader = new FileReader();
    reader.onload = () => update({ avatarUrl: reader.result as string });
    reader.readAsDataURL(file);
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Max 2MB'); return; }
    const reader = new FileReader();
    reader.onload = () => update({ bannerUrl: reader.result as string });
    reader.readAsDataURL(file);
  };

  const moveItem = <T extends { id: string }>(arr: T[], index: number, direction: -1 | 1): T[] => {
    const newArr = [...arr];
    const target = index + direction;
    if (target < 0 || target >= newArr.length) return newArr;
    [newArr[index], newArr[target]] = [newArr[target], newArr[index]];
    return newArr;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[var(--clay)]/20 border-t-[var(--clay)] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--cream)] pb-32">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[var(--cream)]/80 backdrop-blur-md border-b border-[rgba(191,179,163,0.15)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--warm-ink)] font-headline">Trust Passport</h1>
            <p className="text-sm text-[var(--soft-stone)]">Customize your public identity</p>
          </div>
          <div className="flex items-center gap-2">
            {dirty && <span className="text-xs text-[var(--clay)] font-medium">Unsaved changes</span>}
            <button onClick={handleReset} disabled={!dirty} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-[var(--soft-stone)] hover:bg-[var(--warm-sand)]/50 disabled:opacity-40 transition-colors">
              <RotateCcw size={14} /> Reset
            </button>
            <button onClick={handleSave} disabled={saving || !dirty} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--clay)] text-white hover:bg-[var(--terracotta)] disabled:opacity-40 transition-colors shadow-sm">
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex gap-8 items-start">
          {/* Left: Editor */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Identity */}
            <Section title="Identity" icon={User}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                <div>
                  <label className="text-sm font-medium text-[var(--warm-ink)]">Username</label>
                  <div className="mt-1 flex items-center">
                    <span className="text-sm text-[var(--soft-stone)] mr-1">pabandi.com/u/</span>
                    <input
                      value={profile.username}
                      onChange={e => handleUsernameChange(e.target.value)}
                      placeholder="jane-doe"
                      className="flex-1 px-3 py-2 rounded-lg border border-[rgba(191,179,163,0.3)] bg-white/50 text-sm text-[var(--warm-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--clay)]/30"
                    />
                  </div>
                  {usernameError && <p className="text-xs text-red-500 mt-1">{usernameError}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--warm-ink)]">Display Name</label>
                  <input
                    value={`${profile.firstName} ${profile.lastName}`}
                    disabled
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-[rgba(191,179,163,0.15)] bg-[rgba(191,179,163,0.05)] text-sm text-[var(--soft-stone)]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-[var(--warm-ink)]">Tagline</label>
                  <CharCount current={profile.tagline?.length || 0} max={60} />
                </div>
                <input
                  value={profile.tagline}
                  onChange={e => update({ tagline: e.target.value.slice(0, 60) })}
                  placeholder="What do you do?"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-[rgba(191,179,163,0.3)] bg-white/50 text-sm text-[var(--warm-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--clay)]/30"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-[var(--warm-ink)]">Bio</label>
                  <CharCount current={profile.bio?.length || 0} max={280} />
                </div>
                <textarea
                  value={profile.bio}
                  onChange={e => update({ bio: e.target.value.slice(0, 280) })}
                  placeholder="Tell people about yourself..."
                  rows={3}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-[rgba(191,179,163,0.3)] bg-white/50 text-sm text-[var(--warm-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--clay)]/30 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-[var(--warm-ink)]">Location</label>
                  <input
                    value={profile.location}
                    onChange={e => update({ location: e.target.value })}
                    placeholder="City, Country"
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-[rgba(191,179,163,0.3)] bg-white/50 text-sm text-[var(--warm-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--clay)]/30"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--warm-ink)]">Website</label>
                  <input
                    value={profile.websiteUrl}
                    onChange={e => update({ websiteUrl: e.target.value })}
                    placeholder="https://yoursite.com"
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-[rgba(191,179,163,0.3)] bg-white/50 text-sm text-[var(--warm-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--clay)]/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-[var(--warm-ink)]">Avatar</label>
                  <div className="mt-1 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[rgba(191,179,163,0.2)] bg-[var(--warm-sand)]">
                      {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[var(--soft-stone)]"><Camera size={18} /></div>}
                    </div>
                    <button onClick={() => avatarInputRef.current?.click()} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--warm-sand)]/50 text-[var(--warm-ink)] hover:bg-[var(--warm-sand)] transition-colors">
                      Upload
                    </button>
                    <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                    <span className="text-xs text-[var(--soft-stone)]">Square, max 2MB</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--warm-ink)]">Banner</label>
                  <div className="mt-1 flex items-center gap-3">
                    <div className="w-20 h-10 rounded-lg overflow-hidden border border-[rgba(191,179,163,0.2)]" style={{ background: profile.bannerUrl ? `url(${profile.bannerUrl}) center/cover` : profile.bannerColor }} />
                    <button onClick={() => bannerInputRef.current?.click()} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--warm-sand)]/50 text-[var(--warm-ink)] hover:bg-[var(--warm-sand)] transition-colors">
                      Upload
                    </button>
                    <input ref={bannerInputRef} type="file" accept="image/*" onChange={handleBannerUpload} className="hidden" />
                    <span className="text-xs text-[var(--soft-stone)]">Or pick a color below</span>
                  </div>
                </div>
              </div>
            </Section>

            {/* Trust */}
            <Section title="Trust & Privacy" icon={Eye}>
              <div className="pt-4 space-y-1">
                <Toggle label="Public profile" description="Anyone can view your profile" checked={profile.isPublic} onChange={v => update({ isPublic: v })} />
                <Toggle label="Show trust scores" description="Display reliability and trust scores" checked={profile.showScores} onChange={v => update({ showScores: v })} />
                <Toggle label="Show social links" description="Display connected social accounts" checked={profile.showSocialLinks} onChange={v => update({ showSocialLinks: v })} />
                <Toggle label="Show portfolio" description="Display portfolio items" checked={profile.showPortfolio} onChange={v => update({ showPortfolio: v })} />
              </div>
            </Section>

            {/* Social Links */}
            <Section title="Social Links" icon={Link2}>
              <div className="pt-4 space-y-2">
                {profile.socialLinks.map((link, i) => {
                  const platform = PLATFORMS.find(p => p.value === link.platform);
                  return (
                    <div key={link.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/40 border border-[rgba(191,179,163,0.1)]">
                      <GripVertical size={14} className="text-[var(--soft-stone)] cursor-grab" />
                      <span className="text-lg">{platform?.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--warm-ink)] truncate">{link.displayName || platform?.label}</p>
                        <p className="text-xs text-[var(--soft-stone)] truncate">{link.url}</p>
                      </div>
                      {link.verified && <Check size={14} className="text-[var(--sage)]" />}
                      {!link.verified && (
                        <button onClick={() => handleVerifySocialLink(link.id)} className="text-[10px] font-medium text-[var(--muted-ochre)] hover:text-[var(--clay)] transition-colors">
                          Re-check
                        </button>
                      )}
                      <button onClick={() => handleReorderSocialLinks(moveItem(profile.socialLinks, i, -1))} className="p-1 hover:bg-[var(--warm-sand)]/50 rounded" disabled={i === 0}><ChevronUp size={14} className="text-[var(--soft-stone)]" /></button>
                      <button onClick={() => handleReorderSocialLinks(moveItem(profile.socialLinks, i, 1))} className="p-1 hover:bg-[var(--warm-sand)]/50 rounded" disabled={i === profile.socialLinks.length - 1}><ChevronDown size={14} className="text-[var(--soft-stone)]" /></button>
                      <button onClick={() => handleDeleteSocialLink(link.id)} className="p-1 hover:bg-red-50 rounded"><Trash2 size={14} className="text-red-400" /></button>
                    </div>
                  );
                })}

                {showAddLink ? (
                  <div className="p-3 rounded-lg bg-[var(--warm-sand)]/30 border border-[rgba(191,179,163,0.15)] space-y-2">
                    <div className="flex gap-2">
                      <select value={newPlatform} onChange={e => setNewPlatform(e.target.value)} className="flex-1 px-3 py-2 rounded-lg border border-[rgba(191,179,163,0.3)] bg-white/50 text-sm">
                        <option value="">Platform...</option>
                        {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.icon} {p.label}</option>)}
                      </select>
                      <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://..." className="flex-[2] px-3 py-2 rounded-lg border border-[rgba(191,179,163,0.3)] bg-white/50 text-sm" />
                    </div>
                    <input value={newDisplayName} onChange={e => setNewDisplayName(e.target.value)} placeholder="Display name (optional)" className="w-full px-3 py-2 rounded-lg border border-[rgba(191,179,163,0.3)] bg-white/50 text-sm" />
                    <div className="flex gap-2">
                      <button onClick={handleAddSocialLink} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--clay)] text-white hover:bg-[var(--terracotta)]">Add</button>
                      <button onClick={() => setShowAddLink(false)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--soft-stone)] hover:bg-[var(--warm-sand)]/50">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowAddLink(true)} disabled={profile.socialLinks.length >= 10} className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed border-[rgba(191,179,163,0.2)] text-sm font-medium text-[var(--soft-stone)] hover:border-[var(--clay)]/40 hover:text-[var(--clay)] disabled:opacity-40 transition-colors">
                    <Plus size={16} /> Add social link {profile.socialLinks.length >= 10 && '(max 10)'}
                  </button>
                )}
              </div>
            </Section>

            {/* Portfolio */}
            <Section title="Portfolio" icon={Briefcase}>
              <div className="pt-4 space-y-2">
                {profile.portfolioItems.map((item, i) => (
                  <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/40 border border-[rgba(191,179,163,0.1)]">
                    <GripVertical size={14} className="text-[var(--soft-stone)] cursor-grab" />
                    {i < 3 && <Star size={14} className="text-[var(--muted-ochre)] fill-[var(--muted-ochre)]" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--warm-ink)] truncate">{item.title}</p>
                      {item.description && <p className="text-xs text-[var(--soft-stone)] truncate">{item.description}</p>}
                    </div>
                    <button onClick={() => handleReorderPortfolio(moveItem(profile.portfolioItems, i, -1))} className="p-1 hover:bg-[var(--warm-sand)]/50 rounded" disabled={i === 0}><ChevronUp size={14} className="text-[var(--soft-stone)]" /></button>
                    <button onClick={() => handleReorderPortfolio(moveItem(profile.portfolioItems, i, 1))} className="p-1 hover:bg-[var(--warm-sand)]/50 rounded" disabled={i === profile.portfolioItems.length - 1}><ChevronDown size={14} className="text-[var(--soft-stone)]" /></button>
                    <button onClick={() => handleDeletePortfolio(item.id)} className="p-1 hover:bg-red-50 rounded"><Trash2 size={14} className="text-red-400" /></button>
                  </div>
                ))}

                {showAddPortfolio ? (
                  <div className="p-3 rounded-lg bg-[var(--warm-sand)]/30 border border-[rgba(191,179,163,0.15)] space-y-2">
                    <input value={newPortfolio.title} onChange={e => setNewPortfolio({ ...newPortfolio, title: e.target.value })} placeholder="Project title" className="w-full px-3 py-2 rounded-lg border border-[rgba(191,179,163,0.3)] bg-white/50 text-sm" />
                    <input value={newPortfolio.description} onChange={e => setNewPortfolio({ ...newPortfolio, description: e.target.value })} placeholder="Description" className="w-full px-3 py-2 rounded-lg border border-[rgba(191,179,163,0.3)] bg-white/50 text-sm" />
                    <input value={newPortfolio.linkUrl} onChange={e => setNewPortfolio({ ...newPortfolio, linkUrl: e.target.value })} placeholder="Link URL" className="w-full px-3 py-2 rounded-lg border border-[rgba(191,179,163,0.3)] bg-white/50 text-sm" />
                    <div className="flex gap-2">
                      <button onClick={handleAddPortfolio} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--clay)] text-white hover:bg-[var(--terracotta)]">Add</button>
                      <button onClick={() => setShowAddPortfolio(false)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--soft-stone)] hover:bg-[var(--warm-sand)]/50">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowAddPortfolio(true)} disabled={profile.portfolioItems.length >= 12} className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed border-[rgba(191,179,163,0.2)] text-sm font-medium text-[var(--soft-stone)] hover:border-[var(--clay)]/40 hover:text-[var(--clay)] disabled:opacity-40 transition-colors">
                    <Plus size={16} /> Add portfolio item {profile.portfolioItems.length >= 12 && '(max 12)'}
                  </button>
                )}
              </div>
            </Section>

            {/* Appearance */}
            <Section title="Appearance" icon={Palette}>
              <div className="pt-4 space-y-5">
                <ColorPicker label="Banner Color" value={profile.bannerColor} presets={CLAY_PRESETS} onChange={v => update({ bannerColor: v })} />
                <ColorPicker label="Accent Color" value={profile.accentColor} presets={ACCENT_PRESETS} onChange={v => update({ accentColor: v })} />
                <div>
                  <p className="text-sm font-medium text-[var(--warm-ink)] mb-2">Layout Style</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['classic', 'compact', 'showcase'] as const).map(style => (
                      <button
                        key={style}
                        onClick={() => update({ layoutStyle: style })}
                        className={`p-3 rounded-xl border-2 text-sm font-medium capitalize transition-all ${profile.layoutStyle === style ? 'border-[var(--clay)] bg-[var(--clay)]/5 text-[var(--clay)]' : 'border-[rgba(191,179,163,0.2)] text-[var(--soft-stone)] hover:border-[var(--clay)]/30'}`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Section>
          </div>

          {/* Right: Live Preview */}
          <div className="hidden lg:block w-[400px] shrink-0">
            <div className="sticky top-24">
              <p className="text-xs uppercase tracking-wider text-[var(--soft-stone)] font-semibold mb-3 text-center">Live Preview — Mobile View</p>
              <LivePreview profile={profile} />
              {profile.username && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => navigate(`/u/${profile.username}`)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--warm-sand)]/50 text-[var(--warm-ink)] hover:bg-[var(--warm-sand)] transition-colors"
                  >
                    <ExternalLink size={14} /> View public profile
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile save bar */}
      <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-white/90 backdrop-blur-md border-t border-[rgba(191,179,163,0.2)] p-4 flex gap-3 z-40">
        <button onClick={handleReset} disabled={!dirty} className="flex-1 py-3 rounded-xl text-sm font-medium text-[var(--soft-stone)] border border-[rgba(191,179,163,0.2)] disabled:opacity-40">
          Reset
        </button>
        <button onClick={handleSave} disabled={saving || !dirty} className="flex-[2] py-3 rounded-xl text-sm font-semibold bg-[var(--clay)] text-white disabled:opacity-40">
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
