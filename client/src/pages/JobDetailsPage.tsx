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
  
  // Application State
  const [showModal, setShowModal] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [resumeUrl, setResumeUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      jobsService.getJobDetails(id)
        .then(data => {
          setJob(data);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setError('Job not found or no longer available.');
          setLoading(false);
        });
    }
  }, [id]);

  const handleApplyClick = () => {
    if (!isAuthenticated) {
      setShowModal(true);
    } else {
      // Reveal inline application form by scrolling to it or just handling it directly
      document.getElementById('apply-form')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleAuthRedirect = () => {
    // Redirect to backend Google OAuth route with returnTo
    window.location.href = `/api/v1/auth/google?role=freelancer&returnTo=/jobs/${id}`;
  };

  const submitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setIsSubmitting(true);
    try {
      await jobsService.applyForJob(id, resumeUrl);
      setHasApplied(true);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to apply');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 bg-indigo-200 rounded-full mb-4"></div>
          <div className="h-4 w-48 bg-indigo-200 rounded mb-2"></div>
          <div className="h-3 w-32 bg-indigo-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl text-center max-w-md w-full">
          <h2 className="text-2xl font-semibold text-slate-800 mb-2">Unavailable</h2>
          <p className="text-slate-500">{error}</p>
          <button onClick={() => navigate('/')} className="mt-6 text-indigo-600 hover:text-indigo-700 font-medium">
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Header Glass Card */}
        <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] p-8 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 relative overflow-hidden">
          {/* Trust Badge Top Right */}
          <div className="absolute top-0 right-0 bg-gradient-to-bl from-green-100 to-emerald-50 text-emerald-700 px-6 py-3 rounded-bl-3xl flex items-center space-x-2 shadow-sm">
            <ShieldCheck className="w-5 h-5" />
            <span className="font-semibold text-sm">Payment Guaranteed</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-4">
            {job.title}
          </h1>
          <p className="text-lg text-slate-600 mt-2 font-medium">{job.companyName}</p>
          
          <div className="flex flex-wrap items-center gap-4 mt-6 text-slate-600 text-sm font-medium">
            <div className="flex items-center gap-1.5 bg-slate-100/80 px-3 py-1.5 rounded-full">
              <MapPin className="w-4 h-4 text-indigo-500" /> {job.location} {job.remote && '(Remote)'}
            </div>
            <div className="flex items-center gap-1.5 bg-slate-100/80 px-3 py-1.5 rounded-full">
              <Briefcase className="w-4 h-4 text-indigo-500" /> {job.employmentType}
            </div>
            {job.salaryMin && (
              <div className="flex items-center gap-1.5 bg-green-50 px-3 py-1.5 rounded-full text-green-700">
                <DollarSign className="w-4 h-4" /> ${(job.salaryMin/1000).toFixed(0)}k - ${(job.salaryMax/1000).toFixed(0)}k
              </div>
            )}
          </div>
        </div>

        {/* Content & Apply Section */}
        {hasApplied ? (
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-[2rem] p-10 text-center border border-emerald-100 shadow-lg transform transition-all duration-500">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Application Submitted!</h3>
            <p className="text-slate-600 mb-8 max-w-md mx-auto">
              The client has received your profile. Stand out by completing your Pabandi Trust Passport while you wait.
            </p>
            <button onClick={() => navigate('/dashboard')} className="bg-emerald-600 text-white px-8 py-3.5 rounded-full font-semibold hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-200">
              Go to Dashboard
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 bg-white/60 backdrop-blur-lg rounded-[2rem] p-8 shadow-sm border border-white">
              <h3 className="text-xl font-bold text-slate-900 mb-4">About the Role</h3>
              <div className="prose prose-indigo prose-lg text-slate-600 leading-relaxed whitespace-pre-wrap">
                {job.description}
              </div>
            </div>

            <div className="md:col-span-1">
              <div className="sticky top-8 bg-indigo-600 rounded-[2rem] p-8 text-white shadow-xl shadow-indigo-200">
                <h3 className="text-xl font-bold mb-2">Ready to apply?</h3>
                <p className="text-indigo-100 text-sm mb-6">
                  {isAuthenticated ? "Complete your application below." : "Sign in to securely submit your profile."}
                </p>
                
                {isAuthenticated ? (
                  <form id="apply-form" onSubmit={submitApplication} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-indigo-100 mb-1">Portfolio / Resume Link</label>
                      <input 
                        type="url" 
                        required
                        value={resumeUrl}
                        onChange={e => setResumeUrl(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-indigo-700 border border-indigo-500 text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-white"
                        placeholder="https://"
                      />
                    </div>
                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="w-full bg-white text-indigo-600 font-bold py-3.5 rounded-xl hover:bg-indigo-50 transition-colors flex justify-center items-center gap-2 shadow-lg"
                    >
                      {isSubmitting ? 'Sending...' : 'Submit Profile'}
                      {!isSubmitting && <ChevronRight className="w-4 h-4" />}
                    </button>
                  </form>
                ) : (
                  <button 
                    onClick={handleApplyClick}
                    className="w-full bg-white text-indigo-600 font-bold py-3.5 rounded-xl hover:bg-indigo-50 transition-colors flex justify-center items-center gap-2 shadow-lg"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-opacity">
          <div className="bg-white w-full max-w-md rounded-[2rem] p-8 shadow-2xl transform transition-all relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-50 rounded-full blur-2xl"></div>
            
            <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center mb-6 relative z-10">
              <Lock className="w-6 h-6 text-indigo-600" />
            </div>
            
            <h3 className="text-2xl font-bold text-slate-900 mb-2 relative z-10">Secure Application</h3>
            <p className="text-slate-600 mb-8 relative z-10">
              To protect our clients and freelancers from spam, we require applicants to verify their identity via Pabandi. 
            </p>

            <button 
              onClick={handleAuthRedirect}
              className="w-full bg-slate-900 text-white font-semibold py-4 rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-3 relative z-10"
            >
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
              Continue with Google
            </button>
            
            <button 
              onClick={() => setShowModal(false)}
              className="w-full mt-4 text-slate-500 font-medium hover:text-slate-700 py-2 relative z-10"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
