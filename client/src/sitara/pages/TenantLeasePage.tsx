// Sitara OS — Tenant Lease Page with PAB Deposit Status
// Shows lease details with PAB deposit escrow status and interest

import { useEffect, useState } from 'react';
import { sitaraApi } from '../api/sitaraApi';

function pick(obj: any, keys: string[], fallback = '—'): string {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== '') return String(v);
  }
  return fallback;
}

function fmtDate(v: any): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

const FALLBACK = {
  property: 'Oak Tower Apartments',
  unit: '2A',
  start: 'July 1, 2026',
  end: 'June 30, 2027',
  rent: '$1,850',
  deposit: '$1,850 (held in escrow)',
  status: 'Active',
};

export default function TenantLeasePage() {
  const [lease, setLease] = useState<any>(null);
  const [depositInfo, setDepositInfo] = useState<any>(null);

  useEffect(() => {
    sitaraApi
      .tenantDashboard()
      .then((d: any) => setLease(d?.leases?.[0] || null))
      .catch(() => {});
  }, []);

  const view = lease
    ? {
        property: pick(lease, ['propertyName', 'property', 'buildingName'], FALLBACK.property),
        unit: pick(lease, ['unitNumber', 'unit', 'unitId'], FALLBACK.unit),
        start: fmtDate(lease.startDate || lease.leaseStart),
        end: fmtDate(lease.endDate || lease.leaseEnd),
        rent: `$${pick(lease, ['rentAmount', 'monthlyRent'], '1,850')}`,
        deposit: `$${pick(lease, ['depositAmount', 'deposit'], '1,850')} (held in escrow)`,
        status: pick(lease, ['status'], FALLBACK.status),
      }
    : FALLBACK;

  // Mock deposit info (in production, fetch from /api/v1/lease-pab/deposit/:leaseId)
  useEffect(() => {
    setDepositInfo({
      depositAmount: 1850,
      interestRate: 0.02,
      heldDays: 45,
      currentInterest: 4.56,
      totalValue: 1854.56,
      status: 'HELD',
    });
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-3xl font-bold text-slate-900">My Lease</h1>
        {lease && (
          <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-medium">✓ Live</span>
        )}
      </div>
      <p className="text-slate-600 mb-8">Your lease agreement details</p>

      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-slate-900">Lease Agreement</h3>
          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium capitalize">
            {view.status}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-slate-500 mb-1">Property</p>
            <p className="font-medium">{view.property}</p>
          </div>
          <div>
            <p className="text-slate-500 mb-1">Unit</p>
            <p className="font-medium">{view.unit}</p>
          </div>
          <div>
            <p className="text-slate-500 mb-1">Lease Start</p>
            <p className="font-medium">{view.start}</p>
          </div>
          <div>
            <p className="text-slate-500 mb-1">Lease End</p>
            <p className="font-medium">{view.end}</p>
          </div>
          <div>
            <p className="text-slate-500 mb-1">Monthly Rent</p>
            <p className="font-medium">{view.rent}</p>
          </div>
          <div>
            <p className="text-slate-500 mb-1">Security Deposit</p>
            <p className="font-medium">{view.deposit}</p>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-200">
          <button className="px-4 py-2 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600">
            Download Lease PDF
          </button>
        </div>
      </div>

      {/* PAB Deposit Status Card */}
      {depositInfo && (
        <div className="mt-6 bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🪙</span>
            <h3 className="font-semibold text-slate-900">PAB Deposit Status</h3>
            <span className="px-2 py-0.5 bg-violet-100 text-violet-800 rounded-full text-xs font-medium">
              {depositInfo.status}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Deposit Amount</p>
              <p className="font-medium text-slate-900">{depositInfo.depositAmount} PAB</p>
            </div>
            <div>
              <p className="text-slate-500">Interest Rate</p>
              <p className="font-medium text-emerald-600">{(depositInfo.interestRate * 100).toFixed(0)}% APY</p>
            </div>
            <div>
              <p className="text-slate-500">Interest Earned</p>
              <p className="font-medium text-emerald-600">+{depositInfo.currentInterest.toFixed(2)} PAB</p>
            </div>
            <div>
              <p className="text-slate-500">Total Value</p>
              <p className="font-bold text-slate-900">{depositInfo.totalValue.toFixed(2)} PAB</p>
            </div>
          </div>

          <div className="mt-4 p-3 bg-white/60 rounded-lg">
            <p className="text-xs text-slate-600">
              <strong>On lease end:</strong> Full deposit returned in PAB + 2% APY interest.
              <strong className="text-red-600"> Early termination:</strong> 50% of deposit slashed.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
