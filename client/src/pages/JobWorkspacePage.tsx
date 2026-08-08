import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { UploadCloud, CheckCircle, Scale, ShieldAlert, ArrowLeft, MessageSquare } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

interface JobDetails {
  id: string;
  business: { name: string };
  status: string;
  depositAmount: number;
  depositPaid: boolean;
  notes: string;
}

const JobWorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  
  const [job, setJob] = useState<JobDetails | null>(null);
  const [deliverables, setDeliverables] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [arbitrating, setArbitrating] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const res = await api.get(`/api/v1/reservations/${id}`);
        setJob(res.data.data.reservation);
      } catch (err) {
        setMessage({ text: 'Failed to load workspace.', type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    if (user && id) fetchJob();
  }, [user, id]);

  const handleSubmitWork = async () => {
    if (!deliverables.trim()) return;
    setSubmitting(true);
    setMessage(null);
    try {
      await api.post(`/api/v1/reservations/${id}/submit-work`, { deliverables });
      setMessage({ text: 'Deliverables submitted. Awaiting client approval.', type: 'success' });
      setJob(prev => prev ? { ...prev, status: 'CHECKED_IN' } : null);
    } catch (err: any) {
      setMessage({ text: err.response?.data?.error || 'Failed to submit.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleArbitration = async () => {
    if (!window.confirm('Are you sure you want to summon the AI Arbitrator? This should only be used if the client is unresponsive or refusing to pay.')) return;
    setArbitrating(true);
    setMessage(null);
    try {
      await api.post(`/api/v1/reservations/${id}/arbitrate`, { reason: 'Client unresponsive after work delivery' });
      setMessage({ text: 'AI Arbitrator summoned. The case is now under review.', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.response?.data?.error || 'Failed to request arbitration.', type: 'error' });
    } finally {
      setArbitrating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!job) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-white selection:bg-indigo-500/30">

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        
        <button 
          onClick={() => navigate('/dashboard/jobs')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8 text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Workspace List
        </button>

        {/* Job Header */}
        <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-8 mb-8 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{job.business?.name || 'Client Project'}</h1>
              <div className="flex items-center gap-3">
                <span className="text-sm px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                  Escrow Locked: ${job.depositAmount?.toFixed(2)}
                </span>
                <span className={`text-sm px-3 py-1 rounded-full border ${job.status === 'CHECKED_IN' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                  {job.status === 'CHECKED_IN' ? 'Pending Approval' : 'In Progress'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Message Banner */}
        {message && (
          <div className={`mb-8 p-4 rounded-xl border flex items-center gap-3 ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Main Action Area */}
          <div className="md:col-span-2 space-y-8">
            <div className="bg-gray-900/30 border border-gray-800 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-indigo-400" /> Submit Deliverables
              </h2>
              <p className="text-sm text-gray-400 mb-4">
                Paste the links to your completed work (e.g., GitHub repo, Figma file, Google Drive) or type your delivery notes here.
              </p>
              
              <textarea
                value={deliverables}
                onChange={(e) => setDeliverables(e.target.value)}
                placeholder="https://github.com/my-repo..."
                rows={6}
                className="w-full bg-gray-950/50 border border-gray-700 rounded-xl p-4 text-white placeholder-gray-600 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all mb-4"
                disabled={job.status === 'CHECKED_IN'}
              />
              
              <button
                onClick={handleSubmitWork}
                disabled={submitting || !deliverables.trim() || job.status === 'CHECKED_IN'}
                className={`px-6 py-3 rounded-xl font-bold transition-all ${submitting || !deliverables.trim() || job.status === 'CHECKED_IN' ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-indigo-500 text-white hover:bg-indigo-400'}`}
              >
                {submitting ? 'Submitting...' : job.status === 'CHECKED_IN' ? 'Already Submitted' : 'Submit for Approval'}
              </button>
            </div>
          </div>

          {/* Sidebar / Arbitration */}
          <div className="space-y-6">
            <div className="bg-red-950/20 border border-red-900/50 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-red-400 mb-2 flex items-center gap-2">
                <Scale className="w-5 h-5" /> AI Arbitrator
              </h3>
              <p className="text-xs text-red-300/70 mb-6">
                If you have submitted your work and the client is ghosting you or refusing to release the escrow funds without cause, summon the AI Arbitrator. It will review the deliverables and release funds automatically.
              </p>
              <button
                onClick={handleArbitration}
                disabled={arbitrating || job.status !== 'CHECKED_IN'}
                className={`w-full py-3 rounded-xl font-bold transition-all border ${arbitrating || job.status !== 'CHECKED_IN' ? 'bg-gray-900/50 text-gray-600 border-gray-800 cursor-not-allowed' : 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'}`}
              >
                {arbitrating ? 'Summoning...' : job.status !== 'CHECKED_IN' ? 'Submit Work First' : 'Summon Arbitrator'}
              </button>
            </div>

            <div className="bg-gray-900/30 border border-gray-800 rounded-2xl p-6">
              <h3 className="text-sm font-bold text-gray-300 mb-4 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-gray-400" /> Recent Notes
              </h3>
              <div className="text-xs text-gray-500 whitespace-pre-wrap font-mono bg-gray-950 p-4 rounded-lg overflow-y-auto max-h-40">
                {job.notes || 'No notes available.'}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default JobWorkspacePage;
