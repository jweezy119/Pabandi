import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { Button, Card } from '../../components/primitives';
import { useAuthStore } from '../../store/authStore';
import {
  Shield, Check, X, Clock, Upload, FileText, AlertCircle,
  ChevronRight, Building2
} from 'lucide-react';
import toast from 'react-hot-toast';

interface VerificationStatus {
  status: string;
  documents: { id: string; fileName: string; fileType: string; category: string; verified: boolean; uploadedAt: string; expiresAt: string | null }[];
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  isVerified: boolean;
  verifiedAt: string | null;
}

const DOCUMENT_TYPES = [
  { value: 'business_license', label: 'Business License', icon: '📋' },
  { value: 'tax_id', label: 'Tax ID / EIN', icon: '🧾' },
  { value: 'insurance', label: 'Insurance Certificate', icon: '🛡️' },
  { value: 'other', label: 'Other Document', icon: '📄' },
];

export default function BusinessVerificationPage() {
  const { user } = useAuthStore();
  const businessId = (user as any)?.business?.id || (user as any)?.businessId || localStorage.getItem('businessId') || 'default';
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [docType, setDocType] = useState('business_license');
  const [docUrl, setDocUrl] = useState('');
  const [docName, setDocName] = useState('');

  useEffect(() => { loadStatus(); }, [businessId]);

  const loadStatus = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/business-verification/status?businessId=${businessId}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setStatus(data.data);
      }
    } catch (err) {
      console.error('Failed to load verification status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!docUrl) { toast.error('Please provide a document URL'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/business-verification/submit`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify({ businessId, documentType: docType, documentUrl: docUrl, documentName: docName || undefined }),
        }
      );
      const data = await res.json();
      if (data.success) {
        toast.success('Verification submitted for review');
        loadStatus();
        setDocUrl(''); setDocName('');
      } else {
        toast.error(data.error || 'Submission failed');
      }
    } catch (err) {
      toast.error('Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('File too large (max 10MB)'); return; }
    const reader = new FileReader();
    reader.onload = () => { setDocUrl(reader.result as string); setDocName(file.name); };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--clay)] border-t-transparent animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const statusConfig = {
    NOT_SUBMITTED: { icon: AlertCircle, color: 'var(--soft-stone)', label: 'Not Submitted', bg: 'var(--warm-sand)' },
    PENDING: { icon: Clock, color: 'var(--muted-ochre)', label: 'Pending Review', bg: 'var(--muted-ochre)' },
    APPROVED: { icon: Check, color: 'var(--sage)', label: 'Verified', bg: 'var(--sage)' },
    REJECTED: { icon: X, color: 'var(--dusty-rose)', label: 'Rejected', bg: 'var(--dusty-rose)' },
  }[status?.status || 'NOT_SUBMITTED'] || { icon: AlertCircle, color: 'var(--soft-stone)', label: 'Not Submitted', bg: 'var(--warm-sand)' };

  const StatusIcon = statusConfig.icon;

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--warm-ink)] font-headline">Business Verification</h1>
          <p className="text-sm text-[var(--soft-stone)] mt-1">Verify your business to build trust with customers</p>
        </div>

        <Card>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `color-mix(in srgb, ${statusConfig.bg} 15%, transparent)` }}>
              <StatusIcon size={24} style={{ color: statusConfig.color }} />
            </div>
            <div>
              <p className="text-lg font-bold text-[var(--warm-ink)]">{statusConfig.label}</p>
              <p className="text-sm text-[var(--soft-stone)]">
                {status?.status === 'PENDING' && 'Your documents are being reviewed. This usually takes 1-2 business days.'}
                {status?.status === 'APPROVED' && `Verified on ${status?.verifiedAt ? new Date(status.verifiedAt).toLocaleDateString() : 'N/A'}`}
                {status?.status === 'REJECTED' && (status?.rejectionReason || 'Your submission was rejected. Please resubmit.')}
                {status?.status === 'NOT_SUBMITTED' && 'Submit your business documents to get verified.'}
              </p>
            </div>
          </div>
        </Card>

        {status?.status !== 'APPROVED' && status?.status !== 'PENDING' && (
          <Card>
            <h2 className="text-lg font-bold text-[var(--warm-ink)] font-headline mb-4">Submit Documents</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[var(--warm-ink)] block mb-2">Document Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {DOCUMENT_TYPES.map(dt => (
                    <button
                      key={dt.value}
                      onClick={() => setDocType(dt.value)}
                      className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-colors ${
                        docType === dt.value ? 'border-[var(--clay)] bg-[var(--clay)]/5 text-[var(--clay)]' : 'border-[rgba(191,179,163,0.2)] text-[var(--soft-stone)] hover:border-[var(--clay)]/30'
                      }`}
                    >
                      <span>{dt.icon}</span>
                      {dt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-[var(--warm-ink)] block mb-2">Document</label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-[rgba(191,179,163,0.3)] cursor-pointer hover:border-[var(--clay)]/40 transition-colors">
                    <Upload size={18} className="text-[var(--soft-stone)]" />
                    <span className="text-sm text-[var(--soft-stone)]">Upload file or paste URL</span>
                    <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
                <input
                  type="text"
                  value={docUrl.startsWith('data:') ? '' : docUrl}
                  onChange={e => setDocUrl(e.target.value)}
                  placeholder="Or paste document URL..."
                  className="mt-2 w-full px-3 py-2 rounded-xl border border-[rgba(191,179,163,0.3)] bg-white/50 text-sm text-[var(--warm-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--clay)]/30"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[var(--warm-ink)] block mb-2">Document Name (optional)</label>
                <input
                  type="text"
                  value={docName}
                  onChange={e => setDocName(e.target.value)}
                  placeholder="e.g. Business License 2024"
                  className="w-full px-3 py-2 rounded-xl border border-[rgba(191,179,163,0.3)] bg-white/50 text-sm text-[var(--warm-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--clay)]/30"
                />
              </div>

              <Button onClick={handleSubmit} disabled={submitting || !docUrl} className="w-full">
                {submitting ? 'Submitting...' : 'Submit for Verification'}
              </Button>
            </div>
          </Card>
        )}

        {status && status.documents.length > 0 && (
          <Card>
            <h2 className="text-lg font-bold text-[var(--warm-ink)] font-headline mb-4">Submitted Documents</h2>
            <div className="space-y-2">
              {status.documents.map(doc => (
                <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/40 border border-[rgba(191,179,163,0.1)]">
                  <FileText size={16} className="text-[var(--soft-stone)]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--warm-ink)] truncate">{doc.fileName}</p>
                    <p className="text-xs text-[var(--soft-stone)]">{doc.category} • {new Date(doc.uploadedAt).toLocaleDateString()}</p>
                  </div>
                  {doc.verified ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-[var(--sage)]">
                      <Check size={12} /> Verified
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--soft-stone)]">Pending</span>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card>
          <div className="flex items-start gap-3">
            <Shield size={18} className="text-[var(--sage)] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-[var(--warm-ink)]">Why verify?</p>
              <p className="text-xs text-[var(--soft-stone)] mt-1">
                Verified businesses get a trust badge, higher search ranking, and customer confidence. Verification typically takes 1-2 business days.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
