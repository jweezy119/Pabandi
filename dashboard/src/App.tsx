import React, { useState } from 'react';
import { LayoutDashboard, Network, Code2, ShieldAlert } from 'lucide-react';
import OverviewScreen from './screens/OverviewScreen';
import NetworkScreen from './screens/NetworkScreen';
import IntegrationScreen from './screens/IntegrationScreen';

function App() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="flex h-screen bg-dark-900 text-slate-200 overflow-hidden font-sans">
      
      {/* Sidebar */}
      <div className="w-64 glass-panel border-l-0 border-t-0 border-b-0 rounded-none flex flex-col p-6 z-10">
        <div className="flex items-center gap-3 mb-10 text-brand-500">
          <ShieldAlert size={32} />
          <h1 className="text-2xl font-bold tracking-tight">Pabandi</h1>
        </div>

        <nav className="flex flex-col gap-2 flex-grow">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'overview' ? 'bg-brand-500/20 text-brand-400' : 'hover:bg-dark-700/50 text-slate-400 hover:text-slate-200'}`}
          >
            <LayoutDashboard size={20} />
            <span className="font-medium">Overview</span>
          </button>
          <button 
            onClick={() => setActiveTab('network')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'network' ? 'bg-brand-500/20 text-brand-400' : 'hover:bg-dark-700/50 text-slate-400 hover:text-slate-200'}`}
          >
            <Network size={20} />
            <span className="font-medium">ZK Network</span>
          </button>
          <button 
            onClick={() => setActiveTab('integration')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'integration' ? 'bg-brand-500/20 text-brand-400' : 'hover:bg-dark-700/50 text-slate-400 hover:text-slate-200'}`}
          >
            <Code2 size={20} />
            <span className="font-medium">Integration</span>
          </button>
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-700/50 text-xs text-slate-500 flex flex-col gap-1">
          <span>Logged in as: Demo Store</span>
          <span>API Key: pbn_test_8f92a1...</span>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-10 relative">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-500/10 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="relative z-10 max-w-6xl mx-auto">
          {activeTab === 'overview' && <OverviewScreen />}
          {activeTab === 'network' && <NetworkScreen />}
          {activeTab === 'integration' && <IntegrationScreen />}
        </div>
      </main>
    </div>
  );
}

export default App;
