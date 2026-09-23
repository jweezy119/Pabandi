import React, { useState, useEffect, useCallback } from 'react';

interface ImportMeta {
  env: Record<string, string | undefined>;
}

const API_BASE = `${(import.meta as any).env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm`;

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  address?: string;
  notes?: string;
  tags: string[];
  last_contact?: string;
  created_at: string;
}

interface ContactDeal {
  id: string;
  title: string;
  value: number;
  stage: 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';
  contact_id: string;
  contact_name: string;
  description?: string;
  created_at: string;
}

interface ContactActivity {
  id: string;
  type: 'call' | 'email' | 'meeting' | 'note';
  subject: string;
  description?: string;
  contact_id: string;
  contact_name: string;
  created_at: string;
}

type ViewMode = 'contacts' | 'pipeline';
type PanelMode = 'list' | 'detail';

const DEAL_STAGES: Array<ContactDeal['stage']> = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];

const STAGE_LABELS: Record<ContactDeal['stage'], string> = {
  lead: 'Lead',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

/* ─── Sub-components ─── */

function ContactCard({ contact, isSelected, onClick }: { contact: Contact; isSelected: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '16px',
        borderRadius: '16px',
        background: isSelected ? 'var(--clay)' : 'white',
        color: isSelected ? 'white' : 'var(--warm-ink)',
        boxShadow: '0 2px 8px rgba(42,37,32,0.08)',
        marginBottom: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        border: isSelected ? 'none' : '1px solid var(--warm-sand)',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: '16px' }}>{contact.name}</div>
      {contact.company && (
        <div style={{ fontSize: '13px', opacity: 0.8, marginTop: '4px' }}>{contact.company}</div>
      )}
      <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '6px' }}>{contact.email}</div>
      <div style={{ display: 'flex', gap: '4px', marginTop: '8px', flexWrap: 'wrap' }}>
        {contact.tags?.slice(0, 3).map((tag) => (
          <span
            key={tag}
            style={{
              fontSize: '10px',
              padding: '2px 8px',
              borderRadius: '8px',
              background: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--cream)',
              color: isSelected ? 'white' : 'var(--warm-ink)',
            }}
          >
            {tag}
          </span>
        ))}
      </div>
      {contact.last_contact && (
        <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '8px' }}>
          Last: {new Date(contact.last_contact).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}

function DealCard({ deal, onDragStart }: { deal: ContactDeal; onDragStart: (e: React.DragEvent, deal: ContactDeal) => void }) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, deal)}
      style={{
        padding: '12px',
        borderRadius: '12px',
        background: 'white',
        boxShadow: '0 2px 6px rgba(42,37,32,0.06)',
        marginBottom: '10px',
        cursor: 'grab',
        border: '1px solid var(--warm-sand)',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: '14px' }}>{deal.title}</div>
      <div style={{ fontSize: '13px', color: 'var(--clay)', fontWeight: 500, marginTop: '4px' }}>
        ${deal.value.toLocaleString()}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--soft-stone)', marginTop: '4px' }}>
        {deal.contact_name}
      </div>
    </div>
  );
}

function DealColumn({
  stage,
  deals,
  onDrop,
  onDragStart,
}: {
  stage: ContactDeal['stage'];
  deals: ContactDeal[];
  onDrop: (e: React.DragEvent, stage: ContactDeal['stage']) => void;
  onDragStart: (e: React.DragEvent, deal: ContactDeal) => void;
}) {
  const [isOver, setIsOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        setIsOver(false);
        onDrop(e, stage);
      }}
      style={{
        flex: 1,
        minWidth: '180px',
        background: isOver ? 'var(--cream)' : 'var(--warm-sand)',
        borderRadius: '20px',
        padding: '14px',
        transition: 'background 0.2s',
      }}
    >
      <div
        style={{
          fontWeight: 700,
          fontSize: '13px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: 'var(--warm-ink)',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span>{STAGE_LABELS[stage]}</span>
        <span
          style={{
            background: 'var(--clay)',
            color: 'white',
            borderRadius: '10px',
            padding: '2px 8px',
            fontSize: '11px',
          }}
        >
          {deals.length}
        </span>
      </div>
      {deals.map((deal) => (
        <DealCard key={deal.id} deal={deal} onDragStart={onDragStart} />
      ))}
      {deals.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--soft-stone)', fontSize: '12px', padding: '20px 0' }}>
          Drop here
        </div>
      )}
    </div>
  );
}

function ActivityItem({ activity }: { activity: ContactActivity }) {
  const icons: Record<string, string> = { call: '📞', email: '✉️', meeting: '🤝', note: '📝' };
  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: '12px',
        background: 'white',
        boxShadow: '0 1px 4px rgba(42,37,32,0.06)',
        marginBottom: '8px',
        border: '1px solid var(--warm-sand)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '18px' }}>{icons[activity.type] || '📌'}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '14px' }}>{activity.subject}</div>
          {activity.description && (
            <div style={{ fontSize: '13px', color: 'var(--soft-stone)', marginTop: '2px' }}>
              {activity.description}
            </div>
          )}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--soft-stone)' }}>
          {new Date(activity.created_at).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}

function AddContactForm({ onSave, onCancel }: { onSave: (data: Partial<Contact>) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', address: '', notes: '', tags: '' });
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(42,37,32,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onCancel}
    >
      <div
        style={{ background: 'white', borderRadius: '28px', padding: '32px', width: '480px', maxWidth: '90vw' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginBottom: '20px', color: 'var(--warm-ink)' }}>Add Contact</h3>
        {(['name', 'email', 'phone', 'company', 'address'] as const).map((field) => (
          <input
            key={field}
            placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
            value={form[field]}
            onChange={(e) => setForm({ ...form, [field]: e.target.value })}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid var(--warm-sand)',
              marginBottom: '12px',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        ))}
        <textarea
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: '12px',
            border: '1px solid var(--warm-sand)',
            marginBottom: '12px',
            fontSize: '14px',
            outline: 'none',
            minHeight: '80px',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
        <input
          placeholder="Tags (comma separated)"
          value={form.tags}
          onChange={(e) => setForm({ ...form, tags: e.target.value })}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: '12px',
            border: '1px solid var(--warm-sand)',
            marginBottom: '20px',
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 24px',
              borderRadius: '12px',
              border: '1px solid var(--soft-stone)',
              background: 'white',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() =>
              onSave({
                ...form,
                tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
              })
            }
            style={{
              padding: '10px 24px',
              borderRadius: '12px',
              border: 'none',
              background: 'var(--clay)',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function AddDealForm({ contacts, onSave, onCancel }: { contacts: Contact[]; onSave: (data: Partial<ContactDeal>) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ title: '', value: '', contact_id: '', stage: 'lead' as ContactDeal['stage'], description: '' });
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(42,37,32,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onCancel}
    >
      <div
        style={{ background: 'white', borderRadius: '28px', padding: '32px', width: '480px', maxWidth: '90vw' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginBottom: '20px', color: 'var(--warm-ink)' }}>Add Deal</h3>
        <input
          placeholder="Deal Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: '12px',
            border: '1px solid var(--warm-sand)',
            marginBottom: '12px',
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <input
          placeholder="Value ($)"
          type="number"
          value={form.value}
          onChange={(e) => setForm({ ...form, value: e.target.value })}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: '12px',
            border: '1px solid var(--warm-sand)',
            marginBottom: '12px',
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <select
          value={form.contact_id}
          onChange={(e) => setForm({ ...form, contact_id: e.target.value })}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: '12px',
            border: '1px solid var(--warm-sand)',
            marginBottom: '12px',
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        >
          <option value="">Select Contact</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={form.stage}
          onChange={(e) => setForm({ ...form, stage: e.target.value as ContactDeal['stage'] })}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: '12px',
            border: '1px solid var(--warm-sand)',
            marginBottom: '12px',
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        >
          {DEAL_STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </select>
        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: '12px',
            border: '1px solid var(--warm-sand)',
            marginBottom: '20px',
            fontSize: '14px',
            outline: 'none',
            minHeight: '60px',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 24px',
              borderRadius: '12px',
              border: '1px solid var(--soft-stone)',
              background: 'white',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() =>
              onSave({
                ...form,
                value: parseFloat(form.value) || 0,
                contact_name: contacts.find((c) => c.id === form.contact_id)?.name || '',
              })
            }
            style={{
              padding: '10px 24px',
              borderRadius: '12px',
              border: 'none',
              background: 'var(--clay)',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function AddActivityForm({
  contacts,
  onSave,
  onCancel,
}: {
  contacts: Contact[];
  onSave: (data: Partial<ContactActivity>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    type: 'note' as ContactActivity['type'],
    subject: '',
    description: '',
    contact_id: '',
  });
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(42,37,32,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onCancel}
    >
      <div
        style={{ background: 'white', borderRadius: '28px', padding: '32px', width: '480px', maxWidth: '90vw' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginBottom: '20px', color: 'var(--warm-ink)' }}>Add Activity</h3>
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value as ContactActivity['type'] })}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: '12px',
            border: '1px solid var(--warm-sand)',
            marginBottom: '12px',
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        >
          <option value="call">📞 Call</option>
          <option value="email">✉️ Email</option>
          <option value="meeting">🤝 Meeting</option>
          <option value="note">📝 Note</option>
        </select>
        <input
          placeholder="Subject"
          value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: '12px',
            border: '1px solid var(--warm-sand)',
            marginBottom: '12px',
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <select
          value={form.contact_id}
          onChange={(e) => setForm({ ...form, contact_id: e.target.value })}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: '12px',
            border: '1px solid var(--warm-sand)',
            marginBottom: '12px',
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        >
          <option value="">Select Contact</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: '12px',
            border: '1px solid var(--warm-sand)',
            marginBottom: '20px',
            fontSize: '14px',
            outline: 'none',
            minHeight: '80px',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 24px',
              borderRadius: '12px',
              border: '1px solid var(--soft-stone)',
              background: 'white',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() =>
              onSave({
                ...form,
                contact_name: contacts.find((c) => c.id === form.contact_id)?.name || '',
              })
            }
            style={{
              padding: '10px 24px',
              borderRadius: '12px',
              border: 'none',
              background: 'var(--clay)',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */

export default function ContactsPipelineTab() {
  const [viewMode, setViewMode] = useState<ViewMode>('contacts');
  const [panelMode, setPanelMode] = useState<PanelMode>('list');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<ContactDeal[]>([]);
  const [activities, setActivities] = useState<ContactActivity[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddContact, setShowAddContact] = useState(false);
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchContacts = useCallback(async () => {
    try {
      const data = await apiFetch('/clients');
      setContacts(data.data || data || []);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const fetchDeals = useCallback(async () => {
    try {
      const data = await apiFetch('/deals');
      setDeals(data.data || data || []);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const fetchActivities = useCallback(async () => {
    try {
      const data = await apiFetch('/activities');
      setActivities(data.data || data || []);
    } catch (err: any) {
      // activities endpoint may not have GET yet
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchContacts(), fetchDeals(), fetchActivities()]);
      setLoading(false);
    };
    load();
  }, [fetchContacts, fetchDeals, fetchActivities]);

  const handleAddContact = async (data: Partial<Contact>) => {
    try {
      const result = await apiFetch('/clients', { method: 'POST', body: JSON.stringify(data) });
      const newContact = result.data || result;
      setContacts((prev) => [...prev, newContact]);
      setShowAddContact(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAddDeal = async (data: Partial<ContactDeal>) => {
    try {
      const result = await apiFetch('/deals', { method: 'POST', body: JSON.stringify(data) });
      const newDeal = result.data || result;
      setDeals((prev) => [...prev, newDeal]);
      setShowAddDeal(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAddActivity = async (data: Partial<ContactActivity>) => {
    try {
      const result = await apiFetch('/activities', { method: 'POST', body: JSON.stringify(data) });
      const newActivity = result.data || result;
      setActivities((prev) => [...prev, newActivity]);
      setShowAddActivity(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDragStart = (_e: React.DragEvent, deal: ContactDeal) => {
    _e.dataTransfer.setData('dealId', deal.id);
  };

  const handleDrop = async (_e: React.DragEvent, stage: ContactDeal['stage']) => {
    const dealId = _e.dataTransfer.getData('dealId');
    if (!dealId) return;
    try {
      await apiFetch(`/deals/${dealId}`, { method: 'PUT', body: JSON.stringify({ stage }) });
      setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage } : d)));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const filteredContacts = contacts.filter(
    (c) =>
      c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const contactActivities = selectedContact
    ? activities.filter((a) => a.contact_id === selectedContact.id)
    : [];

  const contactDeals = selectedContact
    ? deals.filter((d) => d.contact_id === selectedContact.id)
    : [];

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px' }}>
        <div style={{ color: 'var(--soft-stone)', fontSize: '16px' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', background: 'var(--cream)', minHeight: '100%', borderRadius: '28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--warm-ink)', fontSize: '24px', fontWeight: 700 }}>
            Contacts & Pipeline
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--soft-stone)', fontSize: '14px' }}>
            Manage leads, contacts, deals, and activities
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShowAddContact(true)}
            style={{
              padding: '10px 20px',
              borderRadius: '12px',
              border: 'none',
              background: 'var(--clay)',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            + Contact
          </button>
          <button
            onClick={() => setShowAddDeal(true)}
            style={{
              padding: '10px 20px',
              borderRadius: '12px',
              border: 'none',
              background: 'var(--sage)',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            + Deal
          </button>
          <button
            onClick={() => setShowAddActivity(true)}
            style={{
              padding: '10px 20px',
              borderRadius: '12px',
              border: 'none',
              background: 'var(--muted-ochre)',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            + Activity
          </button>
        </div>
      </div>

      {/* View Toggle */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'var(--warm-sand)', borderRadius: '14px', padding: '4px', width: 'fit-content' }}>
        <button
          onClick={() => { setViewMode('contacts'); setPanelMode('list'); }}
          style={{
            padding: '10px 24px',
            borderRadius: '10px',
            border: 'none',
            background: viewMode === 'contacts' ? 'var(--clay)' : 'transparent',
            color: viewMode === 'contacts' ? 'white' : 'var(--warm-ink)',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            transition: 'all 0.2s',
          }}
        >
          Contacts
        </button>
        <button
          onClick={() => setViewMode('pipeline')}
          style={{
            padding: '10px 24px',
            borderRadius: '10px',
            border: 'none',
            background: viewMode === 'pipeline' ? 'var(--clay)' : 'transparent',
            color: viewMode === 'pipeline' ? 'white' : 'var(--warm-ink)',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            transition: 'all 0.2s',
          }}
        >
          Pipeline
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '12px',
            background: '#FEE2E2',
            color: '#DC2626',
            marginBottom: '16px',
            fontSize: '14px',
          }}
        >
          {error}
        </div>
      )}

      {/* Contacts View */}
      {viewMode === 'contacts' && (
        <div style={{ display: 'flex', gap: '24px', height: 'calc(100vh - 280px)' }}>
          {/* Left Panel - Contact List */}
          <div
            style={{
              width: panelMode === 'list' ? '100%' : '380px',
              display: 'flex',
              flexDirection: 'column',
              background: 'white',
              borderRadius: '28px',
              padding: '20px',
              boxShadow: '0 4px 16px rgba(42,37,32,0.06)',
              overflow: 'hidden',
            }}
          >
            <input
              placeholder="🔍 Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '14px',
                border: '1px solid var(--warm-sand)',
                marginBottom: '16px',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filteredContacts.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--soft-stone)', padding: '40px 0' }}>
                  No contacts found
                </div>
              ) : (
                filteredContacts.map((contact) => (
                  <ContactCard
                    key={contact.id}
                    contact={contact}
                    isSelected={selectedContact?.id === contact.id}
                    onClick={() => {
                      setSelectedContact(contact);
                      setPanelMode('detail');
                    }}
                  />
                ))
              )}
            </div>
          </div>

          {/* Right Panel - Contact Detail */}
          {panelMode === 'detail' && selectedContact && (
            <div
              style={{
                flex: 1,
                background: 'white',
                borderRadius: '28px',
                padding: '24px',
                boxShadow: '0 4px 16px rgba(42,37,32,0.06)',
                overflowY: 'auto',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '22px', color: 'var(--warm-ink)' }}>{selectedContact.name}</h3>
                  {selectedContact.company && (
                    <div style={{ color: 'var(--soft-stone)', marginTop: '4px' }}>{selectedContact.company}</div>
                  )}
                </div>
                <button
                  onClick={() => setPanelMode('list')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: '1px solid var(--warm-sand)',
                    background: 'white',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  ← Back
                </button>
              </div>

              {/* Contact Info */}
              <div
                style={{
                  background: 'var(--cream)',
                  borderRadius: '16px',
                  padding: '16px',
                  marginBottom: '20px',
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--soft-stone)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</div>
                    <div style={{ fontSize: '14px', marginTop: '2px' }}>{selectedContact.email || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--soft-stone)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phone</div>
                    <div style={{ fontSize: '14px', marginTop: '2px' }}>{selectedContact.phone || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--soft-stone)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Address</div>
                    <div style={{ fontSize: '14px', marginTop: '2px' }}>{selectedContact.address || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--soft-stone)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tags</div>
                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                      {selectedContact.tags?.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '8px',
                            background: 'var(--warm-sand)',
                            color: 'var(--warm-ink)',
                          }}
                        >
                          {tag}
                        </span>
                      )) || '—'}
                    </div>
                  </div>
                </div>
                {selectedContact.notes && (
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--soft-stone)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Notes</div>
                    <div style={{ fontSize: '14px', marginTop: '2px' }}>{selectedContact.notes}</div>
                  </div>
                )}
              </div>

              {/* Associated Deals */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 12px', color: 'var(--warm-ink)', fontSize: '16px' }}>
                  Deals ({contactDeals.length})
                </h4>
                {contactDeals.length === 0 ? (
                  <div style={{ color: 'var(--soft-stone)', fontSize: '14px' }}>No deals associated</div>
                ) : (
                  contactDeals.map((deal) => (
                    <div
                      key={deal.id}
                      style={{
                        padding: '12px',
                        borderRadius: '12px',
                        background: 'var(--cream)',
                        marginBottom: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{deal.title}</div>
                        <div style={{ fontSize: '12px', color: 'var(--soft-stone)' }}>
                          {STAGE_LABELS[deal.stage]}
                        </div>
                      </div>
                      <div style={{ fontWeight: 600, color: 'var(--clay)' }}>${deal.value.toLocaleString()}</div>
                    </div>
                  ))
                )}
              </div>

              {/* Activities */}
              <div>
                <h4 style={{ margin: '0 0 12px', color: 'var(--warm-ink)', fontSize: '16px' }}>
                  Activities ({contactActivities.length})
                </h4>
                {contactActivities.length === 0 ? (
                  <div style={{ color: 'var(--soft-stone)', fontSize: '14px' }}>No activities recorded</div>
                ) : (
                  contactActivities
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map((activity) => <ActivityItem key={activity.id} activity={activity} />)
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pipeline View */}
      {viewMode === 'pipeline' && (
        <div
          style={{
            display: 'flex',
            gap: '16px',
            overflowX: 'auto',
            paddingBottom: '16px',
            height: 'calc(100vh - 280px)',
          }}
        >
          {DEAL_STAGES.map((stage) => (
            <DealColumn
              key={stage}
              stage={stage}
              deals={deals.filter((d) => d.stage === stage)}
              onDrop={handleDrop}
              onDragStart={handleDragStart}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showAddContact && <AddContactForm onSave={handleAddContact} onCancel={() => setShowAddContact(false)} />}
      {showAddDeal && <AddDealForm contacts={contacts} onSave={handleAddDeal} onCancel={() => setShowAddDeal(false)} />}
      {showAddActivity && (
        <AddActivityForm contacts={contacts} onSave={handleAddActivity} onCancel={() => setShowAddActivity(false)} />
      )}
    </div>
  );
}
