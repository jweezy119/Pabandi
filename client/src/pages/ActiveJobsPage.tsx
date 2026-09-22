import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, ChevronRight, Clock, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { Link } from 'react-router-dom';

interface Job {
  id: string;
  businessId: string;
  business: { name: string };
  status: string;
  depositPaid: boolean;
  depositAmount: number;
  reservationDate: string;
  createdAt: string;
}

const ActiveJobsPage: React.FC = () => {
  const { user } = useAuthStore();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        // Fetch all reservations where user is customer (or freelancer acting as provider if schema differs)
        const [res, gigsRes] = await Promise.all([
          api.get('/reservations/user').catch(() => ({ data: [] })),
          api.get('/gigs').catch(() => ({ data: { data: [] } })),
        ]);

        const activeEscrowJobs = (res.data || []).filter((r: Job) => 
          r.depositPaid === true && 
          ['PENDING', 'CHECKED_IN', 'IN_PROGRESS'].includes(r.status)
        );

        const openGigs = (gigsRes.data?.data || gigsRes.data?.gigs || []).map((g: any) => ({
          id: g.gigId || g.id,
          businessId: g.gigId || g.id,
          business: { name: g.title },
          status: g.status || 'OPEN',
          depositPaid: true,
          depositAmount: g.budgetUsd || 0,
          reservationDate: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          isGig: true,
        }));

        setJobs([...activeEscrowJobs, ...openGigs]);
      } catch (err) {
        console.error('Failed to fetch jobs', err);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchJobs();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--warm-sand)] flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--clay)]"></div>
        <p className="text-gray-400 mt-4 font-mono text-sm uppercase tracking-widest">Loading Workspace...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--warm-sand)] text-[var(--warm-ink)] selection:bg-[var(--clay)]/30">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        {/* Header */}
        <div className="mb-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 mb-2"
          >
            <div className="h-10 w-10 rounded-xl bg-[rgba(var(--clay),0.15)] flex items-center justify-center border border-[rgba(var(--clay),0.3)]">
              <Briefcase className="w-5 h-5 text-[var(--clay)]" />
            </div>
            <h1 className="text-3xl font-bold bg-[var(--clay)] bg-clip-text text-transparent">
              Active Workspace
            </h1>
          </motion.div>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-gray-400 max-w-2xl"
          >
            Manage your funded freelance jobs. All funds listed here are securely locked in Pabandi Escrow and guaranteed upon completion.
          </motion.p>
        </div>

        {/* Job List */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          {jobs.length > 0 ? (
            jobs.map((job: any) => (
              <Link to={job.isGig ? `/gigs/${job.id}` : `/workspace/${job.id}`} key={job.id}>
                <div className="bg-[var(--warm-sand)]/50 backdrop-blur-xl border border-[var(--soft-stone)] rounded-2xl p-6 hover:bg-[var(--warm-sand)]/60 transition-all group cursor-pointer relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--clay)]/5 rounded-full blur-2xl group-hover:bg-[rgba(var(--clay),0.1)] transition-colors" />
                  
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[rgba(var(--sage),0.1)] text-[var(--sage)] border border-[rgba(var(--sage),0.2)] flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> Escrow Funded
                        </span>
                        {job.status === 'CHECKED_IN' && (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[rgba(var(--muted-ochre),0.1)] text-[var(--muted-ochre)] border border-[rgba(var(--muted-ochre),0.2)]">
                            Pending Client Approval
                          </span>
                        )}
                        {job.status === 'PENDING' && (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[rgba(var(--sky-wash),0.1)] text-[var(--sky-wash)] border border-[rgba(var(--sky-wash),0.2)]">
                            In Progress
                          </span>
                        )}
                      </div>
                      <h3 className="text-xl font-bold text-[var(--warm-ink)] mb-1">Project for {job.business?.name || 'Client'}</h3>
                      <p className="text-sm text-gray-500 flex items-center gap-2">
                        <Clock className="w-4 h-4" /> Started {new Date(job.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm text-gray-400 font-medium">Locked Value</p>
                        <p className="text-2xl font-bold text-[var(--warm-ink)]">${job.depositAmount?.toFixed(2)}</p>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-[var(--warm-sand)] flex items-center justify-center group-hover:bg-[var(--clay)] transition-colors">
                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-[var(--warm-ink)] transition-colors" />
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="bg-[var(--warm-sand)]/30 border border-[var(--soft-stone)] border-dashed rounded-2xl p-16 flex flex-col items-center justify-center text-center">
              <div className="h-16 w-16 bg-[var(--warm-sand)]/50 rounded-full flex items-center justify-center mb-4">
                <Briefcase className="w-8 h-8 text-gray-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-300 mb-2">No Active Escrow Jobs</h3>
              <p className="text-gray-500 max-w-sm">
                You don't have any actively funded projects right now. Share your Trust Passport to win more bids!
              </p>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default ActiveJobsPage;
