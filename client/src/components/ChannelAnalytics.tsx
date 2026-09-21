import React, { useState, useEffect, useCallback } from 'react';

type Channel = 'WHATSAPP' | 'TELEGRAM' | 'SMS';

interface ChannelStats {
  total: number;
  sent: number;
  delivered: number;
  failed: number;
  pending: number;
  cost: number;
}

interface ChannelAnalyticsProps {
  businessId: string;
}

const CHANNEL_COLORS: Record<Channel, { bg: string; text: string }> = {
  WHATSAPP: { bg: 'bg-green-500', text: 'text-green-600' },
  TELEGRAM: { bg: 'bg-blue-500', text: 'text-blue-600' },
  SMS: { bg: 'bg-yellow-500', text: 'text-yellow-600' },
};

export const ChannelAnalytics: React.FC<ChannelAnalyticsProps> = ({ businessId }) => {
  const [stats, setStats] = useState<Record<Channel, ChannelStats> | null>(null);
  const [, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateRange.start) params.set('startDate', dateRange.start);
      if (dateRange.end) params.set('endDate', dateRange.end);
      const res = await fetch(`/api/v1/channels/${businessId}/stats?${params}`);
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    } finally {
      setLoading(false);
    }
  }, [businessId, dateRange]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const totalMessages = stats
    ? Object.values(stats).reduce((sum, s) => sum + s.total, 0)
    : 0;
  const totalCost = stats
    ? Object.values(stats).reduce((sum, s) => sum + s.cost, 0)
    : 0;
  const avgDeliveryRate = stats
    ? Object.values(stats).reduce((sum, s) => sum + (s.sent > 0 ? (s.delivered / s.sent) * 100 : 0), 0) / 3
    : 0;

  return (
    <div className="space-y-6">
      {/* Date range filter */}
      <div className="flex items-center gap-4">
        <div>
          <label className="text-xs text-gray-500">Start Date</label>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange(r => ({ ...r, start: e.target.value }))}
            className="ml-2 px-2 py-1 border rounded text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">End Date</label>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange(r => ({ ...r, end: e.target.value }))}
            className="ml-2 px-2 py-1 border rounded text-sm"
          />
        </div>
        <button
          onClick={fetchStats}
          className="px-4 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
        >
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Total Messages</p>
          <p className="text-2xl font-bold">{totalMessages}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Total Cost (PKR)</p>
          <p className="text-2xl font-bold">₨ {totalCost.toFixed(0)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Avg Delivery Rate</p>
          <p className="text-2xl font-bold">{avgDeliveryRate.toFixed(1)}%</p>
        </div>
      </div>

      {/* Channel breakdown */}
      {stats && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">Channel</th>
                <th className="text-right p-3">Total</th>
                <th className="text-right p-3">Sent</th>
                <th className="text-right p-3">Delivered</th>
                <th className="text-right p-3">Failed</th>
                <th className="text-right p-3">Rate</th>
                <th className="text-right p-3">Cost (PKR)</th>
              </tr>
            </thead>
            <tbody>
              {(Object.entries(stats) as [Channel, ChannelStats][]).map(([channel, s]) => (
                <tr key={channel} className="border-t">
                  <td className="p-3">
                    <span className={`inline-block w-3 h-3 rounded-full ${CHANNEL_COLORS[channel].bg} mr-2`}></span>
                    <span className={CHANNEL_COLORS[channel].text}>{channel}</span>
                  </td>
                  <td className="text-right p-3">{s.total}</td>
                  <td className="text-right p-3">{s.sent}</td>
                  <td className="text-right p-3 text-green-600">{s.delivered}</td>
                  <td className="text-right p-3 text-red-600">{s.failed}</td>
                  <td className="text-right p-3">
                    {s.sent > 0 ? `${((s.delivered / s.sent) * 100).toFixed(0)}%` : '-'}
                  </td>
                  <td className="text-right p-3">₨ {s.cost.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Visual bar chart */}
      {stats && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Messages by Channel</h3>
          <div className="space-y-3">
            {(Object.entries(stats) as [Channel, ChannelStats][]).map(([channel, s]) => (
              <div key={channel} className="flex items-center gap-3">
                <span className="w-20 text-xs text-gray-600">{channel}</span>
                <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden flex">
                  <div
                    className={`h-full ${CHANNEL_COLORS[channel].bg} opacity-30`}
                    style={{ width: `${totalMessages > 0 ? (s.sent / totalMessages) * 100 : 0}%` }}
                  ></div>
                  <div
                    className={`h-full ${CHANNEL_COLORS[channel].bg}`}
                    style={{ width: `${totalMessages > 0 ? (s.delivered / totalMessages) * 100 : 0}%` }}
                  ></div>
                </div>
                <span className="w-12 text-right text-xs text-gray-500">{s.total}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 text-xs text-gray-500 flex gap-4">
            <span><span className="inline-block w-3 h-3 bg-gray-300 mr-1"></span> Sent</span>
            <span><span className={`inline-block w-3 h-3 ${CHANNEL_COLORS.TELEGRAM.bg} mr-1`}></span> Delivered</span>
          </div>
        </div>
      )}

      {/* Best time to send */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">🕐 Best Time to Send</h3>
        <p className="text-xs text-gray-500 mb-3">Based on customer engagement patterns</p>
        <p className="text-sm text-gray-600">
          Send messages between <strong>6-9 PM Pakistan Time</strong> for highest response rates.
          WhatsApp and Telegram have the best engagement during these hours.
        </p>
      </div>
    </div>
  );
};

export default ChannelAnalytics;
