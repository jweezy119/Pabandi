import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal,
  ShoppingBag,
  Building2,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useAuthStore, type ProfileType } from '../store/authStore';
import { authService } from '../services/api';
import '../styles/pbn-tokens.css';

const INDUSTRY_OPTIONS = [
  { value: 'commercial', label: 'Commercial & Trade (Roofing, HVAC, Plumbing)' },
  { value: 'health_beauty', label: 'Health & Beauty (Salons, Spas, Wellness)' },
  { value: 'home_repair', label: 'Home Repair (Electricians, Handymen, Painting)' },
  { value: 'professional', label: 'Professional Services (Consulting, Legal, Design)' },
  { value: 'tech_agents', label: 'Technology & AI Agent Operations' },
  { value: 'general', label: 'General / Other Service Business' },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, setUser } = useAuthStore();

  const [selectedProfile, setSelectedProfile] = useState<ProfileType | null>(null);
  const [username, setUsername] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('commercial');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  // Protect route
  React.useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
    } else if (user?.profileType) {
      // User already completed onboarding
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, user?.profileType, navigate]);

  const handleSelectCard = (type: ProfileType) => {
    setSelectedProfile(type);
    setErrorMessage('');
    if (type === 'SOLO_BUILDER') {
      setStatusMessage('Selected Solo Builder / Freelancer. Enter your public handle.');
    } else if (type === 'CLIENT') {
      setStatusMessage('Selected Client / Buyer. Ready to proceed.');
    } else if (type === 'SERVICE_BUSINESS') {
      setStatusMessage('Selected Service Business. Enter your business details.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfile) return;

    if (selectedProfile === 'SOLO_BUILDER' && !username.trim()) {
      setErrorMessage('Please choose a public handle (@username).');
      return;
    }

    if (selectedProfile === 'SERVICE_BUSINESS' && !businessName.trim()) {
      setErrorMessage('Please enter your business name.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');
      setStatusMessage('Finalizing your profile and trust standing...');

      const cleanHandle = username.trim().replace(/^@+/, '').toLowerCase();

      const response = await authService.completeOnboarding({
        profileType: selectedProfile,
        username: cleanHandle || undefined,
        businessName: businessName.trim() || undefined,
        industry: industry || undefined,
      });

      const updatedUser = response.data?.data?.user;
      if (updatedUser) {
        setUser(updatedUser);
      }

      setStatusMessage('Onboarding complete! Redirecting to your dashboard...');
      
      // Route appropriately
      if (selectedProfile === 'SERVICE_BUSINESS') {
        navigate('/contact', { replace: true });
      } else if (selectedProfile === 'SOLO_BUILDER') {
        navigate('/gigs', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.message || 'Failed to complete onboarding. Please try again.';
      setErrorMessage(msg);
      setStatusMessage('');
    } finally {
      setLoading(false);
    }
  };

  const calculatedTrustScore = user?.trustScore && user.trustScore >= 700 ? user.trustScore : 700;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a1118] px-4 py-12 text-[#e8eef4] selection:bg-[var(--pbn-accent)]/30">
      {/* Polite live accessibility announcement */}
      <div className="sr-only" aria-live="polite">
        {statusMessage || errorMessage}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-2xl"
      >
        {/* Trust Standing Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--pbn-accent)]/30 bg-[var(--pbn-accent)]/10 px-3 py-1 text-xs font-mono text-[var(--pbn-accent)] mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Cold-Start Trust Score: {calculatedTrustScore} / 1000</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#e8eef4] sm:text-4xl">
            How do you want to use Pabandi?
          </h1>
          <p className="mt-2 text-sm text-[#8a9aa8]">
            Choose your primary profile to configure your workspace. You can change this at any time.
          </p>
        </div>

        {/* Error / Status Notices */}
        <AnimatePresence mode="wait">
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </motion.div>
          )}
          {statusMessage && !errorMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 flex items-center gap-2.5 rounded-xl border border-[var(--pbn-accent)]/30 bg-[var(--pbn-accent)]/10 p-4 text-xs text-[var(--pbn-accent)]"
            >
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>{statusMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Three Selectable Option Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Card 1: Solo Builder / Freelancer */}
          <button
            type="button"
            onClick={() => handleSelectCard('SOLO_BUILDER')}
            className={`group relative flex flex-col justify-between rounded-2xl border p-5 text-left transition-all focus:outline-none focus:ring-2 focus:ring-[var(--pbn-accent)]/50 ${
              selectedProfile === 'SOLO_BUILDER'
                ? 'border-[var(--pbn-accent)] bg-[#101a24] shadow-lg shadow-[var(--pbn-accent)]/10'
                : 'border-[var(--pbn-border)] bg-[#101a24]/60 hover:border-[var(--pbn-border-strong)] hover:bg-[#101a24]'
            }`}
          >
            <div>
              <div
                className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl border transition-colors ${
                  selectedProfile === 'SOLO_BUILDER'
                    ? 'border-[var(--pbn-accent)]/40 bg-[var(--pbn-accent)]/20 text-[var(--pbn-accent)]'
                    : 'border-[var(--pbn-border)] bg-[var(--pbn-surface)] text-[#8a9aa8] group-hover:text-[#e8eef4]'
                }`}
              >
                <Terminal className="h-6 w-6" />
              </div>
              <h2 className="text-base font-semibold text-[#e8eef4]">
                Solo Builder / Freelancer
              </h2>
              <p className="mt-1.5 text-xs text-[#8a9aa8] leading-relaxed">
                Find work, test AI agents, or offer freelance services.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between pt-3 border-t border-[var(--pbn-border)]/50">
              <span className="text-[11px] font-mono text-[var(--pbn-accent)]">Score: 700</span>
              {selectedProfile === 'SOLO_BUILDER' && (
                <CheckCircle2 className="h-4 w-4 text-[var(--pbn-accent)]" />
              )}
            </div>
          </button>

          {/* Card 2: Client / Buyer */}
          <button
            type="button"
            onClick={() => handleSelectCard('CLIENT')}
            className={`group relative flex flex-col justify-between rounded-2xl border p-5 text-left transition-all focus:outline-none focus:ring-2 focus:ring-[var(--pbn-accent)]/50 ${
              selectedProfile === 'CLIENT'
                ? 'border-[var(--pbn-accent)] bg-[#101a24] shadow-lg shadow-[var(--pbn-accent)]/10'
                : 'border-[var(--pbn-border)] bg-[#101a24]/60 hover:border-[var(--pbn-border-strong)] hover:bg-[#101a24]'
            }`}
          >
            <div>
              <div
                className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl border transition-colors ${
                  selectedProfile === 'CLIENT'
                    ? 'border-[var(--pbn-accent)]/40 bg-[var(--pbn-accent)]/20 text-[var(--pbn-accent)]'
                    : 'border-[var(--pbn-border)] bg-[var(--pbn-surface)] text-[#8a9aa8] group-hover:text-[#e8eef4]'
                }`}
              >
                <ShoppingBag className="h-6 w-6" />
              </div>
              <h2 className="text-base font-semibold text-[#e8eef4]">
                Client / Buyer
              </h2>
              <p className="mt-1.5 text-xs text-[#8a9aa8] leading-relaxed">
                Hire verified professionals or AI agents, backed by secure escrow.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between pt-3 border-t border-[var(--pbn-border)]/50">
              <span className="text-[11px] font-mono text-[var(--pbn-accent)]">Instant Setup</span>
              {selectedProfile === 'CLIENT' && (
                <CheckCircle2 className="h-4 w-4 text-[var(--pbn-accent)]" />
              )}
            </div>
          </button>

          {/* Card 3: Service Business */}
          <button
            type="button"
            onClick={() => handleSelectCard('SERVICE_BUSINESS')}
            className={`group relative flex flex-col justify-between rounded-2xl border p-5 text-left transition-all focus:outline-none focus:ring-2 focus:ring-[var(--pbn-accent)]/50 ${
              selectedProfile === 'SERVICE_BUSINESS'
                ? 'border-[var(--pbn-accent)] bg-[#101a24] shadow-lg shadow-[var(--pbn-accent)]/10'
                : 'border-[var(--pbn-border)] bg-[#101a24]/60 hover:border-[var(--pbn-border-strong)] hover:bg-[#101a24]'
            }`}
          >
            <div>
              <div
                className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl border transition-colors ${
                  selectedProfile === 'SERVICE_BUSINESS'
                    ? 'border-[var(--pbn-accent)]/40 bg-[var(--pbn-accent)]/20 text-[var(--pbn-accent)]'
                    : 'border-[var(--pbn-border)] bg-[var(--pbn-surface)] text-[#8a9aa8] group-hover:text-[#e8eef4]'
                }`}
              >
                <Building2 className="h-6 w-6" />
              </div>
              <h2 className="text-base font-semibold text-[#e8eef4]">
                Service Business
              </h2>
              <p className="mt-1.5 text-xs text-[#8a9aa8] leading-relaxed">
                Manage your team, dispatch jobs, and accept bookings.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between pt-3 border-t border-[var(--pbn-border)]/50">
              <span className="text-[11px] font-mono text-[var(--pbn-accent)]">ContactOS Suite</span>
              {selectedProfile === 'SERVICE_BUSINESS' && (
                <CheckCircle2 className="h-4 w-4 text-[var(--pbn-accent)]" />
              )}
            </div>
          </button>
        </div>

        {/* Dynamic Action Forms based on Selection */}
        <AnimatePresence mode="wait">
          {selectedProfile && (
            <motion.form
              key={selectedProfile}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              onSubmit={handleSubmit}
              className="mt-6 rounded-2xl border border-[var(--pbn-border)] bg-[#101a24] p-6 shadow-xl"
            >
              {/* Form 1: Solo Builder */}
              {selectedProfile === 'SOLO_BUILDER' && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="handle-input" className="block text-xs font-semibold uppercase tracking-wider text-[#8a9aa8] mb-2">
                      Choose your public handle (@username)
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-4 text-base font-mono text-[var(--pbn-accent)]">@</span>
                      <input
                        id="handle-input"
                        type="text"
                        required
                        autoFocus
                        value={username}
                        onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                        placeholder="agent_smith"
                        className="w-full min-h-[48px] rounded-xl border border-[var(--pbn-border)] bg-[#0a1118] pl-8 pr-4 text-sm font-mono text-[#e8eef4] placeholder-[#5a6a78] focus:border-[var(--pbn-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--pbn-accent)]/30"
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-[#8a9aa8]">
                      Your public profile will be available at <span className="font-mono text-[#e8eef4]">pabandi.com/@{username || 'yourhandle'}</span>
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !username.trim()}
                    className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--pbn-accent)] px-4 py-3 text-sm font-semibold text-[#0a1118] transition-all hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--pbn-accent)] active:scale-[0.99] disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <span>Finish Onboarding</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Form 2: Client */}
              {selectedProfile === 'CLIENT' && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-[var(--pbn-border)] bg-[#0a1118] p-4 text-xs text-[#8a9aa8] leading-relaxed">
                    <p className="text-[#e8eef4] font-medium mb-1">Zero configuration required</p>
                    Your client profile is ready immediately. You can post gigs, fund milestones in escrow, and hire verified service professionals.
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--pbn-accent)] px-4 py-3 text-sm font-semibold text-[#0a1118] transition-all hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--pbn-accent)] active:scale-[0.99] disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <span>Continue as Client</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Form 3: Service Business */}
              {selectedProfile === 'SERVICE_BUSINESS' && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="biz-name" className="block text-xs font-semibold uppercase tracking-wider text-[#8a9aa8] mb-2">
                      Business Name
                    </label>
                    <input
                      id="biz-name"
                      type="text"
                      required
                      autoFocus
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g. Acme Roofing & Solar"
                      className="w-full min-h-[48px] rounded-xl border border-[var(--pbn-border)] bg-[#0a1118] px-4 py-3 text-sm text-[#e8eef4] placeholder-[#5a6a78] focus:border-[var(--pbn-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--pbn-accent)]/30"
                    />
                  </div>

                  <div>
                    <label htmlFor="industry-select" className="block text-xs font-semibold uppercase tracking-wider text-[#8a9aa8] mb-2">
                      Industry
                    </label>
                    <select
                      id="industry-select"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      className="w-full min-h-[48px] rounded-xl border border-[var(--pbn-border)] bg-[#0a1118] px-4 py-3 text-sm text-[#e8eef4] focus:border-[var(--pbn-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--pbn-accent)]/30"
                    >
                      {INDUSTRY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-[#0a1118] text-[#e8eef4]">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !businessName.trim()}
                    className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--pbn-accent)] px-4 py-3 text-sm font-semibold text-[#0a1118] transition-all hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--pbn-accent)] active:scale-[0.99] disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <span>Finish Onboarding</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
