import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { PageTransition } from '../components/PageTransition';
import { ErrorBoundary } from '../components/ErrorBoundary';

const modules = [
  { id: 'contact', title: 'ContactOS', desc: 'CRM & Pipeline', path: '/contact', icon: 'contacts', color: 'var(--clay)' },
  { id: 'booking', title: 'BookingOS', desc: 'Schedules & Services', path: '/property', icon: 'book_online', color: 'var(--sage)' },
  { id: 'freight', title: 'FreightOS', desc: 'Logistics & Dispatch', path: '/freight', icon: 'local_shipping', color: 'var(--muted-ochre)' },
  { id: 'capital', title: 'CapitalOS', desc: 'Finance & Invoices', path: '/capital', icon: 'account_balance', color: 'var(--dusty-rose)' },
];

export default function DashboardPage() {
  const { user } = useAuthStore();
  
  return (
    <ErrorBoundary>
      <PageTransition>
        <div className="max-w-6xl mx-auto p-6 lg:p-10 space-y-8">
          
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-[var(--warm-ink)] font-headline tracking-tight">
                Welcome back, {user?.name?.split(' ')[0] || 'User'}
              </h1>
              <p className="text-[var(--soft-stone)] mt-1 font-medium">
                Here is what is happening across your business today.
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-2xl shadow-sm border border-[rgba(191,179,163,0.2)]">
                <span className="material-symbols-outlined text-[var(--sage)]">verified</span>
                <span className="font-semibold text-[var(--warm-ink)] text-sm">Trust Score: 98</span>
              </div>
              <Link to="/wallet" className="flex items-center gap-2 px-4 py-2 bg-[rgba(201,123,90,0.1)] rounded-2xl border border-[rgba(201,123,90,0.2)] hover:bg-[rgba(201,123,90,0.15)] transition-colors">
                <span className="material-symbols-outlined text-[var(--terracotta)]">account_balance_wallet</span>
                <span className="font-semibold text-[var(--terracotta)] text-sm">$0.00</span>
              </Link>
            </div>
          </header>

          <section>
            <h2 className="text-sm font-bold text-[var(--soft-stone)] uppercase tracking-wider mb-4">Enabled Modules</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {modules.map((mod, i) => (
                <motion.div
                  key={mod.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    to={mod.path}
                    className="group block p-5 bg-white rounded-3xl shadow-sm border border-[rgba(191,179,163,0.2)] hover:shadow-md hover:border-[rgba(191,179,163,0.4)] transition-all"
                  >
                    <div 
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white mb-4 shadow-sm"
                      style={{ backgroundColor: mod.color }}
                    >
                      <span className="material-symbols-outlined">{mod.icon}</span>
                    </div>
                    <h3 className="font-bold text-[var(--warm-ink)] text-lg group-hover:text-[var(--clay)] transition-colors">
                      {mod.title}
                    </h3>
                    <p className="text-[var(--soft-stone)] text-sm mt-1">
                      {mod.desc}
                    </p>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold text-[var(--soft-stone)] uppercase tracking-wider mb-4">Recent Activity</h2>
            <div className="bg-white rounded-3xl shadow-sm border border-[rgba(191,179,163,0.2)] p-10 text-center">
              <span className="material-symbols-outlined text-[48px] text-[rgba(191,179,163,0.3)] mb-4">inbox</span>
              <h3 className="text-lg font-bold text-[var(--warm-ink)]">No recent activity</h3>
              <p className="text-[var(--soft-stone)] max-w-sm mx-auto mt-2 text-sm">
                Activities from your enabled modules will appear here as you work.
              </p>
            </div>
          </section>

        </div>
      </PageTransition>
    </ErrorBoundary>
  );
}
