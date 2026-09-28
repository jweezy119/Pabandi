import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { ReportWidgetGrid } from './components/ReportWidgetGrid';
import { DateRangePicker } from './components/DateRangePicker';



const API_BASE = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
const getHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` });

export function ContactAnalyticsPage() {
  const businessId = localStorage.getItem('businessId') || '';
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [datePreset, setDatePreset] = useState('30d');
  const [dateRange, setDateRange] = useState<{ start?: string, end?: string }>({});

  useEffect(() => {
    // Initial date range for 30d
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    setDateRange({ start: start.toISOString(), end: end.toISOString() });
  }, []);

  useEffect(() => {
    if (businessId && (dateRange.start || datePreset === 'all')) {
      loadData();
    }
  }, [businessId, dateRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      const query = `businessId=${businessId}${dateRange.start ? `&startDate=${dateRange.start}&endDate=${dateRange.end}` : ''}`;
      
      const [pipeline, revenue, expenses, clientHealth, trust, activity] = await Promise.all([
        fetch(`${API_BASE}/api/v1/reports/pipeline?${query}`, { headers: getHeaders() }).then(r => r.json()),
        fetch(`${API_BASE}/api/v1/reports/revenue?${query}`, { headers: getHeaders() }).then(r => r.json()),
        fetch(`${API_BASE}/api/v1/reports/expenses?${query}`, { headers: getHeaders() }).then(r => r.json()),
        fetch(`${API_BASE}/api/v1/reports/client-health?${query}`, { headers: getHeaders() }).then(r => r.json()),
        fetch(`${API_BASE}/api/v1/reports/trust?${query}`, { headers: getHeaders() }).then(r => r.json()),
        fetch(`${API_BASE}/api/v1/reports/activities?${query}`, { headers: getHeaders() }).then(r => r.json()),
      ]);

      setData({ pipeline, revenue, expenses, clientHealth, trust, activity });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (preset: string, start?: string, end?: string) => {
    setDatePreset(preset);
    setDateRange({ start, end });
  };

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" >
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 clay-heading pb-2">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Analytics Dashboard</h1>
            <p className="text-sm text-[var(--soft-stone)] mt-0.5">Key metrics and reports for your business</p>
          </div>
          <DateRangePicker value={datePreset} onChange={handleDateChange} />
        </div>

        <ReportWidgetGrid data={data} loading={loading} />
      </div>
    </DashboardLayout>
  );
}

// Alias for ContactReportsPage since it was requested as two different files
export const ContactReportsPage = ContactAnalyticsPage;
