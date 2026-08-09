import { useState } from 'react';
import { Link } from 'react-router-dom';
import { tokens } from '../design-system';

export default function FreelanceStorefrontPage() {
  const [activeApp, setActiveApp] = useState<'checkout' | 'portfolio' | 'chat'>('checkout');
  
  // Mock data for the storefront
  const freelancer = {
    name: 'Syed H.',
    title: 'Senior Web3 & AI Developer',
    trustScore: 98,
    trustBand: 'A+',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
    location: 'Chicago, IL',
    totalEscrows: 124,
    description: 'Specializing in Solana smart contracts, AI Agent integration, and high-conversion React frontends. I only work via Pabandi Smart Escrow to guarantee delivery.',
  };

  const services = [
    { id: '1', name: 'Custom React Web App', price: 1500, delivery: '7 days', description: 'Full-stack React app with database integration and beautiful UI.' },
    { id: '2', name: 'Smart Contract Audit', price: 800, delivery: '3 days', description: 'Security audit for your Solana or EVM smart contracts.' },
    { id: '3', name: 'AI Chatbot Integration', price: 500, delivery: '2 days', description: 'Add an intelligent customer service AI to your website.' },
  ];

  return (
    <div className="min-h-screen bg-slate-900 pb-24 font-body" style={{ color: tokens.color.text }}>
      
      {/* STOREFRONT HEADER - The "Whop" equivalent profile banner */}
      <div className="relative w-full h-64 md:h-80 bg-gradient-to-r from-indigo-900 via-slate-800 to-indigo-950 overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2000')] bg-cover bg-center mix-blend-overlay"></div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative -mt-24">
        
        {/* Profile Card */}
        <div className="bg-slate-800/90 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row gap-6 items-start md:items-center shadow-2xl">
          <img src={freelancer.avatar} alt={freelancer.name} className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-slate-900 shadow-xl object-cover" />
          
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-3xl font-black font-headline text-white">{freelancer.name}</h1>
              <span className="flex items-center gap-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold px-2 py-1 rounded-lg uppercase tracking-wider">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                Available for Work
              </span>
            </div>
            <p className="text-lg text-indigo-300 font-medium mb-3">{freelancer.title}</p>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">{freelancer.description}</p>
          </div>

          <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex gap-6 md:min-w-[250px] shrink-0">
             <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Trust Passport</p>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-black text-emerald-400">{freelancer.trustScore}</span>
                  <span className="text-sm text-emerald-400/70 font-bold mb-1">{freelancer.trustBand}</span>
                </div>
             </div>
             <div className="w-px bg-white/10"></div>
             <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Escrow Deals</p>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-black text-white">{freelancer.totalEscrows}</span>
                </div>
             </div>
          </div>
        </div>

        {/* Modular "Apps" Navigation */}
        <div className="flex items-center gap-2 mt-8 mb-6 overflow-x-auto no-scrollbar border-b border-white/5 pb-2">
           <button 
             onClick={() => setActiveApp('checkout')}
             className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeApp === 'checkout' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
           >
             🛍️ Escrow Services
           </button>
           <button 
             onClick={() => setActiveApp('portfolio')}
             className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeApp === 'portfolio' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
           >
             📁 Verified Portfolio
           </button>
           <button 
             onClick={() => setActiveApp('chat')}
             className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeApp === 'chat' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
           >
             🤖 AI Concierge
           </button>
        </div>

        {/* Dynamic App Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content Area */}
          <div className="lg:col-span-2">
            
            {activeApp === 'checkout' && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold font-headline mb-4 flex items-center gap-2">
                  <span className="text-indigo-400">⚡</span> Available Services
                </h2>
                {services.map(service => (
                  <div key={service.id} className="bg-slate-800/40 border border-white/10 rounded-2xl p-6 hover:border-indigo-500/50 transition-colors group flex flex-col sm:flex-row justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-white mb-2 group-hover:text-indigo-300 transition-colors">{service.name}</h3>
                      <p className="text-sm text-slate-400 mb-4">{service.description}</p>
                      <span className="inline-flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-md text-xs font-medium text-slate-300">
                        ⏱️ Delivery: {service.delivery}
                      </span>
                    </div>
                    <div className="flex flex-col items-start sm:items-end justify-between shrink-0">
                      <p className="text-2xl font-black text-white">${service.price}</p>
                      <Link to={`/checkout/mock-escrow`} className="mt-4 sm:mt-0 bg-white text-black font-bold text-sm px-6 py-2.5 rounded-xl hover:bg-indigo-400 hover:text-white transition-colors w-full sm:w-auto text-center">
                        Fund Escrow
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeApp === 'portfolio' && (
              <div className="bg-slate-800/40 border border-white/10 rounded-2xl p-8 text-center min-h-[300px] flex flex-col items-center justify-center">
                 <span className="text-4xl mb-4 grayscale">🖼️</span>
                 <h3 className="text-xl font-bold mb-2">Verified Deliverables</h3>
                 <p className="text-slate-400 max-w-sm">Past work completed through Pabandi Escrow is automatically verified and showcased here.</p>
              </div>
            )}

            {activeApp === 'chat' && (
              <div className="bg-slate-800/40 border border-white/10 rounded-2xl h-[500px] flex flex-col overflow-hidden">
                <div className="bg-black/30 p-4 border-b border-white/5 flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400 text-xl">🤖</div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Syed's AI Concierge</h3>
                    <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Online</p>
                  </div>
                </div>
                <div className="flex-1 p-6 overflow-y-auto space-y-4">
                  <div className="flex gap-3 max-w-[80%]">
                    <div className="w-8 h-8 bg-indigo-500/20 rounded-full flex-shrink-0 flex items-center justify-center text-xs">🤖</div>
                    <div className="bg-indigo-500/10 border border-indigo-500/20 text-slate-300 text-sm p-3 rounded-2xl rounded-tl-none">
                      Hi! I'm the AI assistant for Syed. He is currently asleep (Chicago time). I can answer questions about his React & Web3 services, negotiate a custom scope, and generate a secure Escrow checkout link for you. What do you need built?
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-black/20 border-t border-white/5">
                  <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl p-2">
                    <input type="text" placeholder="I need a custom crypto wallet built..." className="flex-1 bg-transparent border-none outline-none text-sm px-2 text-white placeholder-slate-500" />
                    <button className="bg-indigo-500 text-white p-2 rounded-lg hover:bg-indigo-400 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Sidebar Area */}
          <div className="space-y-6">
            
            {/* Guarantee Box */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <span className="text-6xl">🛡️</span>
              </div>
              <h3 className="font-bold text-lg mb-2 relative z-10">Zero Risk Guarantee</h3>
              <p className="text-sm text-slate-400 mb-4 relative z-10">
                All services are powered by Pabandi Smart Escrow. Your funds are locked securely on-chain and only released when you approve the final deliverables.
              </p>
              <ul className="text-xs space-y-2 text-slate-300 font-medium relative z-10">
                <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> No Ghosting</li>
                <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Instant AI Arbitration</li>
                <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Zero-Fee Off-Ramps</li>
              </ul>
            </div>

            {/* Verification Widget */}
            <div className="bg-black/30 border border-white/5 rounded-2xl p-6">
               <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-4">Trust Oracle Verification</p>
               <div className="space-y-3">
                 <div className="flex items-center justify-between">
                   <span className="text-sm text-slate-300">Identity / Liveness</span>
                   <span className="text-sm font-bold text-emerald-400">99%</span>
                 </div>
                 <div className="flex items-center justify-between">
                   <span className="text-sm text-slate-300">Competence (Gig Hist.)</span>
                   <span className="text-sm font-bold text-emerald-400">95%</span>
                 </div>
                 <div className="flex items-center justify-between">
                   <span className="text-sm text-slate-300">Wallet Temporal Age</span>
                   <span className="text-sm font-bold text-emerald-400">4 Years</span>
                 </div>
               </div>
               <button className="w-full mt-6 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-bold py-2 rounded-lg transition-colors">
                 View Full AI Audit Report
               </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
