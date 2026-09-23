import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';

const PM_API = `${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/property-manager`;

const DOC_CATEGORIES = [
  { value: 'ID', label: 'ID', icon: '🪪' },
  { value: 'INCOME_PROOF', label: 'Income Proof', icon: '💰' },
  { value: 'LEASE_AGREEMENT', label: 'Lease Agreement', icon: '📝' },
  { value: 'BACKGROUND_CHECK', label: 'Background Check', icon: '🔍' },
  { value: 'OTHER', label: 'Other', icon: '📎' },
];

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  DOC_CATEGORIES.map((c) => [c.value, c.label])
);

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('token') || localStorage.getItem('auth_token') || '';
  return {
    'Content-Type': 'application/json',
    Authorization: token ? `Bearer ${token}` : '',
  };
}

async function pmFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${PM_API}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

interface DocumentRow {
  id: string;
  title: string;
  category: string;
  fileName: string;
  fileUrl: string;
  tenantEmail?: string | null;
  leaseId?: string | null;
  uploadedBy: string;
  createdAt: string;
}

const DocumentsPage: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');

  // Filters
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    category: 'ID',
    fileUrl: '',
    fileName: '',
    tenantEmail: '',
    leaseId: '',
  });

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const data = await pmFetch<{ data: DocumentRow[] }>('/documents');
      setDocuments(data.data || []);
    } catch (e: any) {
      // Fallback: some backends nest under tenantApplication/documents
      try {
        const alt = await pmFetch<any>('/dashboard');
        setDocuments(alt.data?.documents || []);
      } catch {
        setErr(e?.message || 'Failed to load documents');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const resetForm = () => {
    setForm({ title: '', category: 'ID', fileUrl: '', fileName: '', tenantEmail: '', leaseId: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr('');
    setNotice('');

    if (!form.title.trim() || !form.fileUrl.trim()) {
      setErr('Title and file URL are required.');
      setSaving(false);
      return;
    }

    const fileName = form.fileName.trim() || form.fileUrl.split('/').pop() || 'document';

    try {
      await pmFetch('/documents', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title.trim(),
          category: form.category,
          fileUrl: form.fileUrl.trim(),
          fileName,
          tenantEmail: form.tenantEmail.trim() || null,
          leaseId: form.leaseId.trim() || null,
          uploadedBy: 'MANAGER',
        }),
      });
      setNotice('Document added successfully.');
      setShowForm(false);
      resetForm();
      await loadDocuments();
    } catch (e: any) {
      setErr(e?.message || 'Failed to add document.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this document? This cannot be undone.')) return;
    setErr('');
    setNotice('');
    try {
      await pmFetch(`/documents/${id}`, { method: 'DELETE' });
      setNotice('Document deleted.');
      await loadDocuments();
    } catch (e: any) {
      setErr(e?.message || 'Failed to delete document.');
    }
  };

  const handleView = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Derived list
  const filtered = documents.filter((d) => {
    const matchesCat = filterCategory === 'ALL' || d.category === filterCategory;
    const matchesSearch = !search.trim() || d.title.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const catCount = (cat: string) => documents.filter((d) => d.category === cat).length;

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'var(--cream, #F5EFE6)',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        paddingBottom: 48,
      }}
    >
      {/* Header */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: 'var(--warm-ink, #2A2520)',
                margin: 0,
              }}
            >
              📁 Documents
            </h1>
            <p style={{ margin: '4px 0 0', color: 'var(--soft-stone, #BFB3A3)', fontSize: 14 }}>
              {documents.length} document{documents.length !== 1 ? 's' : ''} on record
            </p>
          </div>
          <Link
            to="/property-manager"
            style={{
              fontSize: 14,
              color: 'var(--terracotta, #A85A3C)',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            ← Back to CRM
          </Link>
        </div>

        {/* Notices */}
        {err && (
          <div
            style={{
              marginTop: 16,
              padding: '12px 16px',
              borderRadius: 16,
              background: '#FEE2E2',
              color: '#991B1B',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            ⚠️ {err}
          </div>
        )}
        {notice && (
          <div
            style={{
              marginTop: 16,
              padding: '12px 16px',
              borderRadius: 16,
              background: 'var(--sage, #8A9A7B)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            ✓ {notice}
          </div>
        )}

        {/* Toolbar */}
        <div
          style={{
            marginTop: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => setFilterCategory('ALL')}
              style={{
                padding: '8px 14px',
                borderRadius: 14,
                border: '1px solid transparent',
                background: filterCategory === 'ALL' ? 'var(--clay, #C97B5A)' : '#fff',
                color: filterCategory === 'ALL' ? '#fff' : 'var(--warm-ink, #2A2520)',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(42,37,32,0.08)',
                transition: 'all 0.15s',
              }}
            >
              All ({documents.length})
            </button>
            {DOC_CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setFilterCategory(c.value)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 14,
                  border: '1px solid transparent',
                  background: filterCategory === c.value ? 'var(--clay, #C97B5A)' : '#fff',
                  color: filterCategory === c.value ? '#fff' : 'var(--warm-ink, #2A2520)',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(42,37,32,0.08)',
                  transition: 'all 0.15s',
                }}
              >
                {c.icon} {c.label} ({catCount(c.value)})
              </button>
            ))}
          </div>

          {/* Add button */}
          <button
            onClick={() => {
              setShowForm((v) => !v);
              if (showForm) resetForm();
            }}
            style={{
              padding: '10px 20px',
              borderRadius: 14,
              border: 'none',
              background: 'var(--terracotta, #A85A3C)',
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(168,90,60,0.3)',
              transition: 'all 0.15s',
            }}
          >
            {showForm ? '− Cancel' : '+ Add Document'}
          </button>
        </div>

        {/* Search */}
        <div style={{ marginTop: 16 }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title…"
            style={{
              width: '100%',
              maxWidth: 420,
              padding: '10px 16px',
              borderRadius: 14,
              border: '1px solid var(--soft-stone, #BFB3A3)',
              background: '#fff',
              color: 'var(--warm-ink, #2A2520)',
              fontSize: 14,
              outline: 'none',
              boxShadow: '0 1px 3px rgba(42,37,32,0.06)',
            }}
          />
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div
          style={{
            maxWidth: 1100,
            margin: '24px auto 0',
            padding: '0 24px',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 28,
              padding: 24,
              boxShadow: '0 4px 24px rgba(42,37,32,0.08)',
              border: '1px solid rgba(191,179,163,0.3)',
            }}
          >
            <h3
              style={{
                margin: '0 0 16px',
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--warm-ink, #2A2520)',
              }}
            >
              Add Document
            </h3>
            <form onSubmit={handleSubmit}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 16,
                }}
              >
                <div>
                  <label style={labelStyle}>Title *</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. John Doe Driver License"
                    required
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Category *</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    style={inputStyle}
                  >
                    {DOC_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.icon} {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>File URL *</label>
                  <input
                    value={form.fileUrl}
                    onChange={(e) => setForm({ ...form, fileUrl: e.target.value })}
                    placeholder="https://drive.google.com/file/d/… or https://dropbox.com/s/…"
                    required
                    style={inputStyle}
                  />
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--soft-stone, #BFB3A3)' }}>
                    Paste a Google Drive, Dropbox, or direct file share link. Make sure it's accessible.
                  </p>
                </div>
                <div>
                  <label style={labelStyle}>File Name</label>
                  <input
                    value={form.fileName}
                    onChange={(e) => setForm({ ...form, fileName: e.target.value })}
                    placeholder="auto-detected from URL"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Tenant Email</label>
                  <input
                    type="email"
                    value={form.tenantEmail}
                    onChange={(e) => setForm({ ...form, tenantEmail: e.target.value })}
                    placeholder="tenant@email.com"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Lease ID</label>
                  <input
                    value={form.leaseId}
                    onChange={(e) => setForm({ ...form, leaseId: e.target.value })}
                    placeholder="link to lease (optional)"
                    style={inputStyle}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    flex: 1,
                    padding: '12px 24px',
                    borderRadius: 14,
                    border: 'none',
                    background: saving ? 'var(--soft-stone, #BFB3A3)' : 'var(--clay, #C97B5A)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(201,123,90,0.3)',
                    transition: 'all 0.15s',
                  }}
                >
                  {saving ? 'Saving…' : 'Save Document'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  style={{
                    padding: '12px 24px',
                    borderRadius: 14,
                    border: '1px solid var(--soft-stone, #BFB3A3)',
                    background: '#fff',
                    color: 'var(--warm-ink, #2A2520)',
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document list */}
      <div style={{ maxWidth: 1100, margin: '24px auto 0', padding: '0 24px' }}>
        {loading ? (
          <div
            style={{
              background: '#fff',
              borderRadius: 28,
              padding: 48,
              textAlign: 'center',
              boxShadow: '0 2px 12px rgba(42,37,32,0.06)',
            }}
          >
            <p style={{ color: 'var(--soft-stone, #BFB3A3)', fontSize: 14 }}>Loading documents…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              background: '#fff',
              borderRadius: 28,
              padding: 48,
              textAlign: 'center',
              boxShadow: '0 2px 12px rgba(42,37,32,0.06)',
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 8 }}>📂</div>
            <p style={{ color: 'var(--warm-ink, #2A2520)', fontWeight: 600, margin: 0 }}>
              No documents found
            </p>
            <p style={{ color: 'var(--soft-stone, #BFB3A3)', fontSize: 14, margin: '4px 0 0' }}>
              {documents.length === 0
                ? 'Add your first document to get started.'
                : 'Try a different filter or search term.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {filtered.map((doc) => (
              <div
                key={doc.id}
                style={{
                  background: '#fff',
                  borderRadius: 28,
                  padding: 20,
                  boxShadow: '0 2px 12px rgba(42,37,32,0.06)',
                  border: '1px solid rgba(191,179,163,0.2)',
                  transition: 'box-shadow 0.15s, transform 0.15s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px rgba(42,37,32,0.12)';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 12px rgba(42,37,32,0.06)';
                  (e.currentTarget as HTMLDivElement).style.transform = 'none';
                }}
              >
                {/* Category badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span
                    style={{
                      padding: '4px 12px',
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 700,
                      background: categoryColor(doc.category),
                      color: '#fff',
                      letterSpacing: 0.3,
                    }}
                  >
                    {(CATEGORY_LABELS[doc.category] || doc.category).toUpperCase()}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--soft-stone, #BFB3A3)' }}>
                    {new Date(doc.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                {/* Title */}
                <h4
                  style={{
                    margin: 0,
                    fontSize: 16,
                    fontWeight: 700,
                    color: 'var(--warm-ink, #2A2520)',
                    lineHeight: 1.3,
                  }}
                >
                  {doc.title}
                </h4>

                {/* File name */}
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: 'var(--soft-stone, #BFB3A3)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={doc.fileName}
                >
                  📄 {doc.fileName}
                </p>

                {/* Links */}
                {(doc.tenantEmail || doc.leaseId) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {doc.tenantEmail && (
                      <span
                        style={{
                          padding: '3px 10px',
                          borderRadius: 10,
                          fontSize: 11,
                          fontWeight: 600,
                          background: 'var(--warm-sand, #E8D9C5)',
                          color: 'var(--warm-ink, #2A2520)',
                        }}
                      >
                        👤 {doc.tenantEmail}
                      </span>
                    )}
                    {doc.leaseId && (
                      <span
                        style={{
                          padding: '3px 10px',
                          borderRadius: 10,
                          fontSize: 11,
                          fontWeight: 600,
                          background: 'var(--sky-wash, #B8C9D4)',
                          color: 'var(--warm-ink, #2A2520)',
                        }}
                      >
                        🏠 Lease: {doc.leaseId.slice(0, 8)}…
                      </span>
                    )}
                  </div>
                )}

                {/* Uploaded by */}
                <p style={{ margin: 0, fontSize: 12, color: 'var(--soft-stone, #BFB3A3)' }}>
                  Uploaded by{' '}
                  <strong style={{ color: 'var(--warm-ink, #2A2520)' }}>
                    {doc.uploadedBy === 'TENANT' ? 'Tenant' : 'Manager'}
                  </strong>
                </p>

                {/* Actions */}
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    marginTop: 4,
                    paddingTop: 12,
                    borderTop: '1px solid rgba(191,179,163,0.2)',
                  }}
                >
                  <button
                    onClick={() => handleView(doc.fileUrl)}
                    style={{
                      flex: 1,
                      padding: '8px 16px',
                      borderRadius: 12,
                      border: 'none',
                      background: 'var(--clay, #C97B5A)',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: 'pointer',
                      boxShadow: '0 1px 4px rgba(201,123,90,0.3)',
                    }}
                  >
                    View
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    style={{
                      flex: 1,
                      padding: '8px 16px',
                      borderRadius: 12,
                      border: '1px solid var(--dusty-rose, #D4A5A5)',
                      background: '#fff',
                      color: 'var(--terracotta, #A85A3C)',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

function categoryColor(cat: string): string {
  switch (cat) {
    case 'ID':
      return 'var(--clay, #C97B5A)';
    case 'INCOME_PROOF':
      return 'var(--sage, #8A9A7B)';
    case 'LEASE_AGREEMENT':
      return 'var(--sky-wash, #B8C9D4)';
    case 'BACKGROUND_CHECK':
      return 'var(--muted-ochre, #D9A854)';
    default:
      return 'var(--dusty-rose, #D4A5A5)';
  }
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--warm-ink, #2A2520)',
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 14,
  border: '1px solid var(--soft-stone, #BFB3A3)',
  background: '#fff',
  color: 'var(--warm-ink, #2A2520)',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  boxShadow: 'inset 0 1px 2px rgba(42,37,32,0.04)',
};

export default DocumentsPage;
