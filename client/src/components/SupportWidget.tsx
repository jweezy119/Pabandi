import { useState, useEffect } from 'react';
import { MessageCircle, X, Search, FileText } from 'lucide-react';
import { ClayButton } from './clay/ClayButton';
import { ClayCard } from './clay/ClayCard';
import api from '../services/api';

const navigate = (path: string) => window.location.assign(path);

export function SupportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [articles, setArticles] = useState<any[]>([]);

  useEffect(() => {
    if (query.length > 2) {
      const timer = setTimeout(async () => {
        try {
          const res = await api.get(`/kb?q=${encodeURIComponent(query)}`);
          setArticles(res.data.slice(0, 3));
        } catch (e) {
          console.error(e);
        }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setArticles([]);
    }
  }, [query]);

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 p-4 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-full shadow-lg shadow-emerald-500/20 transition-all z-50 hover:scale-105"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-80 sm:w-96 flex flex-col z-50">
      <ClayCard className="flex flex-col h-[500px] max-h-[80vh] p-0 overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-800 bg-slate-900 flex justify-between items-center">
          <div className="font-semibold text-white">Help & Support</div>
          <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text"
              placeholder="Search help articles..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-white"
            />
          </div>

          {articles.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase">Suggested Articles</h4>
              {articles.map(article => (
                <div 
                  key={article.id} 
                  onClick={() => { setIsOpen(false); navigate(`/support/kb/${article.slug}`); }}
                  className="flex items-start gap-2 p-2 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                >
                  <FileText className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-sm text-slate-300">{article.title}</span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-500 uppercase">Contact Us</h4>
            <ClayButton 
              variant="primary" 
              className="w-full justify-center"
              onClick={() => { setIsOpen(false); navigate('/support/tickets'); }}
            >
              Open Support Ticket
            </ClayButton>
            <div className="text-center pt-4 text-sm text-slate-400">
              Or email us directly at <br />
              <a href="mailto:jay@pabandi.com" className="text-emerald-400 hover:text-emerald-300">jay@pabandi.com</a>
            </div>
          </div>
        </div>
      </ClayCard>
    </div>
  );
}

export default SupportWidget;
