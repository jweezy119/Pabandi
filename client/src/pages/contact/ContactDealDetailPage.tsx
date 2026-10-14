import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { Button, Chip, EmptyState } from '../../components/primitives';
import ClientTimeline from '../crm/components/ClientTimeline';
import { TrustPanel } from '../../components/TrustPanel';
import { InlineEdit } from '../../components/primitives/InlineEdit';
import { getAuthToken } from '../../utils/authToken';
import { DEAL_STAGES, DEAL_STAGE_LABELS, options } from '@shared/crm';
import { readList } from '../../utils/crmResponse';

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-[var(--soft-stone)] shrink-0">{label}</span>
      <span className="text-right min-w-0">{children}</span>
    </div>
  );
}

export default function ContactDealDetailPage() {
  const { id } = useParams();
  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Related entities
  const [activities, setActivities] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);

  useEffect(() => {
    if (id) fetchDealData();
  }, [id]);

  async function fetchDealData() {
    setLoading(true);
    const token = getAuthToken();
    const headers = { Authorization: `Bearer ${token}` };
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    try {
      const dealRes = await fetch(`${baseUrl}/api/v1/crm/deals/${id}`, { headers });
      if (dealRes.ok) {
        const dData = await dealRes.json();
        setDeal(dData.data);
        
        // Fetch related entities. Activities related to deal:
        if (dData.data.clientId) {
          const [actRes, invRes, jobsRes] = await Promise.all([
            fetch(`${baseUrl}/api/v1/crm/activities?clientId=${dData.data.clientId}`, { headers }),
            fetch(`${baseUrl}/api/v1/crm/invoices?clientId=${dData.data.clientId}`, { headers }),
            fetch(`${baseUrl}/api/v1/crm/jobs?clientId=${dData.data.clientId}`, { headers }),
          ]);
          // readList: /crm/activities answers with a bare array, so `.data` was
          // always undefined and this timeline never rendered anything.
          setActivities((await readList(actRes)).items);
          if (invRes.ok) setInvoices((await invRes.json()).data || []);
          if (jobsRes.ok) setJobs((await jobsRes.json()).data || []);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" ><div className="p-8 text-center text-[var(--soft-stone)]">Loading...</div></DashboardLayout>;
  if (!deal) return <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" ><EmptyState icon="handshake" title="Deal Not Found" description="This deal does not exist." actionLabel="Go Back" onAction={() => window.location.href = '/contact/deals'} /></DashboardLayout>;

  const handleDealUpdate = async (field: string, value: any) => {
    const token = getAuthToken();
    const baseUrl = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
    const res = await fetch(`${baseUrl}/api/v1/crm/deals/${id}`, {
      // PATCH, not PUT. The server has always exposed PATCH /crm/deals/:id; the
      // PUT here matched nothing, so every inline edit on a deal 404'd and the
      // field reverted. Changing the verb rather than adding a PUT alias, because
      // two URLs for one operation is how the two drift apart again.
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ [field]: value }),
    });
    if (!res.ok) throw new Error('Failed to update');
    setDeal((prev: any) => ({ ...prev, [field]: value }));
    // The server derives `probability` from a stage change, so an edit to probability
    // alone would be overwritten locally by a later stage edit without a refetch. The
    // response carries the whole row; using it keeps the page truthful.
    if (field === 'stage') fetchDealData();
  };

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" >
      <div className="space-y-6">
        <Link to="/contact/deals" className="inline-flex items-center gap-2 text-sm text-[var(--clay)] font-medium hover:underline clay-fade">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Deals
        </Link>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 clay-heading">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold" style={{ color: 'var(--warm-ink)' }}>
                <InlineEdit value={deal.title} onSave={(v) => handleDealUpdate('title', v)} />
              </h1>
              <div className="relative">
                <InlineEdit 
                  value={deal.stage} 
                  type="select" 
                  options={options(DEAL_STAGES, DEAL_STAGE_LABELS)}
                  onSave={(v) => handleDealUpdate('stage', v)} 
                />
              </div>
            </div>
            {deal.client && (
              <p className="text-[var(--soft-stone)] text-sm flex items-center gap-1 mt-1">
                <span className="material-symbols-outlined text-[14px]">person</span>
                Client: <Link to={`/contact/clients/${deal.client.id}`} className="hover:underline">{deal.client.name}</Link>
                {deal.client.reliabilityScore < 60 && <span className="text-[var(--dusty-rose)] ml-1 font-bold">(Risk)</span>}
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-[var(--clay)] flex items-center justify-end gap-1">
              $
              <InlineEdit type="number" value={deal.value || 0} onSave={(v) => handleDealUpdate('value', Number(v))} />
            </div>
            <div className="text-sm text-[var(--soft-stone)]">Probability: {deal.probability}%</div>
          </div>
        </div>

        {/*
          The fields the server can already update and this page did not offer.

          `updateDeal` accepts title, value, stage, probability, expectedCloseDate,
          notes, lostReason and ownerName. The page exposed three of them — title,
          stage and value — so a quoted deal could not have its close date corrected,
          its owner set, or its probability overridden, and notes were only ever
          visible as an "Internal Note" pinned to the top of the timeline at epoch
          zero. Everything here is an existing endpoint call; none of it needed new
          server work.
        */}
        <div className="bg-white rounded-2xl shadow-sm border border-[rgba(191,179,163,0.3)] p-6">
          <h3 className="font-bold text-[var(--warm-ink)] mb-4">Deal details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Detail label="Expected close">
              <InlineEdit
                type="date"
                value={deal.expectedCloseDate ? String(deal.expectedCloseDate).slice(0, 10) : ''}
                placeholder="No date set"
                onSave={(v) => handleDealUpdate('expectedCloseDate', v || null)}
              />
            </Detail>

            <Detail label="Probability">
              {/* Shown read-only before this: the server recomputes it from the stage
                  unless the caller states one, so an editable field that silently
                  reverts on the next stage change needs to say which it is. */}
              <InlineEdit
                type="number"
                value={deal.probability ?? 0}
                validate={(v) =>
                  Number(v) < 0 || Number(v) > 100 ? 'Must be between 0 and 100' : null
                }
                onSave={(v) => handleDealUpdate('probability', Number(v))}
              />
              <span className="text-[var(--soft-stone)]">%</span>
            </Detail>

            <Detail label="Owner">
              <InlineEdit
                value={deal.ownerName || ''}
                placeholder="Unassigned"
                onSave={(v) => handleDealUpdate('ownerName', v)}
              />
            </Detail>

            {deal.stage === 'LOST' && (
              <Detail label="Why it was lost">
                <InlineEdit
                  value={deal.lostReason || ''}
                  placeholder="No reason recorded"
                  onSave={(v) => handleDealUpdate('lostReason', v)}
                />
              </Detail>
            )}
          </div>

          <div className="mt-5">
            <p className="text-xs text-[var(--soft-stone)] mb-1.5">Notes</p>
            <InlineEdit
              type="textarea"
              value={deal.notes || ''}
              placeholder="Add a note about this deal"
              onSave={(v) => handleDealUpdate('notes', v)}
              inputClassName="w-full min-h-[80px]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <ClientTimeline activities={activities} deals={[deal]} invoices={invoices} jobs={jobs} notes={deal.notes} files={[]} />
          </div>
          <div className="space-y-6">
            {/* Sidebar content */}
            {deal.client && (
              <TrustPanel passportId={deal.client.passportId} />
            )}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-[rgba(191,179,163,0.3)]">
              <h3 className="font-bold text-[var(--warm-ink)] mb-4">Trust OS Terms Recommendation</h3>
              {deal.client ? (
                deal.client.reliabilityScore >= 80 ? (
                  <div className="bg-[var(--sage)]/10 text-[var(--sage)] p-3 rounded-xl text-sm border border-[var(--sage)]/20">
                    <strong>Standard Terms:</strong> Client has high payment reliability ({deal.client.reliabilityScore}/100). Standard invoicing is recommended.
                  </div>
                ) : deal.client.reliabilityScore >= 60 ? (
                  <div className="bg-[var(--muted-ochre)]/10 text-[var(--muted-ochre)] p-3 rounded-xl text-sm border border-[var(--muted-ochre)]/20">
                    <strong>Deposit Recommended:</strong> Client has mixed reliability ({deal.client.reliabilityScore}/100). Require 30% upfront deposit.
                  </div>
                ) : (
                  <div className="bg-[var(--dusty-rose)]/10 text-[var(--dusty-rose)] p-3 rounded-xl text-sm border border-[var(--dusty-rose)]/20">
                    <strong>Escrow Required:</strong> Client is high-risk ({deal.client.reliabilityScore}/100). Require full payment into escrow before starting work.
                  </div>
                )
              ) : (
                <div className="text-sm text-[var(--soft-stone)]">Link a client to get term recommendations.</div>
              )}
            </div>

            {deal.customData && Object.keys(deal.customData).length > 0 && (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-[rgba(191,179,163,0.3)]">
                <h3 className="font-bold text-[var(--warm-ink)] mb-4">Custom Fields</h3>
                <div className="space-y-2">
                  {Object.entries(deal.customData).map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-[rgba(191,179,163,0.1)] pb-2 last:border-0 last:pb-0">
                      <span className="text-[var(--soft-stone)] text-sm">{k}</span>
                      <span className="font-medium text-sm">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
