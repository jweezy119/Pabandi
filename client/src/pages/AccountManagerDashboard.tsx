import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { accountManagerService } from '../services/api';
import { 
  CurrencyDollarIcon, 
  UsersIcon, 
  BuildingOfficeIcon, 
  ChartBarIcon,
  ClipboardDocumentCheckIcon
} from '@heroicons/react/24/outline';

export default function AccountManagerDashboard() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [summaryRes, refRes, ledRes] = await Promise.all([
        accountManagerService.getSummary(),
        accountManagerService.getReferrals(),
        accountManagerService.getLedger()
      ]);
      setSummary(summaryRes.data.data.summary);
      setReferrals(refRes.data.data.referrals);
      setLedger(ledRes.data.data.ledger);
    } catch (err: any) {
      if (err.response?.status === 404) {
        // Not an account manager yet
        setSummary(null);
      } else {
        setError('Failed to load dashboard data.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCode = async () => {
    try {
      setGenerating(true);
      await accountManagerService.generateCode();
      await fetchData();
    } catch (err) {
      setError('Failed to generate referral code.');
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Not registered as an AM
  if (!summary) {
    return (
      <div className="min-h-screen bg-surface p-6 sm:p-12 flex flex-col items-center">
        <div className="max-w-2xl w-full bg-surface-container-lowest border border-outline-variant/30 p-8 rounded-3xl shadow-sm text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          <h1 className="text-3xl font-black text-on-surface font-headline mb-4 relative z-10">
            Pabandi Growth Partners
          </h1>
          <p className="text-on-surface-variant mb-8 relative z-10">
            Join the elite network of Account Managers. Refer businesses, track their growth, and earn lifetime commissions on their bookings.
          </p>
          <button
            onClick={handleGenerateCode}
            disabled={generating}
            className="px-8 py-4 bg-primary text-on-primary font-bold rounded-xl shadow-lg hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-70 relative z-10"
          >
            {generating ? 'Activating...' : 'Activate Partner Account'}
          </button>
        </div>
      </div>
    );
  }

  const referralLink = `${window.location.origin}/register?role=business&ref=${summary.referralCode}`;

  return (
    <div className="min-h-screen bg-surface p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-48 h-48 bg-tertiary/10 rounded-full blur-3xl pointer-events-none -ml-10 -mt-10" />
          <div className="relative z-10">
            <h1 className="text-2xl sm:text-3xl font-black text-on-surface font-headline">
              Partner Dashboard
            </h1>
            <p className="text-sm text-on-surface-variant font-medium mt-1">
              Welcome back, {user?.firstName}. Track your growth and earnings.
            </p>
          </div>
          
          <div className="relative z-10 w-full sm:w-auto bg-surface-container rounded-2xl p-4 border border-outline-variant/30 flex items-center gap-4">
            <div>
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Your Referral Link</p>
              <p className="text-sm font-mono text-primary font-medium truncate max-w-[200px] sm:max-w-xs">
                {referralLink}
              </p>
            </div>
            <button
              onClick={() => copyToClipboard(referralLink)}
              className="p-2 hover:bg-surface-container-highest rounded-lg transition-colors text-primary"
              title="Copy Link"
            >
              <ClipboardDocumentCheckIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-error-container text-on-error-container rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            title="Total Earned"
            value={`$${summary.totalCommissionEarned.toFixed(2)}`}
            icon={<CurrencyDollarIcon className="w-6 h-6 text-green-500" />}
            trend="+Lifetime"
          />
          <StatCard
            title="Escrow Vol."
            value={`$${(summary.totalBookingsDriven * 5).toFixed(2)}`}
            icon={<ChartBarIcon className="w-6 h-6 text-purple-500" />}
            trend="Secured"
          />
          <StatCard
            title="Pending Payouts"
            value={`$${summary.pendingPayouts.toFixed(2)}`}
            icon={<ChartBarIcon className="w-6 h-6 text-tertiary" />}
          />
          <StatCard
            title="Active Businesses"
            value={summary.activeBusinesses}
            icon={<BuildingOfficeIcon className="w-6 h-6 text-primary" />}
          />
          <StatCard
            title="Total Bookings"
            value={summary.totalBookingsDriven}
            icon={<UsersIcon className="w-6 h-6 text-secondary" />}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Referred Businesses */}
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6">
            <h2 className="text-xl font-bold text-on-surface mb-6 font-headline">Referred Businesses & Lead Scoring</h2>
            {referrals.length === 0 ? (
              <p className="text-sm text-on-surface-variant text-center py-8">No businesses referred yet.</p>
            ) : (
              <div className="space-y-4">
                {referrals.map((business, i) => {
                  const leadScore = Math.min(100, Math.floor(Math.random() * 40) + 60); // Mock Lead Score
                  const scoreColor = leadScore >= 85 ? 'text-green-500 bg-green-500/10' : leadScore >= 70 ? 'text-yellow-500 bg-yellow-500/10' : 'text-red-500 bg-red-500/10';
                  
                  return (
                    <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-surface-container-low border border-outline-variant/20">
                      <div>
                        <p className="font-bold text-on-surface text-sm">{business.name}</p>
                        <div className="flex gap-2 mt-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                            {business.isVerified ? 'Verified' : 'Pending'}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-tertiary/10 text-tertiary">
                            {business._count.reservations} Bookings
                          </span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${scoreColor}`}>
                            Lead Score: {leadScore}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end">
                         <div className="h-1 w-16 bg-surface-container-highest rounded-full overflow-hidden mt-1">
                            <div className="h-full bg-primary" style={{ width: `${leadScore}%` }} />
                         </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Ledger History */}
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6">
            <h2 className="text-xl font-bold text-on-surface mb-6 font-headline">Recent Earnings</h2>
            {ledger.length === 0 ? (
              <p className="text-sm text-on-surface-variant text-center py-8">No earnings recorded yet.</p>
            ) : (
              <div className="space-y-4">
                {ledger.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-surface-container-low border border-outline-variant/20">
                    <div>
                      <p className="font-bold text-on-surface text-sm capitalize">
                        {entry.transactionType.replace(/_/g, ' ').toLowerCase()}
                      </p>
                      <p className="text-xs text-on-surface-variant mt-1">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold text-sm ${entry.amount > 0 ? 'text-green-500' : 'text-on-surface'}`}>
                        {entry.amount > 0 ? '+' : ''}${Math.abs(entry.amount).toFixed(2)}
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mt-1">
                        {entry.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

function StatCard({ title, value, icon, trend }: { title: string, value: string | number, icon: React.ReactNode, trend?: string }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 relative overflow-hidden group hover:border-primary/50 transition-colors">
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-surface-container-low rounded-full transition-transform group-hover:scale-110" />
      <div className="relative z-10 flex justify-between items-start mb-4">
        <div className="p-3 bg-surface-container rounded-2xl">
          {icon}
        </div>
        {trend && (
          <span className="text-xs font-bold text-green-500 bg-green-500/10 px-2 py-1 rounded-lg">
            {trend}
          </span>
        )}
      </div>
      <div className="relative z-10">
        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">{title}</p>
        <p className="text-2xl font-black text-on-surface font-headline">{value}</p>
      </div>
    </div>
  );
}
