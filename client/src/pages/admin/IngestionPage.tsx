import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Surface, Button, Badge, Chip, Stack, tokens } from '../../design-system';
import { useAuthStore } from '../../store/authStore';
import { apiClient, API_HOST } from '../../services/api';

type IngestionSource = 'opendirectories' | 'apify' | 'googlemaps';

interface IngestionJob {
  jobId: string;
  source: string;
  status: 'running' | 'completed' | 'failed' | 'queued';
  processed: number;
  total: number;
  errors: number;
  currentBusiness?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

interface GoogleMapsQuery {
  id: string;
  name: string;
  query: string;
  category?: string;
  geo?: string;
  radius?: number;
  active: boolean;
  lastRun?: string;
  totalFound: number;
  createdAt: string;
  updatedAt: string;
}

export default function IngestionPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [source, setSource] = useState<IngestionSource>('opendirectories');
  const [country, setCountry] = useState('');
  const [state, setState] = useState('');
  const [category, setCategory] = useState('');
  const [limit, setLimit] = useState('50');

  // Google Maps specific fields
  const [gmapQuery, setGmapQuery] = useState('');
  const [gmapGeo, setGmapGeo] = useState('');
  const [gmapRadius, setGmapRadius] = useState('');

  // Saved Google Maps queries
  const [gmapQueries, setGmapQueries] = useState<GoogleMapsQuery[]>([]);
  const [newQueryName, setNewQueryName] = useState('');
  const [newQueryText, setNewQueryText] = useState('');
  const [newQueryCategory, setNewQueryCategory] = useState('');
  const [newQueryGeo, setNewQueryGeo] = useState('');
  const [newQueryRadius, setNewQueryRadius] = useState('');

  const [job, setJob] = useState<IngestionJob | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const SOURCES: Array<{ value: IngestionSource; label: string; description: string }> = [
    {
      value: 'opendirectories',
      label: 'OpenDirectories',
      description: 'Government & public business registry data',
    },
    { value: 'apify', label: 'Apify (Freelancer.com)', description: 'Freelancer profiles from Apify scrapers' },
    {
      value: 'googlemaps',
      label: 'Google Maps',
      description: 'Scrape business listings from Google Maps via Docker container',
    },
  ];

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') {
      navigate('/');
      return;
    }
    fetchGmapQueries();
  }, [user, navigate]);

  const fetchGmapQueries = useCallback(async () => {
    try {
      const res = await apiClient.get('/admin/ingest/google-maps/queries');
      setGmapQueries(res.data.data || []);
    } catch {
      // Ignore errors
    }
  }, []);

  const addLog = useCallback((message: string) => {
    const ts = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${ts}] ${message}`].slice(-100));
  }, []);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.role !== 'ADMIN') return;

    setIsLoading(true);
    setJob(null);
    setLogs([]);
    addLog(`Starting ingestion from ${source}...`);

    try {
      const body: Record<string, any> = { source };

      if (source === 'googlemaps') {
        body.query = gmapQuery;
        body.category = gmapCategory || undefined;
        body.geo = gmapGeo || undefined;
        body.radius = gmapRadius ? parseInt(gmapRadius, 10) : undefined;
        body.limit = parseInt(limit, 10) || 50;
      } else {
        body.country = country || undefined;
        body.state = state || undefined;
        body.category = category || undefined;
        body.limit = parseInt(limit, 10) || 50;
      }

      const res = await apiClient.post('/admin/ingest', body);

      const jobId = res.data.data.jobId;
      addLog(`Ingestion job started: ${jobId}`);
      setJob({ ...res.data.data, status: 'running', processed: 0, total: 0, errors: 0 });

      // Connect to SSE stream for real-time progress
      const es = new EventSource(`${API_HOST}/api/v1/admin/ingest/stream/${jobId}`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data: IngestionJob = JSON.parse(event.data);
          setJob(data);
          if (data.currentBusiness) {
            addLog(`Ingested: ${data.currentBusiness} (${data.processed}/${data.total})`);
          }
          if (data.status === 'completed') {
            addLog(`Ingestion complete: ${data.processed} businesses added`);
            es.close();
            eventSourceRef.current = null;
          } else if (data.status === 'failed') {
            addLog(`Ingestion failed: ${data.error || 'unknown error'}`);
            es.close();
            eventSourceRef.current = null;
          }
        } catch {
          // Ignore parse errors
        }
      };

      es.onerror = () => {
        addLog('Connection to ingestion stream lost');
        es.close();
        eventSourceRef.current = null;
      };
    } catch (err: any) {
      addLog(`Failed to start ingestion: ${err.response?.data?.error || err.message}`);
      setIsLoading(false);
    }
  };

  const handleStartSavedQuery = async (queryId: string) => {
    setIsLoading(true);
    addLog(`Starting saved Google Maps query: ${queryId}...`);

    try {
      const res = await apiClient.post('/admin/ingest/google-maps', { queryId });

      const jobId = res.data.data.jobId;
      addLog(`Ingestion job started: ${jobId}`);
      setJob({ ...res.data.data, status: 'running', processed: 0, total: 0, errors: 0 });

      const es = new EventSource(`${API_HOST}/api/v1/admin/ingest/stream/${jobId}`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data: IngestionJob = JSON.parse(event.data);
          setJob(data);
          if (data.currentBusiness) {
            addLog(`Ingested: ${data.currentBusiness} (${data.processed}/${data.total})`);
          }
          if (data.status === 'completed') {
            addLog(`Ingestion complete: ${data.processed} businesses added`);
            fetchGmapQueries();
            es.close();
            eventSourceRef.current = null;
          } else if (data.status === 'failed') {
            addLog(`Ingestion failed: ${data.error || 'unknown error'}`);
            es.close();
            eventSourceRef.current = null;
          }
        } catch {
          // Ignore parse errors
        }
      };

      es.onerror = () => {
        addLog('Connection to ingestion stream lost');
        es.close();
        eventSourceRef.current = null;
      };
    } catch (err: any) {
      addLog(`Failed to start ingestion: ${err.response?.data?.error || err.message}`);
      setIsLoading(false);
    }
  };

  const handleCreateQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiClient.post('/admin/ingest/google-maps/queries', {
        name: newQueryName || newQueryText,
        query: newQueryText,
        category: newQueryCategory || undefined,
        geo: newQueryGeo || undefined,
        radius: newQueryRadius ? parseInt(newQueryRadius, 10) : undefined,
        active: true,
      });
      setGmapQueries((prev) => [...prev, res.data.data]);
      setNewQueryName('');
      setNewQueryText('');
      setNewQueryCategory('');
      setNewQueryGeo('');
      setNewQueryRadius('');
      addLog(`Saved Google Maps query: ${res.data.data.name}`);
    } catch (err: any) {
      addLog(`Failed to save query: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleToggleQuery = async (id: string, currentActive: boolean) => {
    try {
      await apiClient.patch(`/admin/ingest/google-maps/queries/${id}`, { active: !currentActive });
      setGmapQueries((prev) => prev.map((q) => (q.id === id ? { ...q, active: !currentActive } : q)));
    } catch {
      // Ignore
    }
  };

  const handleDeleteQuery = async (id: string) => {
    if (!window.confirm('Delete this query?')) return;
    try {
      await apiClient.delete(`/admin/ingest/google-maps/queries/${id}`);
      setGmapQueries((prev) => prev.filter((q) => q.id !== id));
    } catch {
      // Ignore
    }
  };

  const gmapCategory = category;

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const progress = job ? (job.total > 0 ? (job.processed / job.total) * 100 : 0) : 0;

  const isGmapSource = source === 'googlemaps';

  if (!user || user.role !== 'ADMIN') {
    return null;
  }

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: tokens.color.text }}>
              Data Ingestion
            </h1>
            <p className="text-sm" style={{ color: tokens.color.textMuted }}>
              Pull business and freelancer profiles into the Pabandi network
            </p>
          </div>
          <Link to="/admin/dashboard">
            <Button variant="outline">← Back to Dashboard</Button>
          </Link>
        </div>

        <Stack>
          {/* ── Start Ingestion Form ── */}
          <Surface className="p-6">
            <h2 className="text-lg font-bold mb-4" style={{ color: tokens.color.text }}>
              Start Ingestion
            </h2>
            <form onSubmit={handleStart} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-medium mb-2" style={{ color: tokens.color.textMuted }}>
                  Data Source
                </label>
                <div className="flex gap-2">
                  {SOURCES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setSource(s.value)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                        source === s.value
                          ? 'bg-indigo-500/20 text-indigo-200 border-indigo-400/50'
                          : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs mt-2" style={{ color: tokens.color.textDim }}>
                  {SOURCES.find((s) => s.value === source)?.description}
                </p>
              </div>

              {isGmapSource ? (
                <>
                  <div className="col-span-1 md:col-span-2 lg:col-span-3">
                    <label className="block text-sm font-medium mb-2" style={{ color: tokens.color.textMuted }}>
                      Search Query
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. restaurants in Austin, TX"
                      value={gmapQuery}
                      onChange={(e) => setGmapQuery(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-white/10 bg-white/5 text-slate-200 focus:border-indigo-400 focus:outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: tokens.color.textMuted }}>
                      Category
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. restaurant, salon, spa"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-white/10 bg-white/5 text-slate-200 focus:border-indigo-400 focus:outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: tokens.color.textMuted }}>
                      Geo (lat,lng)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 30.2672,-97.7431"
                      value={gmapGeo}
                      onChange={(e) => setGmapGeo(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-white/10 bg-white/5 text-slate-200 focus:border-indigo-400 focus:outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: tokens.color.textMuted }}>
                      Radius (meters)
                    </label>
                    <input
                      type="number"
                      placeholder="10000"
                      value={gmapRadius}
                      onChange={(e) => setGmapRadius(e.target.value)}
                      min="1000"
                      max="50000"
                      className="w-full px-4 py-3 rounded-lg border border-white/10 bg-white/5 text-slate-200 focus:border-indigo-400 focus:outline-none transition"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: tokens.color.textMuted }}>
                      Country
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. United States"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-white/10 bg-white/5 text-slate-200 focus:border-indigo-400 focus:outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: tokens.color.textMuted }}>
                      State / Region
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. California"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-white/10 bg-white/5 text-slate-200 focus:border-indigo-400 focus:outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: tokens.color.textMuted }}>
                      Category
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Restaurant, Salon"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-white/10 bg-white/5 text-slate-200 focus:border-indigo-400 focus:outline-none transition"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: tokens.color.textMuted }}>
                  Limit
                </label>
                <input
                  type="number"
                  placeholder="50"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  min="1"
                  max="500"
                  className="w-full px-4 py-3 rounded-lg border border-white/10 bg-white/5 text-slate-200 focus:border-indigo-400 focus:outline-none transition"
                />
              </div>

              <div className="col-span-1 md:col-span-2 lg:col-span-3 flex items-end">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={isLoading || (isGmapSource && !gmapQuery)}
                  loading={isLoading}
                >
                  Start Ingestion
                </Button>
              </div>
            </form>
          </Surface>

          {/* ── Saved Google Maps Queries ── */}
          {isGmapSource && gmapQueries.length > 0 && (
            <Surface className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold" style={{ color: tokens.color.text }}>
                  Saved Google Maps Queries
                </h2>
                <Badge tone="info">Weekly cron runs Mondays 02:00 UTC</Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left pb-2" style={{ color: tokens.color.textMuted }}>Name</th>
                      <th className="text-left pb-2" style={{ color: tokens.color.textMuted }}>Query</th>
                      <th className="text-left pb-2" style={{ color: tokens.color.textMuted }}>Category</th>
                      <th className="text-left pb-2" style={{ color: tokens.color.textMuted }}>Geo</th>
                      <th className="text-left pb-2" style={{ color: tokens.color.textMuted }}>Radius</th>
                      <th className="text-center pb-2" style={{ color: tokens.color.textMuted }}>Active</th>
                      <th className="text-left pb-2" style={{ color: tokens.color.textMuted }}>Last Run</th>
                      <th className="text-left pb-2" style={{ color: tokens.color.textMuted }}>Found</th>
                      <th className="text-center pb-2" style={{ color: tokens.color.textMuted }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gmapQueries.map((q) => (
                      <tr key={q.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-2" style={{ color: tokens.color.text }}>{q.name}</td>
                        <td className="py-2 text-xs" style={{ color: tokens.color.textMuted }}>{q.query}</td>
                        <td className="py-2 text-xs" style={{ color: tokens.color.textMuted }}>{q.category || '-'}</td>
                        <td className="py-2 text-xs" style={{ color: tokens.color.textMuted }}>{q.geo || '-'}</td>
                        <td className="py-2 text-xs" style={{ color: tokens.color.textMuted }}>{q.radius || '-'}</td>
                        <td className="py-2 text-center">
                          <Badge
                            tone={q.active ? 'success' : 'danger'}
                            onClick={() => handleToggleQuery(q.id, q.active)}
                            style={{ cursor: 'pointer' }}
                          >
                            {q.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="py-2 text-xs" style={{ color: tokens.color.textMuted }}>
                          {q.lastRun ? new Date(q.lastRun).toLocaleString() : 'Never'}
                        </td>
                        <td className="py-2 text-xs" style={{ color: tokens.color.textMuted }}>{q.totalFound}</td>
                        <td className="py-2 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStartSavedQuery(q.id)}
                            disabled={isLoading}
                          >
                            Run
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteQuery(q.id)}
                            disabled={isLoading}
                          >
                            Del
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Surface>
          )}

          {isGmapSource && (
            <Surface className="p-6">
              <h2 className="text-lg font-bold mb-4" style={{ color: tokens.color.text }}>
                Add New Saved Query
              </h2>
              <form onSubmit={handleCreateQuery} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: tokens.color.textMuted }}>
                    Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Austin Restaurants"
                    value={newQueryName}
                    onChange={(e) => setNewQueryName(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-white/10 bg-white/5 text-slate-200 focus:border-indigo-400 focus:outline-none transition"
                  />
                </div>
                <div className="col-span-1 md:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-medium mb-2" style={{ color: tokens.color.textMuted }}>
                    Query
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. restaurants in Austin, TX"
                    value={newQueryText}
                    onChange={(e) => setNewQueryText(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-white/10 bg-white/5 text-slate-200 focus:border-indigo-400 focus:outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: tokens.color.textMuted }}>
                    Category
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. restaurant"
                    value={newQueryCategory}
                    onChange={(e) => setNewQueryCategory(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-white/10 bg-white/5 text-slate-200 focus:border-indigo-400 focus:outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: tokens.color.textMuted }}>
                    Geo (lat,lng)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 30.2672,-97.7431"
                    value={newQueryGeo}
                    onChange={(e) => setNewQueryGeo(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-white/10 bg-white/5 text-slate-200 focus:border-indigo-400 focus:outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: tokens.color.textMuted }}>
                    Radius (meters)
                  </label>
                  <input
                    type="number"
                    placeholder="10000"
                    value={newQueryRadius}
                    onChange={(e) => setNewQueryRadius(e.target.value)}
                    min="1000"
                    max="50000"
                    className="w-full px-4 py-3 rounded-lg border border-white/10 bg-white/5 text-slate-200 focus:border-indigo-400 focus:outline-none transition"
                  />
                </div>
                <div className="col-span-1 md:col-span-2 lg:col-span-3 flex items-end">
                  <Button type="submit" variant="primary" disabled={isLoading || !newQueryText}>
                    Save Query
                  </Button>
                </div>
              </form>
            </Surface>
          )}

          {/* ── Ingestion Progress ── */}
          {job && (
            <Surface className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold" style={{ color: tokens.color.text }}>
                  Ingestion Progress
                </h2>
                <Badge tone={job.status === 'completed' ? 'success' : job.status === 'failed' ? 'danger' : 'info'}>
                  {job.status}
                </Badge>
              </div>
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span style={{ color: tokens.color.textMuted }}>Processed</span>
                  <span style={{ color: tokens.color.text }}>{job.processed} / {job.total}</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              {job.currentBusiness && (
                <p className="text-xs text-slate-400 mb-4">Currently ingesting: {job.currentBusiness}</p>
              )}
              {job.error && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
                  Error: {job.error}
                </div>
              )}
            </Surface>
          )}

          {/* ── Live Console ── */}
          <Surface className="p-6">
            <h2 className="text-lg font-bold mb-4" style={{ color: tokens.color.text }}>
              Live Console
            </h2>
            <div className="h-64 overflow-y-auto bg-black/20 rounded-lg p-4 font-mono text-xs text-slate-300 space-y-1">
              {logs.length === 0 ? (
                <p style={{ color: tokens.color.textDim }}>No activity yet. Start an ingestion to see logs.</p>
              ) : (
                logs.map((log, i) => (
                  <div key={i} style={{ color: tokens.color.textMuted }}>
                    {log}
                  </div>
                ))
              )}
            </div>
          </Surface>
        </Stack>
      </div>
    </div>
  );
}
