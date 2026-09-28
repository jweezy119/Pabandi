import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { Button, Chip, EmptyState } from '../../components/primitives';
import ClientSidebar from '../crm/components/ClientSidebar';
import ClientTimeline from '../crm/components/ClientTimeline';
import { Modal } from '../../components/primitives/Modal';
import { Input } from '../../components/primitives/Input';
import { TrustPanel } from '../../components/TrustPanel';

import { TrustPanel } from '../../components/TrustPanel';
import { InlineEdit } from '../../components/primitives/InlineEdit';

const TABS = ['Command Center', 'Files'];

export default function ContactClientDetailPage() {
  const { id } = useParams();
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Command Center');

  const [invoices, setInvoices] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);

  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityForm, setActivityForm] = useState({ type: 'NOTE', title: '', description: '' });

  useEffect(() => {
    if (id) fetchClientAllData();
  }, [id]);

  async function fetchClientAllData() {
    setLoading(true);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    const baseUrl = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';

    try {
      const [clientRes, invRes, actRes, dealsRes, jobsRes, filesRes] = await Promise.all([
        fetch(`${baseUrl}/api/v1/crm/clients/${id}`, { headers }),
        fetch(`${baseUrl}/api/v1/crm/invoices?clientId=${id}`, { headers }),
        fetch(`${baseUrl}/api/v1/crm/activities?clientId=${id}`, { headers }),
        fetch(`${baseUrl}/api/v1/crm/deals?clientId=${id}`, { headers }),
        fetch(`${baseUrl}/api/v1/crm/jobs?clientId=${id}`, { headers }),
        fetch(`${baseUrl}/api/v1/crm/files?clientId=${id}`, { headers }),
      ]);

      if (clientRes.ok) setClient((await clientRes.json()).data);
      if (invRes.ok) setInvoices((await invRes.json()).data || []);
      if (actRes.ok) setActivities((await actRes.json()).data || []);
      if (dealsRes.ok) setDeals((await dealsRes.json()).data || []);
      if (jobsRes.ok) setJobs((await jobsRes.json()).data || []);
      if (filesRes.ok) setFiles((await filesRes.json()).data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleClientUpdate = async (field: string, value: any) => {
    const token = localStorage.getItem('token');
    const baseUrl = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
    const res = await fetch(`${baseUrl}/api/v1/crm/clients/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ [field]: value }),
    });
    if (!res.ok) throw new Error('Failed to update');
    setClient((prev: any) => ({ ...prev, [field]: value }));
  };

  async function handleCreateActivity(e: React.FormEvent) {
    e.preventDefault();
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
      const res = await fetch(`${baseUrl}/api/v1/crm/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ ...activityForm, clientId: id }),
      });
      if (res.ok) {
        setShowActivityModal(false);
        setActivityForm({ type: 'NOTE', title: '', description: '' });
        fetchClientAllData();
      }
    } catch (err) {
      console.error(err);
    }
  }

  if (loading) return <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" ><div className="p-8 text-center text-[var(--soft-stone)]">Loading...</div></DashboardLayout>;
  if (!client) return <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" ><EmptyState icon="person_off" title="Not Found" description="Client does not exist." actionLabel="Go Back" onAction={() => window.location.href = '/contact/clients'} /></DashboardLayout>;

  const totalBilled = invoices.reduce((s, inv) => s + (inv.subtotal || 0), 0);
  const outstanding = invoices.filter(i => i.status === 'sent' || i.status === 'overdue' || i.status === 'draft').reduce((s, inv) => s + (inv.subtotal || 0), 0);

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" >
      <div className="space-y-6">
        <Link to="/contact/clients" className="inline-flex items-center gap-2 text-sm text-[var(--clay)] font-medium hover:underline clay-fade">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Clients
        </Link>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 clay-heading">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-[var(--clay)] text-white text-2xl font-bold shadow-md">
              {client.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold" style={{ color: 'var(--warm-ink)' }}>
                  <InlineEdit value={client.name} onSave={(val) => handleClientUpdate('name', val)} />
                </h1>
                <Chip label={client.status || 'ACTIVE'} variant="neutral" />
              </div>
              <p className="text-[var(--soft-stone)] text-sm flex gap-2">
                <InlineEdit value={client.email || ''} onSave={(val) => handleClientUpdate('email', val)} placeholder="Add email" />
                ·
                <InlineEdit value={client.phone || ''} onSave={(val) => handleClientUpdate('phone', val)} placeholder="Add phone" />
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {client.passportId && (
              <Button variant="ghost" icon="share" onClick={() => {
                const url = `${window.location.origin}/trust/${client.passportId}`;
                navigator.clipboard.writeText(url);
                alert('Trust profile link copied!');
              }}>Share Trust Profile</Button>
            )}
            <Button variant="primary" icon="add" onClick={() => setShowActivityModal(true)}>Log Activity</Button>
          </div>
        </div>

        <div className="flex gap-1 border-b border-[rgba(191,179,163,0.3)] pb-2 overflow-x-auto hide-scrollbar clay-fade clay-delay-1">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`clay-tab px-4 py-2 font-bold text-sm rounded-full ${activeTab === tab ? 'clay-tab--active' : 'clay-tab--inactive'}`}>
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'Command Center' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <TrustPanel passportId={client.passportId} />
              <ClientTimeline activities={activities} deals={deals} invoices={invoices} jobs={jobs} notes={client.notes} files={files} />
            </div>
            <div>
              <ClientSidebar client={client} outstanding={outstanding} totalBilled={totalBilled} onScheduleTask={() => setShowActivityModal(true)} />
            </div>
          </div>
        )}

        {activeTab === 'Files' && (
          <div className="p-4 bg-white rounded-2xl shadow-sm border border-[rgba(191,179,163,0.3)]">
            <h2 className="text-xl font-bold clay-heading mb-4">Files</h2>
            {files.length === 0 ? <EmptyState icon="attach_file" title="No Files" description="No files uploaded." /> : (
              <div className="space-y-3">
                {files.map(f => (
                  <div key={f.id} className="flex justify-between items-center p-4 rounded-xl bg-[var(--warm-sand)]/20">
                    <div><h4 className="font-bold">{f.fileName}</h4><p className="text-xs text-[var(--soft-stone)]">{new Date(f.createdAt).toLocaleDateString()}</p></div>
                    <a href={f.fileUrl} target="_blank" className="text-[var(--clay)] font-bold">Download</a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Modal isOpen={showActivityModal} onClose={() => setShowActivityModal(false)} title="Log Activity">
          <form onSubmit={handleCreateActivity} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--warm-ink)]">Type</label>
              <select value={activityForm.type} onChange={(e) => setActivityForm({ ...activityForm, type: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-white border border-[var(--warm-sand)]">
                <option value="NOTE">Note</option>
                <option value="CALL">Call</option>
                <option value="EMAIL">Email</option>
                <option value="MEETING">Meeting</option>
                <option value="TASK">Task</option>
              </select>
            </div>
            <Input label="Title" required value={activityForm.title} onChange={(e: any) => setActivityForm({ ...activityForm, title: e.target.value })} />
            <Input label="Description" value={activityForm.description} onChange={(e: any) => setActivityForm({ ...activityForm, description: e.target.value })} />
            <div className="flex justify-end gap-3 pt-4"><Button variant="ghost" onClick={() => setShowActivityModal(false)}>Cancel</Button><Button type="submit" variant="primary">Save</Button></div>
          </form>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
