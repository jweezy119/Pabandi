import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShieldCheck, MapPin, Briefcase, DollarSign, CheckCircle2, ChevronRight, Lock } from 'lucide-react';
import { jobsService } from '../services/jobs.service';
import { useAuthStore } from '../store/authStore';

export default function JobDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [resumeUrl, setResumeUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      jobsService.getJobDetails(id)
        .then(data => { setJob(data); setLoading(false); })
        .catch(err => { console.error(err); setError('Job not found or no longer available.'); setLoading(false); });
    }
  }, [id]);

  const handleApplyClick = () => {
    if (!isAuthenticated) { setShowModal(true); }
    else { document.getElementById('apply-form')?.scrollIntoView({ behavior: 'smooth' }); }
  };

  const handleAuthRedirect = () => {
    window.location.href = `/api/v1/auth/google?role=freelancer&returnTo=/jobs/${id}`;
  };

  const submitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setIsSubmitting(true);
    try { await jobsService.applyForJob(id, resumeUrl); setHasApplied(true); }
    catch (err: any) { alert(err.response?.data?.error || 'Failed to apply'); }
    finally { setIsSubmitting(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--cream)' }}>
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 rounded-full mb-4" style={{ background: 'var(--warm-sand)' }}></div>
          <div className="h-4 w-48 rounded mb-2" style={{ background: 'var(--warm-sand)' }}></div>
          <div className="h-3 w-32 rounded" style={{ background: 'var(--warm-sand)' }}></div>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--cream)' }}>
        <div className="bg-white p-8 rounded-3xl shadow-xl text-center max-w-md w-full">
          <h2 className="text-2xl font-semibold mb-2" style={{ color: 'var(--warm-ink)' }}>Unavailable</h2>
          <p style={{ color: 'var(--soft-stone)' }}>{error}</p>
          <button onClick={() => navigate('/')} className="mt-6 font-medium" style={{ color: 'var(--clay)' }}>
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8" style={{ background: 'var(--cream)' }}>
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Header Card */}
        <div className="rounded-[2rem] p-8 sm:p-10 relative overflow-hidden bg-white" style={{ boxShadow: 'var(--shadow-soft)' }}>
          <div className="absolute top-0 right-0 px-6 py-3 rounded-bl-3xl flex items-center space-x-2" style={{ background: 'var(--sage)' }}>
            <ShieldCheck className="w-5 h-5 text-white" />
            <span className="font-semibold text-sm text-white">Payment Guaranteed</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-4" style={{ color: 'var(--warm-ink)' }}>
            {job.title}
          </h1>
          <p className="text-lg mt-2 font-medium" style={{ color: 'var(--soft-stone)' }}>{job.companyName}</p>
          
          <div className="flex flex-wrap items-center gap-4 mt-6 text-sm font-medium" style={{ color: 'var(--soft-stone)' }}>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: 'var(--warm-sand)' }}>
              <MapPin className="w-4 h-4" style={{ color: 'var(--clay)' }} /> {job.location} {job.remote && '(Remote)'}
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: 'var(--warm-sand)' }}>
              <Briefcase className="w-4 h-4" style={{ color: 'var(--clay)' }} /> {job.employmentType}
            </div>
            {job.salaryMin && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: 'var(--sage)', color: 'white' }}>
                <DollarSign className="w-4 h-4" /> ${(job.salaryMin/1000).toFixed(0)}k - ${(job.salaryMax/1000).toFixed(0)}k
              </div>
            )}
          </div>
        </div>

        {/* Content & Apply Section */}
        {hasApplied ? (
          <div className="rounded-[2rem] p-10 text-center" style={{ background: 'var(--warm-sand)' }}>
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: 'var(--sage)' }}>
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold mb-2" style={{ color: 'var(--warm-ink)' }}>Application Submitted!</h3>
            <p className="mb-8 max-w-md mx-auto" style={{ color: 'var(--soft-stone)' }}>
              The client has received your profile. Stand out by completing your Pabandi Trust Passport while you wait.
            </p>
            <button onClick={() => navigate('/dashboard')} className="px-8 py-3.5 rounded-full font-semibold text-white" style={{ background: 'var(--clay)' }}>
              Go to Dashboard
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 rounded-[2rem] p-8 bg-white" style={{ boxShadow: 'var(--shadow-soft)' }}>
              <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--warm-ink)' }}>About the Role</h3>
              <div className="prose leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--soft-stone)' }}>
                {job.description}
              </div>
            </div>

            <div className="md:col-span-1">
              <div className="sticky top-8 rounded-[2rem] p-8 text-white" style={{ background: 'var(--clay)', boxShadow: 'var(--shadow-lift)' }}>
                <h3 className="text-xl font-bold mb-2">Ready to apply?</h3>
                <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  {isAuthenticated ? "Complete your application below." : "Sign in to securely submit your profile."}
                </p>
                
                {isAuthenticated ? (
                  <form id="apply-form" onSubmit={submitApplication} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.8)' }}>Portfolio / Resume Link</label>
                      <input 
                        type="url" 
                        required
                        value={resumeUrl}
                        onChange={e => setResumeUrl(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white"
                        style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}
                        placeholder="https://"
                      />
                    </div>
                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="w-full font-bold py-3.5 rounded-xl flex justify-center items-center gap-2 text-white"
                      style={{ background: 'var(--terracotta)' }}
                    >
                      {isSubmitting ? 'Sending...' : 'Submit Profile'}
                      {!isSubmitting && <ChevronRight className="w-4 h-4" />}
                    </button>
                  </form>
                ) : (
                  <button 
                    onClick={handleApplyClick}
                    className="w-full font-bold py-3.5 rounded-xl flex justify-center items-center gap-2"
                    style={{ background: 'white', color: 'var(--clay)' }}
                  >
                    Apply Now <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Trust Login Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(42,37,32,0.3)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white w-full max-w-md rounded-[2rem] p-8 relative overflow-hidden" style={{ boxShadow: 'var(--shadow-lift)' }}>
            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl" style={{ background: 'var(--warm-sand)' }}></div>
            
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 relative z-10" style={{ background: 'var(--warm-sand)' }}>
              <Lock className="w-6 h-6" style={{ color: 'var(--clay)' }} />
            </div>
            
            <h3 className="text-2xl font-bold mb-2 relative z-10" style={{ color: 'var(--warm-ink)' }}>Secure Application</h3>
            <p className="mb-8 relative z-10" style={{ color: 'var(--soft-stone)' }}>
              To protect our clients and freelancers from spam, we require applicants to verify their identity via Pabandi. 
            </p>

            <button 
              onClick={handleAuthRedirect}
              className="w-full font-semibold py-4 rounded-xl flex items-center justify-center gap-3 relative z-10"
              style={{ background: 'var(--warm-sand)', color: 'var(--warm-ink)' }}
            >
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
              Continue with Google
            </button>
            
            <button 
              onClick={() => setShowModal(false)}
              className="w-full mt-4 font-medium py-2 relative z-10"
              style={{ color: 'var(--soft-stone)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
