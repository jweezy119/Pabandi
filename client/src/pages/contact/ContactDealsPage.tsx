import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { Link } from 'react-router-dom';

const navItems = [
  { path: '/contact', label: 'Dashboard', icon: 'dashboard', end: true },
  { path: '/contact/clients', label: 'Clients', icon: 'groups' },
  { path: '/contact/deals', label: 'Deals', icon: 'handshake' },
  { path: '/contact/activities', label: 'Activities', icon: 'notifications' },
];

function ClayCard({ children, className = '', hover = true, ...props }: any) {
  return (
    <div
      className={`rounded-[28px] bg-white transition-all duration-300 ${hover ? 'hover:-translate-y-0.5' : ''} ${className}`}
      style={{ boxShadow: 'var(--shadow-soft)' }}
      {...props}
    >
      <div className="p-4">{children}</div>
    </div>
  );
}

const COLUMNS = [
  { id: 'PENDING', label: 'New', color: 'var(--soft-stone)' },
  { id: 'ACCEPTED', label: 'In Progress', color: 'var(--muted-ochre)' },
  { id: 'COMPLETED', label: 'Won', color: 'var(--sage)' },
  { id: 'CANCELLED', label: 'Lost', color: 'var(--terracotta)' },
];

export default function ContactDealsPage() {
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDeals();
  }, []);

  async function fetchDeals() {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm/jobs`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDeals(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch deals:', err);
    } finally {
      setLoading(false);
    }
  }

  const getDealsByStatus = (status: string) => {
    return deals.filter(deal => deal.status === status);
  };

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" navItems={navItems}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold font-headline text-[var(--warm-ink)]">Deals Pipeline</h1>
          <Link to="/contact/jobs/new" className="btn btn-primary">
            <span className="material-symbols-outlined text-[18px] mr-1.5 align-[-3px]" aria-hidden="true">add</span>
            New Deal
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-[var(--soft-stone)]">Loading pipeline...</div>
        ) : deals.length === 0 ? (
          <ClayCard hover={false} className="text-center p-12">
            <span className="material-symbols-outlined text-[48px] text-[var(--clay)] mb-4 block">view_kanban</span>
            <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-2">No Deals Yet</h2>
            <p className="text-[var(--soft-stone)] mb-6 max-w-md mx-auto">
              Track your sales pipeline from lead to closed won. Deals represent active jobs or proposals.
            </p>
            <Link to="/contact/jobs/new" className="btn btn-primary">
              Create Your First Deal
            </Link>
          </ClayCard>
        ) : (
          <div className="flex gap-6 overflow-x-auto pb-6 mobile-scroll">
            {COLUMNS.map(column => {
              const columnDeals = getDealsByStatus(column.id);
              const totalValue = columnDeals.reduce((sum, deal) => sum + (deal.price || 0), 0);
              
              return (
                <div key={column.id} className="min-w-[300px] flex-1 bg-[var(--warm-sand)]/30 rounded-3xl p-4 flex flex-col h-[calc(100vh-220px)] min-h-[500px]">
                  <div className="flex justify-between items-center mb-4 px-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: column.color }}></div>
                      <h3 className="font-bold text-[var(--warm-ink)]">{column.label}</h3>
                      <span className="text-xs bg-[var(--cream)] px-2 py-0.5 rounded-full text-[var(--soft-stone)] font-medium">
                        {columnDeals.length}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-[var(--warm-ink)]">
                      ${totalValue.toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1 no-scrollbar">
                    {columnDeals.map(deal => (
                      <Link key={deal.id} to={`/contact/jobs/${deal.id}`} className="block">
                        <ClayCard hover={true} className="cursor-pointer border border-transparent hover:border-[var(--clay)]/30 !p-3">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold text-[var(--warm-ink)] text-sm line-clamp-1">{deal.serviceType || 'Custom Deal'}</h4>
                            <span className="text-xs font-bold text-[var(--clay)]">${(deal.price || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-[var(--soft-stone)] mb-3">
                            <span className="material-symbols-outlined text-[14px]">person</span>
                            <span className="line-clamp-1">{deal.clientName || 'Unknown Client'}</span>
                          </div>
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--warm-sand)]">
                            <div className="text-[10px] text-[var(--soft-stone)]">
                              {new Date(deal.createdAt).toLocaleDateString()}
                            </div>
                            <div className="w-6 h-6 rounded-full bg-[var(--cream)] flex items-center justify-center text-[var(--warm-ink)] font-bold text-[10px]">
                              {deal.clientName?.charAt(0) || '?'}
                            </div>
                          </div>
                        </ClayCard>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
