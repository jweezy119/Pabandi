import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { tokens } from '../design-system';

export default function DarazScannerPage() {
  const [url, setUrl] = useState('');
  const [sellerName, setSellerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await api.post('/ai/daraz-scanner', {
        sellerUrl: url,
        sellerName: sellerName || 'Unknown Seller',
      });
      setResult(response.data.data);
    } catch (error) {
      console.error('Scan failed', error);
      alert('Failed to scan seller. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16 px-4" style={{ background: tokens.color.background, color: tokens.color.text }}>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link to="/" className="text-sm text-indigo-400 hover:text-indigo-300 font-bold mb-4 inline-block">← Back to Home</Link>
          <h1 className="text-4xl md:text-5xl font-black font-headline text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-rose-400 mb-4">
            Brushing Scam Scanner
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl font-light leading-relaxed">
            Pabandi's AI Trust Oracle detects fake reviews and bot farms on e-commerce platforms like Daraz. 
            Enter a seller URL to run an instant NLP sentiment analysis on their recent reviews.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-slate-800/50 p-6 sm:p-8 rounded-3xl border border-white/10 backdrop-blur-md">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <span>🔍</span> Scan a Seller
            </h2>
            <form onSubmit={handleScan} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Daraz Seller URL</label>
                <input
                  type="url"
                  placeholder="https://www.daraz.pk/shop/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Seller Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. SuperTech Gadgets"
                  value={sellerName}
                  onChange={(e) => setSellerName(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
                />
                <p className="text-xs text-slate-500 mt-2 font-medium">
                  *Demo Tip: Include the word "bot" in the name to trigger the fake review farm mock data.
                </p>
              </div>
              
              <button
                type="submit"
                disabled={loading || !url}
                className="w-full bg-gradient-to-r from-orange-500 to-rose-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Scanning Reviews...
                  </>
                ) : (
                  'Run AI Analysis'
                )}
              </button>
            </form>
          </div>

          <div>
            {result ? (
              <div className="bg-slate-800/50 p-6 sm:p-8 rounded-3xl border border-white/10 backdrop-blur-md h-full flex flex-col">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1 block">Analysis Complete</span>
                    <h2 className="text-2xl font-bold font-headline">{result.sellerName}</h2>
                  </div>
                  <div className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border ${result.analysis.isFake ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
                    {result.analysis.isFake ? 'High Risk' : 'Verified'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-black/30 rounded-2xl p-4 text-center border border-white/5">
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-widest">Trust Score</p>
                    <p className={`text-3xl font-black ${result.analysis.trustScore >= 80 ? 'text-emerald-400' : result.analysis.trustScore >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                      {result.analysis.trustScore}
                    </p>
                  </div>
                  <div className="bg-black/30 rounded-2xl p-4 text-center border border-white/5">
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-widest">Bot Probability</p>
                    <p className={`text-3xl font-black ${result.analysis.reviewFarmProbability >= 70 ? 'text-red-400' : result.analysis.reviewFarmProbability >= 30 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {result.analysis.reviewFarmProbability}%
                    </p>
                  </div>
                </div>

                <div className="mb-6 flex-1">
                  <p className="text-[10px] uppercase font-bold text-slate-400 mb-2 tracking-widest flex items-center gap-2">
                    <span className="text-indigo-400 text-sm">🧠</span> AI Rationale
                  </p>
                  <p className="text-sm text-slate-300 leading-relaxed bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl">
                    {result.analysis.rationale}
                  </p>
                </div>

                <div>
                   <p className="text-[10px] uppercase font-bold text-slate-400 mb-2 tracking-widest">Sample Scraped Reviews ({result.rawReviewsScraped})</p>
                   <div className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                     {result.sampleReviews.map((review: string, i: number) => (
                       <div key={i} className="text-xs text-slate-400 bg-black/20 p-2 rounded-lg border border-white/5">
                         "{review}"
                       </div>
                     ))}
                   </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-800/20 p-6 sm:p-8 rounded-3xl border border-white/5 border-dashed h-full flex flex-col items-center justify-center text-center opacity-50">
                <span className="text-4xl mb-4 grayscale">🤖</span>
                <p className="text-slate-400 font-medium max-w-xs">Waiting for a seller URL to begin AI sentiment analysis and footprint verification.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
