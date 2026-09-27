import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ClayCard } from '../../components/clay/ClayCard';
import { Search, BookOpen, ArrowRight } from 'lucide-react';
import usePabandiApi from '../../hooks/usePabandiApi';

export default function SupportKbPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const api = usePabandiApi();
  
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKb = async () => {
      setLoading(true);
      try {
        const q = searchParams.get('q');
        const endpoint = q ? `/kb?q=${encodeURIComponent(q)}` : '/kb';
        const res = await api.get(endpoint);
        setArticles(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchKb();
  }, [searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query) setSearchParams({ q: query });
    else setSearchParams({});
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-white tracking-tight">Knowledge Base</h1>
        <p className="text-slate-400">Find answers, guides, and tutorials for Pabandi.</p>
        
        <form onSubmit={handleSearch} className="max-w-2xl mx-auto relative mt-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search articles..."
            className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl pl-12 pr-4 py-4 text-white focus:ring-1 focus:ring-emerald-500 transition-all"
          />
        </form>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center text-slate-400 py-12">Loading articles...</div>
        ) : articles.length === 0 ? (
          <div className="text-center text-slate-400 py-12">
            No articles found matching "{searchParams.get('q')}".
          </div>
        ) : (
          <div className="grid gap-4">
            {articles.map((article) => (
              <ClayCard 
                key={article.id} 
                className="p-6 hover:bg-slate-800/50 cursor-pointer transition-colors group"
                onClick={() => navigate(`/support/kb/${article.slug}`)}
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-emerald-500/10 rounded-xl">
                    <BookOpen className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white group-hover:text-emerald-400 transition-colors">
                      {article.title}
                    </h3>
                    <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                      {article.body}
                    </p>
                    <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
                      <span className="px-2 py-1 bg-slate-800 rounded-md">{article.category}</span>
                      <span>•</span>
                      <span>Last updated {new Date(article.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-emerald-400 transition-colors self-center opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 duration-300" />
                </div>
              </ClayCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
