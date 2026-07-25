import { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { useMutation, useQueryClient } from 'react-query';
import { businessService } from '../services/api';
import { Button, Chip, Surface, Stack, Badge, tokens } from '../design-system';

function RiskBadge({ score }: { score: number }) {
  const level = score >= 75 ? 'CRITICAL' : score >= 50 ? 'HIGH' : score >= 30 ? 'MODERATE' : 'LOW';
  return (
    <Badge tone={level === 'LOW' ? 'success' : level === 'MODERATE' ? 'warning' : 'danger'}>
      {level} {score}
    </Badge>
  );
}

const integrations = [
  {
    title: 'Automated Marketing',
    body: 'Sync your 100% reliable patrons directly to Listmonk via API to send automated VIP discount emails and drive repeat business.',
    accent: '#3b82f6',
    cta: 'Request Early Access',
  },
  {
    title: 'n8n Workflows',
    body: 'Build open-source automations. If Pabandi flags a high-risk booking, trigger an n8n webhook to instantly alert your manager via Telegram.',
    accent: '#ec4899',
    cta: 'View Developer Docs',
  },
  {
    title: 'Omnichannel Chat',
    body: 'Message your patrons via SMS, Web, and WhatsApp directly from this CRM via our upcoming Chatwoot integration.',
    accent: '#10b981',
    cta: 'Join Waitlist',
  },
];

export default function BusinessCrmPage() {
  const [businessId, setBusinessId] = useState<string | null>(null);

  const { data: bizData, isLoading: isBizLoading, isFetching } = useQuery('my-business', async () => {
    const res = await businessService.getMyBusiness().catch(() => null);
    return res?.data?.data?.business || null;
  });

  const qc = useQueryClient();
  const generateLinkMutation = useMutation(
    () => businessService.generateBookingLink(businessId!),
    { onSuccess: () => qc.invalidateQueries('my-business') }
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
      <div className="min-h-screen flex items-center justify-center p-8" style={{ background: tokens.color.background }}>
        <p className="text-slate-300 font-medium">Loading CRM data...</p>
      </div>
    );
  }

  if (!businessId && !isFetching) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8" style={{ background: tokens.color.background }}>
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-300">💬</div>
          <h2 className="mb-3 text-2xl font-bold text-slate-100">No Business Registered</h2>
          <p className="mb-6 text-sm text-slate-300 leading-relaxed">You need to register your business before you can access the CRM.</p>
          <a href="/business/register" className="block w-full rounded-xl bg-indigo-500 py-3 text-center font-semibold text-white">Register Your Business</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 text-slate-100 md:pb-12" style={{ background: tokens.color.background, fontFamily: tokens.font.body }}>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {businessId && (
          <Surface className="mb-10">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-100">
                  🔗 Your Custom Booking Link
                </h2>
                <p className="text-sm text-slate-300">Share this link on Instagram, Facebook, or your website to let patrons book directly.</p>
              </div>
              <div className="flex items-center gap-3">
                {bizData?.slug ? (
                  <div className="flex items-center rounded-xl border border-white/10 bg-white/5">
                    <div className="px-4 py-2.5 font-mono text-sm text-slate-100">{window.location.origin}/b/{bizData.slug}</div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/b/${bizData.slug}`);
                        alert('Copied to clipboard!');
                      }}
                      className="border-l border-white/10 px-4 py-2.5 text-indigo-200 transition-colors hover:bg-indigo-500/10"
                    >
                      Copy
                    </button>
                  </div>
                ) : (
                  <Button onClick={() => generateLinkMutation.mutate()} disabled={generateLinkMutation.isLoading}>
                    {generateLinkMutation.isLoading ? 'Generating...' : 'Generate Short Link'}
                  </Button>
                )}
              </div>
            </div>
          </Surface>
        )}

        <div className="mb-10 flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-slate-100">Patron CRM</h1>
              <Chip tone="success">Base CRM Active</Chip>
            </div>
            <p className="max-w-2xl text-sm text-slate-300">Manage customer relationships based on verifiable trust. Reward reliable patrons and protect your business from serial no-shows.</p>
          </div>
          <Stack className="flex-row">
            <Button variant="outline">Sync Records</Button>
            <Button>Export CSV</Button>
          </Stack>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Surface>
              <div className="flex items-center justify-between border-b border-white/10 p-5">
                <h2 className="text-lg font-bold text-slate-100">Patron Directory</h2>
                <input type="text" placeholder="Search patrons..." className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-100 outline-none focus:border-indigo-400" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="px-5 py-4 font-label text-[10px] font-bold uppercase tracking-widest text-slate-300">Patron</th>
                      <th className="px-5 py-4 font-label text-[10px] font-bold uppercase tracking-widest text-slate-300">Pabandi Score</th>
                      <th className="px-5 py-4 font-label text-[10px] font-bold uppercase tracking-widest text-slate-300">Stats</th>
                      <th className="px-5 py-4 text-right font-label text-[10px] font-bold uppercase tracking-widest text-slate-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isCustLoading && (
                      <tr><td colSpan={4} className="p-8 text-center text-sm text-slate-300">Loading patrons...</td></tr>
                    )}
                    {!isCustLoading && customers.length === 0 && (
                      <tr><td colSpan={4} className="p-12 text-center text-sm text-slate-300">No patrons found yet. Bookings will populate this CRM automatically.</td></tr>
                    )}
                    {customers.map((c: any, i: number) => {
                      const u = c.user;
                      const name = u ? `${u.firstName} ${u.lastName}` : c.customerName;
                      const score = u ? u.reliabilityScore : 0;
                      const initial = name ? name[0].toUpperCase() : '?';
                      return (
                        <tr key={i} className="border-b border-white/10 transition-colors hover:bg-white/5">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-300">{initial}</div>
                              <div>
                                <p className="text-sm font-semibold text-slate-100">{name}</p>
                                <p className="text-xs text-slate-400">{u?.email || c.customerEmail || 'No email'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4"><RiskBadge score={Number(score)} /></td>
                          <td className="px-5 py-4">
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-semibold text-slate-100">{c.totalBookings} Bookings</span>
                              {c.noShowCount > 0 ? (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-red-400">⚠️ {c.noShowCount} No-Shows</span>
                              ) : (
                                <span className="text-[10px] text-slate-400">0 No-Shows</span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button className="rounded-lg px-3 py-1.5 text-xs font-semibold text-indigo-200 transition-colors hover:bg-indigo-500/10">View Profile</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Surface>
          </div>

          <div className="space-y-6">
            {integrations.map((item) => (
              <Surface key={item.title} className="relative overflow-hidden">
                <div className="absolute top-0 right-0 opacity-10">{item.title === 'Automated Marketing' ? '📧' : item.title === 'n8n Workflows' ? '⚡' : '💬'}</div>
                <Chip tone="info" className="mb-3">
                  Coming Soon
                </Chip>
                <h3 className="mb-2 text-lg font-bold text-slate-100">{item.title}</h3>
                <p className="mb-5 text-sm text-slate-300 leading-relaxed">{item.body}</p>
                <Button variant="outline" className="w-full py-2.5 text-xs font-bold">
                  {item.cta}
                </Button>
              </Surface>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
