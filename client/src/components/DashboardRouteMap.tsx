import React, { useState, useEffect } from 'react';
import { useBusinessSettings } from '../hooks/useBusinessSettings';
import apiClient from '../services/api';
import { Surface, tokens } from '../design-system';

interface JobWithLocation {
  id: string;
  serviceType: string;
  scheduledDate: string;
  status: string;
  booking?: {
    clientLat?: number;
    clientLng?: number;
    clientAddress?: string;
    distanceMiles?: number;
    driveMinutes?: number;
  };
  client?: {
    name: string;
    address?: string;
  };
}

export function DashboardRouteMap() {
  const { settings } = useBusinessSettings();
  const [jobs, setJobs] = useState<JobWithLocation[]>([]);
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'today' | 'week' | 'all'>('today');

  useEffect(() => {
    loadJobs();
  }, [viewMode]);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const businessId = localStorage.getItem('businessId');
      if (!businessId) return;

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      let startDate = startOfDay.toISOString();
      let endDate = endOfDay.toISOString();

      if (viewMode === 'week') {
        const weekEnd = new Date(startOfDay);
        weekEnd.setDate(weekEnd.getDate() + 7);
        endDate = weekEnd.toISOString();
      } else if (viewMode === 'all') {
        startDate = '2020-01-01';
        endDate = '2030-01-01';
      }

      const res = await apiClient.get(
        `/api/v1/crm/jobs?businessId=${localStorage.getItem('businessId')}&startDate=${startDate}&endDate=${endDate}&includeBooking=true`
      );

      if (res.data.success) {
        setJobs(res.data.data || []);
      }
    } catch (e) {
      console.error('Failed to load jobs for map', e);
    } finally {
      setLoading(false);
    }
  };

  const generateMap = async () => {
    if (jobs.length === 0) return;
    setError(null);
    try {
      const markers = jobs
        .filter(j => j.booking?.clientLat && j.booking?.clientLng)
        .map((j, i) => ({
          lat: j.booking!.clientLat!,
          lng: j.booking!.clientLng!,
          color: getStatusColor(j.status),
          icon: 'work',
          label: `${i + 1}`,
        }));

      if (markers.length === 0) {
        setError('No jobs with location data');
        return;
      }

      // Calculate center from all markers
      const avgLat = markers.reduce((sum, m) => sum + m.lat, 0) / markers.length;
      const avgLng = markers.reduce((sum, m) => sum + m.lng, 0) / markers.length;

      const res = await apiClient.post('/api/v1/checkin/job/map/batch', {
        markers: markers.map(m => ({ lat: m.lat, lng: m.lng, color: m.color })),
        center: { lat: avgLat, lng: avgLng },
      });

      if (res.data.success) {
        setMapUrl(res.data.data.mapUrl);
      }
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to generate map');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED': return '3B82F6';
      case 'IN_PROGRESS': return 'F59E0B';
      case 'COMPLETED': return '10B981';
      case 'CANCELLED': return 'EF4444';
      default: return '6B7280';
    }
  };

  const jobsWithLocation = jobs.filter(j => j.booking?.clientLat && j.booking?.clientLng).length;

  return (
    <Surface className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-[var(--warm-ink)] flex items-center gap-2">
          <span className="material-symbols-outlined text-[var(--clay)]">route</span>
          Today's Route
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--soft-stone)]">
            {jobsWithLocation} of {jobs.length} jobs mapped
          </span>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {(['today', 'week', 'all'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              viewMode === mode
                ? 'bg-[var(--clay)] text-white'
                : 'bg-[var(--warm-sand)] text-[var(--soft-stone)] hover:bg-[var(--warm-sand)]'
            }`}
          >
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-[var(--terracotta)]/10 border border-[var(--terracotta)]/20 text-[var(--terracotta)] text-sm">
          {error}
        </div>
      )}

      <div className="relative rounded-xl overflow-hidden border border-[rgba(191,179,163,0.3)] bg-[var(--warm-sand)] min-h-[300px]">
        {jobsWithLocation === 0 ? (
          <div className="w-full h-64 flex flex-col items-center justify-center text-[var(--soft-stone)]">
            <span className="material-symbols-outlined text-[48px] mb-2 opacity-50">location_off</span>
            <p>No jobs with location data for this period</p>
            <p className="text-sm mt-1">Jobs need client addresses to appear on map</p>
          </div>
        ) : (
          <>
            <img
              src={`https://maps.geoapify.com/v1/staticmap?apiKey=${import.meta.env.VITE_GEOAPIFY_KEY || ''}&center=lonlat:0,0&zoom=10&width=600&height=300&format=png`}
              alt="Route map"
              className="w-full h-64 object-cover"
            />
            <div className="absolute bottom-4 left-4 right-4">
              <div className="bg-white/95 backdrop-blur-sm rounded-lg p-3">
                <p className="text-sm font-semibold text-[var(--warm-ink)]">Route Overview</p>
                <p className="text-xs text-[var(--soft-stone)] mt-1">{jobsWithLocation} stops · Estimated route</p>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
        <h3 className="font-semibold text-[var(--warm-ink)]">Stops</h3>
        {jobs.slice(0, 10).map((job, i) => (
          <div
            key={job.id}
            className="flex items-center gap-3 p-3 rounded-lg bg-[var(--warm-sand)]/50 border border-[rgba(191,179,163,0.2)]"
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: getStatusColor(job.status) }}>
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-[var(--warm-ink)] truncate">{job.serviceType}</p>
              <p className="text-xs text-[var(--soft-stone)]">
                {job.booking?.clientAddress || job.client?.address || 'No address'}
              </p>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-[var(--clay)]/10 text-[var(--clay)]">
              {job.status}
            </span>
          </div>
        ))}
      </div>
    </Surface>
  );
}

export default DashboardRouteMap;