import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import usePabandiApi from '../../hooks/usePabandiApi';

export default function SupportKbArticlePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const api = usePabandiApi();
  const [article, setArticle] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        const res = await api.get(`/kb/${slug}`);
        setArticle(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchArticle();
  }, [slug]);

  if (loading) return <div className="p-6 text-center text-slate-400">Loading article...</div>;
  if (!article) return <div className="p-6 text-center text-red-400">Article not found.</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button 
        onClick={() => navigate('/support/kb')}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Knowledge Base
      </button>

      <article className="prose prose-invert prose-emerald max-w-none">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-emerald-400 mb-4">
            <span>{article.category}</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-500">Updated {new Date(article.updatedAt).toLocaleDateString()}</span>
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight mb-4">{article.title}</h1>
        </div>
        
        <div className="text-slate-300 whitespace-pre-wrap leading-relaxed text-lg">
          {article.body}
        </div>
      </article>

      <div className="mt-16 pt-8 border-t border-slate-800 text-center">
        <p className="text-slate-400 mb-4">Still need help?</p>
        <button 
          onClick={() => navigate('/support/tickets')}
          className="text-emerald-400 hover:text-emerald-300 font-medium"
        >
          Open a Support Ticket &rarr;
        </button>
      </div>
    </div>
  );
}
