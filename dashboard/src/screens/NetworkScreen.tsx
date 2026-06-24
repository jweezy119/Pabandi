import React, { useEffect, useState } from 'react';
import { Activity, ShieldCheck, Database, Zap } from 'lucide-react';

export default function NetworkScreen() {
  const [hashes, setHashes] = useState<string[]>([]);

  // Simulate a live feed of zero-knowledge hashes streaming in from the network
  useEffect(() => {
    const generateHash = () => {
      const chars = '0123456789abcdef';
      let hash = '0x';
      for (let i = 0; i < 64; i++) {
        hash += chars[Math.floor(Math.random() * chars.length)];
      }
      return hash;
    };

    const interval = setInterval(() => {
      setHashes(prev => {
        const newHashes = [generateHash(), ...prev];
        if (newHashes.length > 8) newHashes.pop();
        return newHashes;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-100 mb-2">Zero-Knowledge Network</h2>
        <p className="text-slate-400">Live view of the federated intelligence graph.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Info Column */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel p-6 border-l-4 border-l-brand-500">
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
              <ShieldCheck className="text-brand-500" />
              100% Privacy Preserved
            </h3>
            <p className="text-sm text-slate-400">
              Pabandi never sees or stores phone numbers. The network only shares irreversible cryptographic hashes.
            </p>
          </div>

          <div className="glass-panel p-6 border-l-4 border-l-indigo-500">
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
              <Database className="text-indigo-500" />
              Consortium Data
            </h3>
            <p className="text-sm text-slate-400">
              When a buyer commits fraud on a TikTok shop, their hash is broadcast to all Shopify merchants instantly.
            </p>
          </div>

          <div className="glass-panel p-6 border-l-4 border-l-rose-500">
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
              <Zap className="text-rose-500" />
              Edge Bloom Filters
            </h3>
            <p className="text-sm text-slate-400">
              95% of your buyers are verified locally in the browser via Bloom Filters without ever hitting the database.
            </p>
          </div>
        </div>

        {/* Live Feed Column */}
        <div className="lg:col-span-2">
          <div className="glass-panel p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6 border-b border-slate-700/50 pb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Activity className="text-brand-500 animate-pulse" />
                Live Global Intercepts
              </h3>
              <span className="text-xs font-mono text-slate-500">HMAC-SHA256 STREAM</span>
            </div>

            <div className="flex-1 space-y-3 font-mono text-xs md:text-sm overflow-hidden relative">
              {/* Fade out at bottom */}
              <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-dark-800 to-transparent z-10" />
              
              {hashes.map((hash, i) => (
                <div 
                  key={hash} 
                  className="p-3 bg-dark-900 rounded border border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-in slide-in-from-top-2 fade-in duration-300"
                  style={{ opacity: 1 - (i * 0.15) }}
                >
                  <span className="text-slate-300 truncate w-full sm:w-2/3">{hash}</span>
                  <span className="text-brand-400 whitespace-nowrap bg-brand-500/10 px-2 py-1 rounded">
                    Risk Assessment: BLOCK
                  </span>
                </div>
              ))}
              
              {hashes.length === 0 && (
                <div className="text-slate-500 text-center py-10">Listening for network events...</div>
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
