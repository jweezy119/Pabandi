import { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { LinkIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import { useMutation, useQueryClient } from 'react-query';
import { businessService } from '../services/api';

import { 
  EnvelopeIcon, 
  ChatBubbleLeftRightIcon, 
  CpuChipIcon, 
  ArrowPathIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

const RISK_COLORS: Record<string, { bg: string; text: string; }> = {
  LOW:      { bg: 'var(--color-primary-container)',   text: 'var(--color-on-primary-container)' },
  MODERATE: { bg: 'var(--color-secondary-container)',  text: 'var(--color-on-secondary-container)' },
  HIGH:     { bg: 'var(--color-tertiary-container)', text: 'var(--color-on-tertiary-container)' },
  CRITICAL: { bg: 'var(--color-error-container)',  text: 'var(--color-on-error-container)' },
};

function RiskBadge({ score }: { score: number }) {
  const level = score >= 75 ? 'CRITICAL' : score >= 50 ? 'HIGH' : score >= 30 ? 'MODERATE' : 'LOW';
  const c = RISK_COLORS[level];
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 9999,
      background: c.bg, color: c.text, border: `1px solid ${c.text}30`,
      textTransform: 'uppercase', letterSpacing: '0.08em',
    }}>
      {level} {score}
    </span>
  );
}

export default function BusinessCrmPage() {
  const [businessId, setBusinessId] = useState<string | null>(null);

  const { data: bizData, isLoading: isBizLoading, isFetching } = useQuery('my-business', async () => {
    const res = await businessService.getMyBusiness().catch(() => null);
    return res?.data?.data?.business || null;
  });

    const qc = useQueryClient();
  const generateLinkMutation = useMutation(
    () => businessService.generateBookingLink(businessId!),
    {
      onSuccess: () => {
        qc.invalidateQueries('my-business');
      }
    }
  );

  useEffect(() => {
    if (bizData?.id) setBusinessId(bizData.id);
  }, [bizData]);

  const { data: custData, isLoading: isCustLoading } = useQuery(
    ['business-customers', businessId],
    () => (businessId ? businessService.getBusinessCustomers(businessId) : null),
    { enabled: !!businessId }
  );

  const customers = custData?.data?.data?.customers || [];

  if (isBizLoading || (!businessId && isFetching)) {
    return (
      <div className="bg-surface min-h-screen flex items-center justify-center p-8">
        <p className="text-on-surface-variant animate-pulse font-medium">Loading CRM data...</p>
      </div>
    );
  }

  if (!businessId && !isFetching) {
    return (
      <div className="bg-surface min-h-screen flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-6 bg-primary/10 text-primary flex items-center justify-center">
            <ChatBubbleLeftRightIcon className="h-8 w-8" />
          </div>
          <h2 className="font-headline text-2xl font-bold mb-3 text-on-surface">No Business Registered</h2>
          <p className="font-body text-sm text-on-surface-variant leading-relaxed mb-6">
            You need to register your business before you can access the CRM.
          </p>
          <a href="/business/register" className="btn-primary block w-full py-3 text-center rounded-xl font-semibold">Register Your Business</a>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface min-h-screen text-on-surface pb-24 md:pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
                {/* Booking Link Section */}
        {businessId && (
          <div className="mb-10 bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="font-headline text-lg font-bold text-on-surface mb-1 flex items-center gap-2">
                <LinkIcon className="h-5 w-5 text-primary" /> Your Custom Booking Link
              </h2>
              <p className="font-body text-sm text-on-surface-variant">
                Share this link on your Instagram, Facebook, or website to let patrons book directly.
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {bizData?.slug ? (
                <div className="flex items-center bg-surface-container-lowest border border-outline-variant/30 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 font-mono text-sm text-on-surface select-all">
                    {window.location.origin}/b/{bizData.slug}
                  </div>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/b/${bizData.slug}`);
                      alert('Copied to clipboard!');
                    }}
                    className="px-4 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary transition-colors flex items-center justify-center border-l border-outline-variant/30"
                  >
                    <ClipboardDocumentIcon className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => {
                    generateLinkMutation.mutate();
                  }}
                  disabled={generateLinkMutation.isLoading}
                  className="btn-primary py-2.5 px-6 rounded-xl font-bold flex items-center gap-2"
                >
                  {generateLinkMutation.isLoading ? 'Generating...' : 'Generate Short Link'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-outline-variant/20 pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="font-headline text-3xl font-bold tracking-tight text-on-surface">
                Patron CRM
              </h1>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1DBF73]/10 border border-[#1DBF73]/20">
                <ShieldCheckIcon className="h-4 w-4 text-[#1DBF73]" />
                <span className="font-label text-[10px] font-bold text-[#1DBF73] tracking-widest uppercase">Base CRM Active</span>
              </div>
            </div>
            <p className="font-body text-sm text-on-surface-variant max-w-2xl">
              Manage your customer relationships based on verifiable trust. Identify your most reliable patrons and reward them, or protect your business from serial no-shows.
            </p>
          </div>
          
          <div className="flex gap-3">
            <button className="btn-secondary flex items-center gap-2 py-2 px-4 text-sm font-semibold rounded-xl">
              <ArrowPathIcon className="h-4 w-4" /> Sync Records
            </button>
            <button className="btn-primary flex items-center gap-2 py-2 px-4 text-sm font-semibold rounded-xl">
              Export CSV
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Main CRM Table (Takes up 2/3 width) */}
          <div className="lg:col-span-2">
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-5 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-low/50">
                <h2 className="font-headline text-lg font-bold">Patron Directory</h2>
                <div className="relative">
                  <input type="text" placeholder="Search patrons..." className="input-field text-sm py-1.5 pl-3 pr-8 rounded-lg w-48" />
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-lowest border-b border-outline-variant/20">
                      <th className="py-4 px-5 font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Patron</th>
                      <th className="py-4 px-5 font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Pabandi Score</th>
                      <th className="py-4 px-5 font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Stats</th>
                      <th className="py-4 px-5 font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isCustLoading && (
                      <tr><td colSpan={4} className="p-8 text-center text-on-surface-variant text-sm">Loading patrons...</td></tr>
                    )}
                    {!isCustLoading && customers.length === 0 && (
                      <tr><td colSpan={4} className="p-12 text-center text-on-surface-variant text-sm">No patrons found yet. Bookings will populate this CRM automatically.</td></tr>
                    )}
                    {customers.map((c: any, i: number) => {
                      const u = c.user;
                      const name = u ? `${u.firstName} ${u.lastName}` : c.customerName;
                      const score = u ? u.reliabilityScore : (Math.random() * 40 + 60).toFixed(0); // fallback mock if no user account
                      const initial = name ? name[0].toUpperCase() : '?';
                      
                      return (
                        <tr key={i} className="border-b border-outline-variant/10 hover:bg-surface-container-lowest/80 transition-colors">
                          <td className="py-4 px-5">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm border border-primary/20 shrink-0">
                                {initial}
                              </div>
                              <div>
                                <p className="font-semibold text-sm text-on-surface">{name}</p>
                                <p className="text-xs text-on-surface-variant">{u?.email || c.customerEmail || 'No email'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-5">
                            <RiskBadge score={Number(score)} />
                          </td>
                          <td className="py-4 px-5">
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-semibold text-on-surface">{c.totalBookings} Bookings</span>
                              {c.noShowCount > 0 ? (
                                <span className="text-[10px] font-bold text-error flex items-center gap-1"><ExclamationTriangleIcon className="h-3 w-3"/> {c.noShowCount} No-Shows</span>
                              ) : (
                                <span className="text-[10px] text-on-surface-variant">0 No-Shows</span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-5 text-right">
                            <button className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors px-3 py-1.5 bg-primary/10 rounded-lg">
                              View Profile
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Sidebar Integrations (Takes up 1/3 width) */}
          <div className="space-y-6">
            
            <div className="bg-[linear-gradient(135deg,rgba(14,165,233,0.1),rgba(99,102,241,0.05))] border border-blue-500/20 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><EnvelopeIcon className="h-24 w-24 text-blue-500" /></div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 font-label text-[9px] uppercase tracking-widest font-bold mb-4">
                Coming Soon
              </div>
              <h3 className="font-headline text-lg font-bold text-on-surface mb-2">Automated Marketing</h3>
              <p className="font-body text-sm text-on-surface-variant leading-relaxed mb-5 relative z-10">
                Sync your 100% reliable patrons directly to <strong>Listmonk</strong> via API to send automated "VIP Discount" emails and drive repeat business.
              </p>
              <button className="w-full py-2.5 bg-surface text-on-surface text-sm font-semibold rounded-xl border border-outline-variant/30 hover:border-blue-500/50 transition-colors shadow-sm relative z-10">
                Request Early Access
              </button>
            </div>

            <div className="bg-[linear-gradient(135deg,rgba(244,63,94,0.1),rgba(236,72,153,0.05))] border border-pink-500/20 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><CpuChipIcon className="h-24 w-24 text-pink-500" /></div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-pink-500/20 text-pink-400 font-label text-[9px] uppercase tracking-widest font-bold mb-4">
                Coming Soon
              </div>
              <h3 className="font-headline text-lg font-bold text-on-surface mb-2">n8n Workflows</h3>
              <p className="font-body text-sm text-on-surface-variant leading-relaxed mb-5 relative z-10">
                Build open-source automations. E.g., If Pabandi flags a high-risk booking, trigger an n8n webhook to instantly alert your manager via Telegram.
              </p>
              <button className="w-full py-2.5 bg-surface text-on-surface text-sm font-semibold rounded-xl border border-outline-variant/30 hover:border-pink-500/50 transition-colors shadow-sm relative z-10">
                View Developer Docs
              </button>
            </div>

            <div className="bg-[linear-gradient(135deg,rgba(16,185,129,0.1),rgba(5,150,105,0.05))] border border-emerald-500/20 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><ChatBubbleLeftRightIcon className="h-24 w-24 text-emerald-500" /></div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-label text-[9px] uppercase tracking-widest font-bold mb-4">
                Coming Soon
              </div>
              <h3 className="font-headline text-lg font-bold text-on-surface mb-2">Omnichannel Chat</h3>
              <p className="font-body text-sm text-on-surface-variant leading-relaxed mb-5 relative z-10">
                Message your patrons (SMS, Web, WhatsApp) directly from this CRM via our upcoming <strong>Chatwoot</strong> integration.
              </p>
              <button className="w-full py-2.5 bg-surface text-on-surface text-sm font-semibold rounded-xl border border-outline-variant/30 hover:border-emerald-500/50 transition-colors shadow-sm relative z-10">
                Join Waitlist
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
