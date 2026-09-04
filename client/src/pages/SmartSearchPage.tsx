import React, { useState, useEffect } from 'react';
import { Surface, Badge, tokens } from '../design-system';
import { useNavigate } from 'react-router-dom';

interface SearchResult {
  id: string;
  type: 'property' | 'listing' | 'tenant' | 'document' | 'escrow' | 'ai';
  title: string;
  subtitle: string;
  icon: string;
  link: string;
  score: number;
}

interface AiSuggestion {
  id: string;
  text: string;
  icon: string;
  action: () => void;
}

export const SmartSearchPage: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    // Load recent searches from localStorage
    const saved = localStorage.getItem('pabandi_recent_searches');
    if (saved) setRecentSearches(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setSuggestions(generateSuggestions(query));
      return;
    }

    setLoading(true);
    const timer = setTimeout(() => {
      const mockResults = generateMockResults(query);
      setResults(mockResults);
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const generateSuggestions = (q: string): AiSuggestion[] => {
    const all: AiSuggestion[] = [
      { id: '1', text: 'Analyze a property value', icon: '🏠', action: () => navigate('/ai/analyze') },
      { id: '2', text: 'Generate a lease agreement', icon: '📝', action: () => navigate('/ai/assistant') },
      { id: '3', text: 'Screen a tenant', icon: '🔍', action: () => navigate('/background-check') },
      { id: '4', text: 'Open an escrow', icon: '🔒', action: () => navigate('/escrow') },
      { id: '5', text: 'View my PAB balance', icon: '💰', action: () => navigate('/token') },
      { id: '6', text: 'Browse marketplace', icon: '🛒', action: () => navigate('/marketplace') },
      { id: '7', text: 'Check rent roll', icon: '📋', action: () => navigate('/rent-roll') },
      { id: '8', text: 'Ask AI assistant', icon: '🤖', action: () => navigate('/ai/chat') },
    ];

    if (!q) return all.slice(0, 4);
    return all.filter((s) => s.text.toLowerCase().includes(q.toLowerCase()));
  };

  const generateMockResults = (q: string): SearchResult[] => {
    const lower = q.toLowerCase();
    const mock: SearchResult[] = [
      { id: '1', type: 'property', title: '2BR Apartment - Downtown', subtitle: 'Chicago, IL · $1,800/mo', icon: '🏠', link: '/property/1', score: 95 },
      { id: '2', type: 'listing', title: 'IKEA Sofa - Like New', subtitle: 'Furniture · $350', icon: '🛋️', link: '/listing/1', score: 90 },
      { id: '3', type: 'tenant', title: 'Sarah M.', subtitle: 'Application pending · LOW risk', icon: '👤', link: '/applications', score: 85 },
      { id: '4', type: 'escrow', title: 'Escrow #esc-123', subtitle: 'FUNDED · $250', icon: '🔒', link: '/escrow/1', score: 80 },
      { id: '5', type: 'document', title: 'Lease Agreement - 123 Main St', subtitle: 'Signed · Jan 2026', icon: '📄', link: '/documents', score: 75 },
    ];

    return mock.filter(
      (r) =>
        r.title.toLowerCase().includes(lower) ||
        r.subtitle.toLowerCase().includes(lower)
    ).sort((a, b) => b.score - a.score);
  };

  const saveSearch = (q: string) => {
    if (!q.trim()) return;
    const updated = [q, ...recentSearches.filter((s) => s !== q)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('pabandi_recent_searches', JSON.stringify(updated));
  };

  const clearRecent = () => {
    setRecentSearches([]);
    localStorage.removeItem('pabandi_recent_searches');
  };

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="text-center mb-8">
          <Badge tone="info" className="mb-3">🔍 Smart Search</Badge>
          <h1 className="text-3xl font-black text-slate-100 font-headline">Find Anything</h1>
          <p className="mt-3 text-slate-400">Search across properties, listings, tenants, documents, and more.</p>
        </div>

        {/* Search Input */}
        <Surface className="p-4 mb-6">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔍</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveSearch(query)}
              placeholder="Search properties, tenants, documents..."
              className="flex-1 bg-transparent text-slate-100 outline-none text-lg placeholder:text-slate-500"
              autoFocus
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-slate-500 hover:text-white">
                ✕
              </button>
            )}
          </div>
        </Surface>

        {/* AI Suggestions */}
        {suggestions.length > 0 && (
          <Surface className="p-4 mb-6">
            <h3 className="text-sm font-bold text-slate-100 mb-3">✨ AI Suggestions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  onClick={s.action}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-left"
                >
                  <span className="text-xl">{s.icon}</span>
                  <span className="text-sm text-slate-300">{s.text}</span>
                </button>
              ))}
            </div>
          </Surface>
        )}

        {/* Results */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Surface key={i} className="p-4 animate-pulse">
                <div className="h-4 bg-white/10 rounded w-1/3 mb-2" />
                <div className="h-3 bg-white/10 rounded w-1/2" />
              </Surface>
            ))}
          </div>
        ) : results.length > 0 ? (
          <Surface className="p-4">
            <h3 className="text-sm font-bold text-slate-100 mb-3">Results ({results.length})</h3>
            <div className="space-y-2">
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => navigate(result.link)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-left"
                >
                  <div className="text-xl">{result.icon}</div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-100">{result.title}</div>
                    <div className="text-xs" style={{ color: tokens.color.muted }}>{result.subtitle}</div>
                  </div>
                  <Badge tone="info">{result.type}</Badge>
                </button>
              ))}
            </div>
          </Surface>
        ) : query.length >= 2 ? (
          <Surface className="p-8 text-center">
            <div className="text-3xl mb-2">🔍</div>
            <p className="text-slate-400">No results found for "{query}"</p>
          </Surface>
        ) : null}

        {/* Recent Searches */}
        {recentSearches.length > 0 && query.length < 2 && (
          <Surface className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-100">Recent Searches</h3>
              <button onClick={clearRecent} className="text-xs text-slate-500 hover:text-white">
                Clear
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((search) => (
                <button
                  key={search}
                  onClick={() => setQuery(search)}
                  className="px-3 py-1.5 rounded-lg bg-white/5 text-sm text-slate-300 hover:bg-white/10"
                >
                  {search}
                </button>
              ))}
            </div>
          </Surface>
        )}
      </div>
    </div>
  );
};

export default SmartSearchPage;
