const fs = require('fs');
const file = 'client/src/pages/TechnologyPage.tsx';
let content = fs.readFileSync(file, 'utf8');

const insertion = `
      {/* Alibaba Technology Integration */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        <div className="space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-surface-container-highest flex items-center justify-center border border-outline-variant/20 shadow-sm">
            <span className="material-symbols-outlined text-[#ff6a00] text-4xl">cloud</span>
          </div>
          <h2 className="font-headline text-3xl md:text-4xl font-bold tracking-tight text-on-surface">
            Powered by Alibaba Cloud & AI
          </h2>
          <p className="font-body text-lg text-on-surface-variant">
            To achieve global scale and sub-millisecond predictive latency, Pabandi's risk infrastructure is deeply integrated with Alibaba Cloud and Alibaba's Qwen AI models.
          </p>
          <ul className="space-y-4 pt-4">
            <li className="flex items-start gap-3">
              <span className="material-symbols-outlined text-[#ff6a00] mt-0.5">schema</span>
              <div>
                <strong className="block text-on-surface font-headline">Enterprise Global Scaling</strong>
                <span className="text-on-surface-variant text-sm font-body">Deployed across Alibaba Cloud's global availability zones, ensuring zero downtime for small businesses handling real-time bookings.</span>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="material-symbols-outlined text-[#ff6a00] mt-0.5">model_training</span>
              <div>
                <strong className="block text-on-surface font-headline">Qwen Large Language Models</strong>
                <span className="text-on-surface-variant text-sm font-body">We utilize Alibaba's state-of-the-art Qwen LLMs to dynamically negotiate deposits and process multi-lingual SMS and WhatsApp confirmations autonomously.</span>
              </div>
            </li>
          </ul>
        </div>
        <div className="bg-[#1a1a1a] rounded-3xl p-8 relative overflow-hidden shadow-lg border border-white/5">
          <div className="absolute top-0 left-0 w-64 h-64 bg-[#ff6a00]/10 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/3"></div>
          <div className="relative space-y-6 z-10">
            <div className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-white/10">
              <span className="text-slate-300 text-sm">Alibaba Cloud CDN</span>
              <span className="text-emerald-400 text-sm font-bold">Active globally</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-white/10">
              <span className="text-slate-300 text-sm">Qwen AI Agent Engine</span>
              <span className="text-emerald-400 text-sm font-bold">Processing requests</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-white/10">
              <span className="text-slate-300 text-sm">Real-time Data Sync</span>
              <span className="text-[#ff6a00] font-bold text-lg">< 12ms</span>
            </div>
          </div>
        </div>
      </section>

`;

content = content.replace("      {/* The Web3 Crypto Ecosystem */}", insertion + "      {/* The Web3 Crypto Ecosystem */}");
fs.writeFileSync(file, content);
