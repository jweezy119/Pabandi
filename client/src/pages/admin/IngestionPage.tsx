import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Surface, Button, Badge, Chip, Stack, tokens } from '../../design-system';
import { useAuthStore } from '../../store/authStore';
import { apiClient, API_HOST } from '../../services/api';

type IngestionSource = 'opendirectories' | 'apify';

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

export default function IngestionPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [source, setSource] = useState<IngestionSource>('opendirectories');
  const [country, setCountry] = useState('');
  const [state, setState] = useState('');
  const [category, setCategory] = useState('');
  const [limit, setLimit] = useState('50');
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
  ];

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') {
      navigate('/');
      return;
    }
  }, [user, navigate]);

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
      const res = await apiClient.post('/admin/ingest', {
        source,
        country: country || undefined,
        state: state || undefined,
        category: category || undefined,
        limit: parseInt(limit, 10) || 50,
      });

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

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const progress = job ? (job.total > 0 ? (job.processed / job.total) * 100 : 0) : 0;

  if (!user || user.role !== 'ADMIN') {
    return null;
  }

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
                  disabled={isLoading}
                  loading={isLoading}
                >
                  Start Ingestion
                </Button>
              </div>
            </form>
          </Surface>

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
