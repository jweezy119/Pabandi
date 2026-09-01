import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Surface, Badge, tokens } from '../design-system';
import { propertyManagerService } from '../services/api';

export const RentRollPage: React.FC = () => {
  const [properties, setProperties] = useState<any[]>([]);
  const [financials, setFinancials] = useState<any[]>([]);
  const [leases, setLeases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const dashRes = await propertyManagerService.dashboard();
      const dash = dashRes.data?.data;
      setProperties(dash?.properties || []);
      setLeases(dash?.leases || []);

      // Load financials for each property
      const finPromises = (dash?.properties || []).map(async (p: any) => {
        try {
          const res = await propertyManagerService.financials(p.id);
          const records = res.data?.data || [];
          const income = records.filter((r: any) => r.type === 'INCOME').reduce((s: number, r: any) => s + r.amount, 0);
          const expenses = records.filter((r: any) => r.type === 'EXPENSE').reduce((s: number, r: any) => s + r.amount, 0);
          return { propertyId: p.id, income, expenses, noi: income - expenses, records };
        } catch {
          return { propertyId: p.id, income: 0, expenses: 0, noi: 0, records: [] };
        }
      });
      const finResults = await Promise.all(finPromises);
      setFinancials(finResults);
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Aggregate totals
  const totalIncome = financials.reduce((s, f) => s + (f.income || 0), 0);
  const totalExpenses = financials.reduce((s, f) => s + (f.expenses || 0), 0);
  const totalNOI = totalIncome - totalExpenses;
  const occupiedUnits = properties.filter(p => p.status === 'OCCUPIED').length;
  const totalUnits = properties.length;
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

  if (loading) return <div className="min-h-screen p-8" style={{ background: tokens.color.background, color: 'white' }}>Loading...</div>;

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-100">📊 Rent Roll</h1>
            <p className="text-sm" style={{ color: tokens.color.muted }}>Financial overview across all properties</p>
          </div>
          <Link to="/property-manager" className="text-sm text-indigo-300 hover:text-indigo-200">← Back to CRM</Link>
        </div>

        {err && <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: tokens.color.danger + '15', color: tokens.color.danger }}>{err}</div>}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <Surface className="text-center">
            <div className="text-xs mb-1" style={{ color: tokens.color.muted }}>Total Income</div>
            <div className="text-xl font-bold text-emerald-300">${totalIncome.toLocaleString()}</div>
          </Surface>
          <Surface className="text-center">
            <div className="text-xs mb-1" style={{ color: tokens.color.muted }}>Total Expenses</div>
            <div className="text-xl font-bold text-rose-300">${totalExpenses.toLocaleString()}</div>
          </Surface>
          <Surface className="text-center">
            <div className="text-xs mb-1" style={{ color: tokens.color.muted }}>Net Operating Income</div>
            <div className="text-xl font-bold text-indigo-300">${totalNOI.toLocaleString()}</div>
          </Surface>
          <Surface className="text-center">
            <div className="text-xs mb-1" style={{ color: tokens.color.muted }}>Occupancy</div>
            <div className="text-xl font-bold text-slate-100">{occupancyRate}%</div>
            <div className="text-xs" style={{ color: tokens.color.muted }}>{occupiedUnits}/{totalUnits} units</div>
          </Surface>
          <Surface className="text-center">
            <div className="text-xs mb-1" style={{ color: tokens.color.muted }}>Active Leases</div>
            <div className="text-xl font-bold text-slate-100">{leases.filter(l => l.status === 'ACTIVE').length}</div>
          </Surface>
        </div>

        {/* Property Breakdown */}
        <h2 className="text-lg font-bold text-slate-100 mb-3">By Property</h2>
        {properties.length === 0 ? (
          <p className="text-center py-8" style={{ color: tokens.color.muted }}>No properties yet. Add a property to see rent roll data.</p>
        ) : (
          <div className="space-y-3">
            {properties.map((p) => {
              const fin = financials.find(f => f.propertyId === p.id) || { income: 0, expenses: 0, noi: 0 };
              const propertyLeases = leases.filter(l => l.propertyId === p.id);
              return (
                <Surface key={p.id}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-bold text-slate-100">{p.title}</div>
                      <div className="text-xs" style={{ color: tokens.color.muted }}>{p.address}{p.city ? `, ${p.city}` : ''} · {p.bedrooms}bd/{p.bathrooms}ba</div>
                    </div>
                    <Badge tone={p.status === 'VACANT' ? 'info' : p.status === 'OCCUPIED' ? 'success' : 'warning'}>{p.status}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-2 rounded-lg bg-white/5">
                      <div className="text-xs" style={{ color: tokens.color.muted }}>Income</div>
                      <div className="font-bold text-emerald-300">${(fin.income || 0).toLocaleString()}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-white/5">
                      <div className="text-xs" style={{ color: tokens.color.muted }}>Expenses</div>
                      <div className="font-bold text-rose-300">${(fin.expenses || 0).toLocaleString()}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-white/5">
                      <div className="text-xs" style={{ color: tokens.color.muted }}>NOI</div>
                      <div className="font-bold text-indigo-300">${(fin.noi || 0).toLocaleString()}</div>
                    </div>
                  </div>
                  {propertyLeases.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <div className="text-xs mb-2" style={{ color: tokens.color.muted }}>Active Leases</div>
                      <div className="space-y-1">
                        {propertyLeases.map((l: any) => (
                          <div key={l.id} className="flex items-center justify-between text-xs">
                            <span className="text-slate-300">{l.tenantName || l.tenantEmail}</span>
                            <span className="text-emerald-300">${l.rentAmount}/{l.rentPeriod === 'MONTH' ? 'mo' : 'wk'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Surface>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default RentRollPage;
