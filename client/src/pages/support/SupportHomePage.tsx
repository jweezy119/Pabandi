import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClayCard } from '../../components/clay/ClayCard';
import { ClayButton } from '../../components/clay/ClayButton';
import { Search, Book, Ticket, Server, MessageCircle, AlertCircle } from 'lucide-react';

export default function SupportHomePage() {
  console.log('SupportHomePage');
  const navigate = useNavigate();

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-white tracking-tight">How can we help?</h1>
        <p className="text-slate-400 max-w-2xl mx-auto">
          Search our knowledge base, browse articles, or contact our support team.
        </p>
        
        <div className="max-w-2xl mx-auto relative mt-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search for answers..."
            className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
            onKeyDown={(e) => {
              if (e.key === 'Enter') navigate(`/support/kb?q=${e.currentTarget.value}`);
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
        <ClayCard className="p-6 hover:scale-[1.02] transition-transform cursor-pointer" onClick={() => navigate('/support/kb')}>
          <Book className="w-8 h-8 text-emerald-400 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Knowledge Base</h3>
          <p className="text-sm text-slate-400">Browse guides, tutorials, and FAQs.</p>
        </ClayCard>
        
        <ClayCard className="p-6 hover:scale-[1.02] transition-transform cursor-pointer" onClick={() => navigate('/support/tickets')}>
          <Ticket className="w-8 h-8 text-blue-400 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">My Tickets</h3>
          <p className="text-sm text-slate-400">View and manage your support requests.</p>
        </ClayCard>

        <ClayCard className="p-6 hover:scale-[1.02] transition-transform cursor-pointer">
          <Server className="w-8 h-8 text-emerald-400 mb-4" />
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-white">System Status</h3>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <p className="text-sm text-slate-400">All systems operational.</p>
        </ClayCard>
      </div>

      <div className="mt-12 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-3xl p-8 text-center">
        <MessageCircle className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Still need help?</h2>
        <p className="text-slate-400 mb-6">Our support team is ready to assist you.</p>
        <div className="flex justify-center gap-4">
          <ClayButton variant="primary" onClick={() => navigate('/support/tickets')}>
            Open a Ticket
          </ClayButton>
        </div>
        <div className="mt-6 text-sm text-slate-500">
          Or email us directly at <a href="mailto:jay@pabandi.com" className="text-indigo-400 hover:text-indigo-300">jay@pabandi.com</a>
        </div>
      </div>
    </div>
  );
}
