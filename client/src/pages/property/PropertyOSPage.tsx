import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../services/api';
import { getAuthToken } from '../../utils/authToken';
import { HalalBanner, HalalBadge } from '../../components/halal';

const navItems = [
  { path: '/property', label: 'Dashboard', icon: 'dashboard', end: true },
  { path: '/property/tenants', label: 'Tenants', icon: 'people' },
  { path: '/property/leases', label: 'Leases', icon: 'description' },
  { path: '/property/maintenance', label: 'Maintenance', icon: 'build' },
  { path: '/property/financials', label: 'Financials', icon: 'bar_chart' },
];

export default function PropertyOSPage() {
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [operatingMode, setOperatingMode] = useState<'leases' | 'agent_stays'>('leases');
  const [summary, setSummary] = useState<any>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [topProperties, setTopProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<any[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [clientSearch, setClientSearch] = useState('');

  useEffect(() => { loadData(); }, [period]);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://api.pabandi.com'}/api/v1/crm/clients`, {
          headers: { Authorization: `Bearer ${getAuthToken()}` },
        });
        if (res.ok) {
          const data = await res.json();
          setClients(data.data || []);
        }
      } catch (e) { console.error(e); } finally { setLoadingClients(false); }
    };
    fetchClients();
  }, []);

  const filteredClients = clients.filter(c => 
    c.name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.email?.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const loadData = async () => {
    try {
      const [summaryRes, dashRes, propsRes] = await Promise.all([
        api.get(`/property-manager/financials/summary?period=${period}`).catch(() => ({ data: { data: null } })),
        api.get('/property-manager/dashboard').catch(() => ({ data: { data: null } })),
        api.get('/property-manager/properties').catch(() => ({ data: { data: [] } })),
      ]);
      setSummary(summaryRes.data?.data);
      setDashboardData(dashRes.data?.data);
      setTopProperties(propsRes.data?.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const leases = dashboardData?.leases || [];
  const tenants = dashboardData?.tenants || [];
  const stats = dashboardData?.stats || {};
  const maintenance = dashboardData?.maintenance || [];

  return (
    <DashboardLayout osName="PropertyOS" osIcon="H" osColor="violet" navItems={navItems}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[var(--warm-ink)]">PropertyOS</h1>
            <p className="text-sm text-[var(--soft-stone)]">End-to-end management for residential leases, short-stays, and AI agent bookings</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/property/maintenance" className="px-3.5 py-2 rounded-xl bg-[var(--warm-sand)] hover:bg-[var(--warm-sand)]/80 text-[var(--warm-ink)] text-xs font-semibold border border-[rgba(191,179,163,0.4)] transition flex items-center gap-1.5">
              <span>🔧 Contractor Dispatch</span>
              {stats.openMaintenance > 0 && (
                <span className="w-5 h-5 rounded-full bg-[var(--terracotta)] text-white text-[10px] font-bold flex items-center justify-center">
                  {stats.openMaintenance}
                </span>
              )}
            </Link>
            <Link to="/property/tenants" className="px-4 py-2 rounded-xl bg-[var(--clay)] hover:bg-[var(--terracotta)] text-[var(--warm-ink)] text-xs font-bold shadow-sm transition">
              + Add Tenant / Lease
            </Link>
          </div>
        </div>

        <HalalBanner compact />

        {/* Operating Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-[var(--warm-sand)]/70 border border-[rgba(191,179,163,0.35)]">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--soft-stone)]">Properties &amp; Units</p>
            <p className="text-2xl font-black text-[var(--warm-ink)] mt-1">{topProperties.length}</p>
            <p className="text-[11px] text-[var(--soft-stone)] mt-0.5">{stats.occupied || 0} occupied • {stats.vacant || 0} vacant</p>
          </div>
          <div className="p-4 rounded-2xl bg-[var(--warm-sand)]/70 border border-[rgba(191,179,163,0.35)]">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--soft-stone)]">Active Leases</p>
            <p className="text-2xl font-black text-[var(--warm-ink)] mt-1">{stats.activeLeases || leases.length || 0}</p>
            <p className="text-[11px] text-[var(--soft-stone)] mt-0.5">{tenants.length} screened tenants</p>
          </div>
          <div className="p-4 rounded-2xl bg-[var(--warm-sand)]/70 border border-[rgba(191,179,163,0.35)]">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--soft-stone)]">Escrow Deposits Held</p>
            <p className="text-2xl font-black text-[var(--sage)] mt-1">
              ${(stats.totalDepositHeld || leases.reduce((s: number, l: any) => s + (l.depositAmount || 0), 0)).toLocaleString()}
            </p>
            <div className="mt-1 flex items-center gap-1 text-[11px] text-[var(--soft-stone)]">
              <span>🔒 Solana Escrow</span>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-[var(--warm-sand)]/70 border border-[rgba(191,179,163,0.35)]">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--soft-stone)]">Monthly Rent Roll</p>
            <p className="text-2xl font-black text-[var(--warm-ink)] mt-1">
              ${leases.filter((l: any) => l.status === 'ACTIVE').reduce((s: number, l: any) => s + (l.monthlyRent || 0), 0).toLocaleString()}
            </p>
            <div className="mt-1 flex items-center gap-1">
              <HalalBadge size="sm" />
            </div>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[rgba(191,179,163,0.3)] pb-2">
          <div className="flex gap-2">
            <button
              onClick={() => setOperatingMode('leases')}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition flex items-center gap-2 ${
                operatingMode === 'leases'
                  ? 'bg-[var(--clay)] text-[var(--warm-ink)] shadow-sm'
                  : 'bg-[var(--warm-sand)]/60 text-[var(--soft-stone)] hover:bg-[var(--warm-sand)]'
              }`}
            >
              <span>📄 Long-Term Leases &amp; Rent Roll</span>
              <span className="px-1.5 py-0.5 rounded-full bg-white/40 text-[10px]">{leases.length}</span>
            </button>
            <button
              onClick={() => setOperatingMode('agent_stays')}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition flex items-center gap-2 ${
                operatingMode === 'agent_stays'
                  ? 'bg-[var(--clay)] text-[var(--warm-ink)] shadow-sm'
                  : 'bg-[var(--warm-sand)]/60 text-[var(--soft-stone)] hover:bg-[var(--warm-sand)]'
              }`}
            >
              <span>🤖 Short-Stays &amp; AI Agent Bookings</span>
              <span className="px-1.5 py-0.5 rounded-full bg-[var(--sage)]/30 text-[10px] font-bold">cNFT Verified</span>
            </button>
          </div>

          <div className="flex gap-1.5 self-end">
            {(['week', 'month', 'year'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition ${
                  period === p ? 'bg-[var(--warm-ink)] text-[var(--cream)]' : 'bg-[var(--warm-sand)] text-[var(--soft-stone)] hover:bg-[var(--warm-sand)]/80'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* TAB 1: Long-Term Leases & Rent Roll */}
        {operatingMode === 'leases' && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-[var(--cream)] border border-[rgba(191,179,163,0.35)] overflow-hidden shadow-sm">
              <div className="p-4 border-b border-[rgba(191,179,163,0.25)] flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-[var(--warm-ink)]">Active Rent Roll &amp; Lease Agreements</h2>
                  <p className="text-xs text-[var(--soft-stone)]">Sharia-structured leases with automated grace-period compliance</p>
                </div>
                <Link to="/property/leases" className="text-xs font-bold text-[var(--terracotta)] hover:underline">
                  Manage Leases →
                </Link>
              </div>

              {loading ? (
                <div className="p-8 text-center text-[var(--soft-stone)]">Loading rent roll...</div>
              ) : leases.length === 0 ? (
                <div className="p-8 text-center text-[var(--soft-stone)] space-y-2">
                  <p className="text-3xl">📝</p>
                  <p className="font-medium text-[var(--warm-ink)]">No active leases yet</p>
                  <p className="text-xs">Create your first lease or invite an existing tenant to start collecting rent in escrow.</p>
                  <Link to="/property/leases" className="inline-block mt-2 px-4 py-1.5 rounded-xl bg-[var(--clay)] text-[var(--warm-ink)] text-xs font-bold">
                    Create New Lease
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-[rgba(191,179,163,0.2)]">
                  {leases.map((lease: any) => {
                    const daysLeft = Math.ceil((new Date(lease.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={lease.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-[var(--warm-sand)]/40 transition">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-sm text-[var(--warm-ink)]">
                              {lease.property?.title || 'Residential Unit'} {lease.unit?.unitNumber ? `— Unit ${lease.unit.unitNumber}` : ''}
                            </p>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--sage)]/20 text-[var(--warm-ink)]">
                              {lease.leaseType || 'IJARA LEASE'}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              lease.status === 'ACTIVE' ? 'bg-[var(--sage)]/25 text-[var(--warm-ink)]' : 'bg-[var(--warm-sand)] text-[var(--soft-stone)]'
                            }`}>
                              {lease.status}
                            </span>
                          </div>
                          <p className="text-xs text-[var(--soft-stone)] mt-0.5">
                            Tenant: <span className="font-semibold text-[var(--warm-ink)]">{lease.tenantName || lease.tenantEmail}</span> • Next Due: 1st of month (5-day grace period)
                          </p>
                          <p className="text-[11px] text-[var(--soft-stone)] mt-0.5">
                            Term: {new Date(lease.startDate).toLocaleDateString()} to {new Date(lease.endDate).toLocaleDateString()} ({daysLeft > 0 ? `${daysLeft} days remaining` : 'Matured'})
                          </p>
                        </div>

                        <div className="flex items-center gap-4 self-end md:self-center">
                          <div className="text-right">
                            <p className="text-base font-black text-[var(--warm-ink)]">${Number(lease.monthlyRent || 0).toLocaleString()}<span className="text-xs font-normal text-[var(--soft-stone)]">/mo</span></p>
                            <p className="text-[10px] text-[var(--sage)] font-semibold">Deposit: ${Number(lease.depositAmount || 0).toLocaleString()} (In Escrow)</p>
                          </div>
                          <Link
                            to={`/property/leases`}
                            className="px-3 py-1.5 rounded-xl border border-[rgba(191,179,163,0.5)] hover:border-[var(--clay)] text-xs font-bold text-[var(--warm-ink)] bg-white transition"
                          >
                            View Details
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Short-Stays & AI Agent Bookings (A2A / cNFT) */}
        {operatingMode === 'agent_stays' && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-[var(--cream)] border border-[rgba(191,179,163,0.35)] overflow-hidden shadow-sm">
              <div className="p-4 border-b border-[rgba(191,179,163,0.25)] flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-[var(--warm-ink)]">Autonomous AI Agent Bookings &amp; Short-Stays</h2>
                    <span className="px-2 py-0.5 rounded-full bg-[var(--sage)]/25 text-[var(--warm-ink)] text-[10px] font-bold">
                      MCP Agent-to-Agent Enabled
                    </span>
                  </div>
                  <p className="text-xs text-[var(--soft-stone)]">
                    External AI agents book stays autonomously via <code className="text-xs bg-[var(--warm-sand)] px-1 rounded">pabandi_book_property</code> with instant Solana escrow and cNFT passes
                  </p>
                </div>
              </div>

              {/* Sample / Live Agent Bookings Feed */}
              <div className="divide-y divide-[rgba(191,179,163,0.2)]">
                {tenants.filter((t: any) => t.status === 'APPLIED' || t.status === 'ACTIVE').length === 0 ? (
                  <div className="p-8 text-center text-[var(--soft-stone)] space-y-2">
                    <p className="text-3xl">🤖</p>
                    <p className="font-medium text-[var(--warm-ink)]">Ready for AI Agent Bookings</p>
                    <p className="text-xs max-w-md mx-auto">
                      Any AI agent running on Claude Code, Cursor, or MCP clients can query your properties using <code className="bg-[var(--warm-sand)] px-1 rounded">pabandi_list_properties</code> and book instantly with protected escrow.
                    </p>
                  </div>
                ) : (
                  tenants.map((t: any) => (
                    <div key={t.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-[var(--warm-sand)]/40 transition">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-[var(--clay)]/20 text-[var(--warm-ink)] flex items-center justify-center text-xs font-bold">
                            🤖
                          </span>
                          <p className="font-bold text-sm text-[var(--warm-ink)]">{t.firstName} {t.lastName || ''}</p>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--sage)]/25 text-[var(--warm-ink)]">
                            cNFT Minted
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--warm-sand)] text-[var(--warm-ink)]">
                            {t.status}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--soft-stone)]">
                          Agent ID: <span className="font-mono text-[11px] text-[var(--warm-ink)]">{t.email}</span> • Risk Band: <span className="font-bold text-[var(--sage)]">{t.riskBand || 'LOW_RISK'}</span>
                        </p>
                        <p className="text-[11px] text-[var(--soft-stone)]">
                          Security Escrow: <span className="font-bold text-[var(--warm-ink)]">${Number(t.depositHeld || 0).toLocaleString()} USDC</span> locked in UniversalEscrow
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.4)] text-[11px] font-semibold text-[var(--warm-ink)]">
                            <span>⚡ Solana Pay Verified</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Properties Overview */}
        <div className="rounded-2xl bg-[var(--cream)] border border-[rgba(191,179,163,0.35)] overflow-hidden shadow-sm">
          <div className="p-4 border-b border-[rgba(191,179,163,0.25)] flex items-center justify-between">
            <h2 className="text-base font-bold text-[var(--warm-ink)]">Properties &amp; Units Portfolio</h2>
            <span className="text-xs font-semibold text-[var(--soft-stone)]">{topProperties.length} Registered</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-[var(--soft-stone)]">Loading properties...</div>
          ) : topProperties.length === 0 ? (
            <div className="p-8 text-center text-[var(--soft-stone)]">
              <p className="text-3xl mb-2">🏠</p>
              <p className="font-medium text-[var(--warm-ink)]">No properties listed</p>
              <p className="text-xs mt-1">Add your properties to publish them to both human tenants and AI booking agents.</p>
            </div>
          ) : (
            <div className="divide-y divide-[rgba(191,179,163,0.2)]">
              {topProperties.map((prop: any) => (
                <div key={prop.id} className="p-4 flex items-center justify-between hover:bg-[var(--warm-sand)]/40 transition">
                  <div>
                    <p className="text-[var(--warm-ink)] font-bold text-sm">{prop.unitNumber || prop.title || prop.name}</p>
                    <p className="text-xs text-[var(--soft-stone)] mt-0.5">
                      ${Number(prop.rentAmount || 0).toLocaleString()}/month • {prop.city || 'Downtown'} • {prop.status}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-[var(--clay)]/20 text-[var(--warm-ink)] font-bold text-xs">
                      {prop.status}
                    </span>
                    <HalalBadge size="sm" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Shared ContactOS Clients */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-bold text-[var(--warm-ink)]">Shared CRM Clients &amp; Tenants</h2>
              <p className="text-xs text-[var(--soft-stone)]">Synced across ContactOS and PropertyOS</p>
            </div>
            <Link to="/contact/clients" className="text-xs font-bold text-[var(--terracotta)] hover:underline">View all →</Link>
          </div>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search clients and tenants..."
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              className="w-full px-4 py-2 rounded-xl text-sm focus:outline-none"
              style={{ background: 'var(--warm-sand)', border: '1px solid rgba(191,179,163,0.4)', color: 'var(--warm-ink)' }}
            />
          </div>
          {loadingClients ? (
            <div className="p-8 text-center text-[var(--soft-stone)]">Loading clients...</div>
          ) : filteredClients.length === 0 ? (
            <div className="p-6 text-center text-[var(--soft-stone)] rounded-2xl bg-[var(--warm-sand)]/40 border border-[rgba(191,179,163,0.3)]">
              <p className="text-xs">{clientSearch ? 'No matching clients.' : 'No clients yet. Add your first client in ContactOS.'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredClients.slice(0, 6).map((client: any) => (
                <Link key={client.id} to={`/contact/clients/${client.id}`} className="block">
                  <div className="p-3.5 rounded-xl bg-[var(--cream)] border border-[rgba(191,179,163,0.3)] hover:border-[var(--clay)] transition">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--warm-sand)', color: 'var(--warm-ink)' }}>
                        {client.name?.charAt(0) || 'C'}
                      </div>
                      <div className="overflow-hidden">
                        <p className="font-semibold text-sm text-[var(--warm-ink)] truncate">{client.name}</p>
                        <p className="text-xs text-[var(--soft-stone)] truncate">{client.email || 'No email'}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <footer className="pt-6 border-t border-[rgba(191,179,163,0.3)] text-center">
          <p className="text-xs text-[var(--soft-stone)]">
            Powered by <Link to="/" className="text-[var(--terracotta)] font-bold transition">Pabandi</Link> — The Global Trust Layer · Sharia-Compliant Leases &amp; Autonomous Agent Bookings
          </p>
        </footer>
      </div>
    </DashboardLayout>
  );
}
