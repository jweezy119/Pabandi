import React, { useState } from 'react';
import { Copy, CheckCircle2, Terminal } from 'lucide-react';

export default function IntegrationScreen() {
  const [copied, setCopied] = useState(false);

  const apiKey = "pbn_test_8f92a17b4c9e3d2f5a6b7c8d9e0f1a2b";
  
  const snippet = `<!-- Pabandi Trust Layer -->
<script src="https://cdn.pabandi.com/v1/trust.js"></script>
<script>
  const pabandi = new PabandiTrust('${apiKey}');
  
  // Attach to your checkout form
  document.getElementById('checkout-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('phone-input').value;
    
    // Pabandi locally hashes the number and checks the Edge Network
    await pabandi.analyzeRisk(phone);
  });
</script>
<!-- End Pabandi -->`;

  const handleCopy = () => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
      
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-100 mb-2">Integration Hub</h2>
        <p className="text-slate-400">Connect your Shopify or WooCommerce store in 60 seconds.</p>
      </div>

      <div className="glass-panel p-8">
        <h3 className="text-xl font-bold mb-4">1. Your API Credentials</h3>
        <p className="text-sm text-slate-400 mb-4">
          This key is used by the frontend SDK to securely hash and identify your traffic. Do not share it.
        </p>
        <div className="bg-dark-900 border border-slate-700/50 p-4 rounded-lg font-mono text-brand-400 flex justify-between items-center">
          <span>{apiKey}</span>
          <span className="text-xs text-slate-500 border border-slate-700 px-2 py-1 rounded">Test Mode</span>
        </div>
      </div>

      <div className="glass-panel p-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">2. Inject the SDK</h3>
          <button 
            onClick={handleCopy}
            className="flex items-center gap-2 px-3 py-1.5 text-sm glass-button"
          >
            {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
            {copied ? 'Copied!' : 'Copy Snippet'}
          </button>
        </div>
        <p className="text-sm text-slate-400 mb-6">
          Paste this snippet into your Shopify `theme.liquid` file before the closing `&lt;/head&gt;` tag, or anywhere in your custom checkout flow.
        </p>

        <div className="relative rounded-lg overflow-hidden border border-slate-700/50">
          <div className="bg-dark-900 px-4 py-2 border-b border-slate-700/50 flex items-center gap-2">
            <Terminal size={14} className="text-slate-500" />
            <span className="text-xs text-slate-400 font-mono">checkout.html</span>
          </div>
          <pre className="p-4 overflow-x-auto text-sm font-mono text-slate-300 bg-dark-900/50">
            <code>{snippet}</code>
          </pre>
        </div>
      </div>

    </div>
  );
}
