import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Surface, Button, Badge, tokens } from '../design-system';
import { propertyManagerService } from '../services/api';

const DOC_TYPES = [
  { value: 'ID', label: '🪪 Government ID', description: 'Driver license, passport, state ID' },
  { value: 'INCOME_PROOF', label: '💰 Proof of Income', description: 'Pay stubs, tax returns, bank statements' },
  { value: 'LEASE_AGREEMENT', label: '📝 Lease Agreement', description: 'Signed lease contracts' },
  { value: 'BACKGROUND_CHECK', label: '🔍 Background Check', description: 'Screening reports' },
  { value: 'OTHER', label: '📎 Other', description: 'Pet records, insurance, misc' },
];

export const DocumentsPage: React.FC = () => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [filter, setFilter] = useState<string>('ALL');
  const [form, setForm] = useState({ name: '', type: 'ID', tenantEmail: '', fileUrl: '' });
  const [err, setErr] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => { loadDocuments(); }, []);

  const loadDocuments = async () => {
    try {
      const res = await propertyManagerService.documents();
      setDocuments(res.data?.data || []);
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const uploadDocument = async () => {
    if (!form.name || !form.fileUrl) {
      setErr('Name and file URL are required');
      return;
    }
    setUploading(true);
    setErr('');
    try {
      await propertyManagerService.uploadDocument({
        ...form,
        fileName: form.name,
      });
      setShowUpload(false);
      setForm({ name: '', type: 'ID', tenantEmail: '', fileUrl: '' });
      loadDocuments();
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Failed to upload');
    } finally {
      setUploading(false);
    }
  };

  const deleteDocument = async (id: string) => {
    try {
      await propertyManagerService.deleteDocument(id);
      loadDocuments();
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Failed to delete');
    }
  };

  const filteredDocs = filter === 'ALL' ? documents : documents.filter(d => d.type === filter);

  const getTypeLabel = (type: string) => DOC_TYPES.find(t => t.value === type)?.label || type;

  if (loading) return <div className="min-h-screen p-8" style={{ background: tokens.color.background, color: 'white' }}>Loading...</div>;

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-100">📁 Documents</h1>
            <p className="text-sm" style={{ color: tokens.color.muted }}>Upload and manage tenant documents</p>
          </div>
          <Link to="/property-manager" className="text-sm text-indigo-300 hover:text-indigo-200">← Back to CRM</Link>
        </div>

        {err && <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: tokens.color.danger + '15', color: tokens.color.danger }}>{err}</div>}

        {/* Filter */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          <button onClick={() => setFilter('ALL')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${filter === 'ALL' ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10'}`}>
            All ({documents.length})
          </button>
          {DOC_TYPES.map(t => (
            <button key={t.value} onClick={() => setFilter(t.value)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${filter === t.value ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10'}`}>
              {t.label} ({documents.filter(d => d.type === t.value).length})
            </button>
          ))}
        </div>

        {!showUpload && <Button onClick={() => setShowUpload(true)} className="mb-6">+ Upload Document</Button>}

        {showUpload && (
          <Surface className="mb-6">
            <h3 className="text-lg font-bold text-slate-100 mb-4">Upload Document</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Document Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. John Doe Driver License" className="w-full rounded-xl px-4 py-3 outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Type *</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full rounded-xl px-4 py-3 outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Tenant Email</label>
                <input value={form.tenantEmail} onChange={(e) => setForm({ ...form, tenantEmail: e.target.value })} placeholder="tenant@email.com" className="w-full rounded-xl px-4 py-3 outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">File URL *</label>
                <input value={form.fileUrl} onChange={(e) => setForm({ ...form, fileUrl: e.target.value })} placeholder="https://..." className="w-full rounded-xl px-4 py-3 outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }} />
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white/5 mt-4">
              <p className="text-xs" style={{ color: tokens.color.muted }}>
                💡 <strong>Tip:</strong> Upload files to Google Drive, Dropbox, or any file sharing service and paste the share link above. Make sure the link is publicly accessible.
              </p>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={uploadDocument} disabled={uploading} className="flex-1">{uploading ? 'Uploading...' : 'Upload'}</Button>
              <Button onClick={() => setShowUpload(false)} variant="ghost">Cancel</Button>
            </div>
          </Surface>
        )}

        {/* Document List */}
        {filteredDocs.length === 0 ? (
          <p className="text-center py-8" style={{ color: tokens.color.muted }}>No documents found.</p>
        ) : (
          <div className="space-y-3">
            {filteredDocs.map((doc) => (
              <Surface key={doc.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-100">{doc.title || doc.name}</div>
                    <div className="text-xs" style={{ color: tokens.color.muted }}>
                      {getTypeLabel(doc.type)} {doc.tenantEmail && `· ${doc.tenantEmail}`}
                    </div>
                    <div className="text-xs mt-1" style={{ color: tokens.color.muted }}>
                      Uploaded {new Date(doc.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-300 hover:text-indigo-200">View →</a>
                    <button onClick={() => deleteDocument(doc.id)} className="text-xs text-red-300 hover:text-red-200">Delete</button>
                  </div>
                </div>
              </Surface>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentsPage;
