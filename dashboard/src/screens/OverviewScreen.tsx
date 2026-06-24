import React from 'react';
import { Shield, TrendingUp, AlertTriangle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const mockData = [
  { name: 'Mon', blocked: 4, safe: 120 },
  { name: 'Tue', blocked: 7, safe: 132 },
  { name: 'Wed', blocked: 2, safe: 101 },
  { name: 'Thu', blocked: 12, safe: 145 },
  { name: 'Fri', blocked: 9, safe: 180 },
  { name: 'Sat', blocked: 15, safe: 210 },
  { name: 'Sun', blocked: 11, safe: 190 },
];

export default function OverviewScreen() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-100 mb-2">Merchant Overview</h2>
          <p className="text-slate-400">Your Zero-Knowledge protection stats for the last 7 days.</p>
        </div>
        <div className="flex gap-2">
          <span className="px-3 py-1 bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded-full text-sm font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></span>
            Network Online
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Metric 1 */}
        <div className="glass-panel p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Shield size={64} />
          </div>
          <p className="text-slate-400 text-sm font-medium mb-1">Protected Revenue</p>
          <h3 className="text-4xl font-bold text-slate-100 mb-2">$4,250</h3>
          <p className="text-sm text-brand-400 flex items-center gap-1">
            <ArrowUpRight size={16} />
            +14% from last week
          </p>
        </div>

        {/* Metric 2 */}
        <div className="glass-panel p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <AlertTriangle size={64} />
          </div>
          <p className="text-slate-400 text-sm font-medium mb-1">High-Risk Orders Blocked</p>
          <h3 className="text-4xl font-bold text-slate-100 mb-2">60</h3>
          <p className="text-sm text-brand-400 flex items-center gap-1">
            <ArrowDownRight size={16} />
            100% false positive prevention
          </p>
        </div>

        {/* Metric 3 */}
        <div className="glass-panel p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <TrendingUp size={64} />
          </div>
          <p className="text-slate-400 text-sm font-medium mb-1">Bloom Filter Bypass</p>
          <h3 className="text-4xl font-bold text-slate-100 mb-2">94.2%</h3>
          <p className="text-sm text-slate-400 flex items-center gap-1">
            Approvals skipped network check
          </p>
        </div>

      </div>

      {/* Chart */}
      <div className="glass-panel p-6 mt-8">
        <h3 className="text-xl font-bold mb-6">Traffic Analysis</h3>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={mockData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSafe" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorBlocked" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="name" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
                itemStyle={{ color: '#f1f5f9' }}
              />
              <Area type="monotone" dataKey="safe" stroke="#14b8a6" fillOpacity={1} fill="url(#colorSafe)" name="Safe Orders" />
              <Area type="monotone" dataKey="blocked" stroke="#ef4444" fillOpacity={1} fill="url(#colorBlocked)" name="Blocked Risks" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
