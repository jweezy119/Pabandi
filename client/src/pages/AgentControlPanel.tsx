import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AGENTS = [
  { id: 'PROMOTER_AUTON', name: 'PromoterAuton', icon: '🤖', color: 'purple', description: 'Autonomously manages promoters, adjusts deposits, recruits guests' },
  { id: 'VENUE_BRAIN', name: 'VenueBrain', icon: '🧠', color: 'blue', description: 'Venue intelligence: dynamic pricing, capacity, staffing, inventory' },
  { id: 'GUEST_FINDER', name: 'GuestFinder', icon: '🔍', color: 'green', description: 'Finds and recruits high-value guests, churn prevention' },
  { id: 'REVENUE_MAX', name: 'RevenueMax', icon: '💰', color: 'amber', description: 'Revenue optimization: pricing, upsells, yield management' },
];

const AGENT_ACTIONS: Record<string, string[]> = {
  PROMOTER_AUTON: ['ADJUST_DEPOSIT_POLICY', 'OFFER_PREMIUM_PARTNERSHIP', 'OPTIMIZE_GUEST_LIST', 'RECRUIT_LOOKALIKE_GUESTS', 'SEND_SMART_REMINDERS'],
  VENUE_BRAIN: ['INCREASE_COVER_CHARGE', 'DECREASE_COVER_CHARGE', 'ASSIGN_PROMOTER_TIER', 'FLAG_RISKY_PROMOTERS', 'FORECAST_BOTTLE_INVENTORY', 'ACTIVATE_OVERFLOW'],
  GUEST_FINDER: ['REENGAGE_CHURNED_GUESTS', 'UPGRADE_TO_AMBASSADOR', 'WARN_VENUE_ABOUT_RISKY_GUESTS'],
  REVENUE_MAX: ['INCREASE_BOTTLE_PRICES', 'PROMOTE_UPSELL_PACKAGES'],
};

export const AgentControlPanel: React.FC = () => {
  const navigate = useNavigate();
  const [activeAgent, setActiveAgent] = useState('PROMOTER_AUTON');
  const [executions, setExecutions] = useState<any[]>([]);
  const [runningAgent, setRunningAgent] = useState<string | null>(null);
  const [selectedVenue, setSelectedVenue] = useState('');
  const [venues, setVenues] = useState<any[]>([]);

  useEffect(() => {
    loadExecutions();
    loadVenues();
  }, [activeAgent]);

  const loadExecutions = async () => {
    try {
      const res = await fetch(`/api/v1/agents/executions?agentType=${activeAgent}&limit=20`);
      const data = await res.json();
      if (data.success) setExecutions(data.data);
    } catch (e) {
      console.error('Failed to load executions:', e);
    }
  };

  const loadVenues = async () => {
    try {
      const res = await fetch('/api/v1/nightlife/venues?limit=50');
      const data = await res.json();
      if (data.success) setVenues(data.data);
    } catch (e) {
      console.error('Failed to load venues:', e);
    }
  };

  const runAgent = async (agentType: string) => {
    setRunningAgent(agentType);
    try {
      const res = await fetch(`/api/v1/agents/${agentType}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueId: selectedVenue }),
      });
      const data = await res.json();
      if (data.success) {
        loadExecutions();
      }
    } catch (e) {
      console.error('Failed to run agent:', e);
    } finally {
      setRunningAgent(null);
    }
  };

  const runAllAgents = async () => {
    setRunningAgent('ALL');
    try {
      const res = await fetch('/api/v1/agents/run-all', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        loadExecutions();
      }
    } catch (e) {
      console.error('Failed to run all agents:', e);
    } finally {
      setRunningAgent(null);
    }
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      CRITICAL: 'text-red-400 bg-red-400/10',
      HIGH: 'text-orange-400 bg-orange-400/10',
      MEDIUM: 'text-yellow-400 bg-yellow-400/10',
      LOW: 'text-green-400 bg-green-400/10',
    };
    return colors[priority] || 'text-gray-400 bg-gray-400/10';
  };

  const getAgentColor = (agentId: string) => {
    const colors: Record<string, string> = {
      PROMOTER_AUTON: 'from-purple-600 to-pink-600',
      VENUE_BRAIN: 'from-blue-600 to-cyan-600',
      GUEST_FINDER: 'from-green-600 to-emerald-600',
      REVENUE_MAX: 'from-amber-600 to-orange-600',
    };
    return colors[agentId] || 'from-gray-600 to-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm">A</div>
              <span className="text-lg font-bold">Agent Control Panel</span>
              <span className="text-xs text-gray-500">by Pabandi</span>
            </div>
          </div>
          <button onClick={() => navigate('/')} className="text-sm text-gray-400 hover:text-white">
            ← Back to Pabandi
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Agent Selection */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {AGENTS.map((agent) => (
            <button
              key={agent.id}
              onClick={() => setActiveAgent(agent.id)}
              className={`p-4 rounded-lg border transition-all ${
                activeAgent === agent.id
                  ? `border-${agent.color}-500 bg-${agent.color}-500/10`
                  : 'border-gray-700 bg-gray-800 hover:border-gray-600'
              }`}
            >
              <div className="text-3xl mb-2">{agent.icon}</div>
              <div className="font-bold text-sm">{agent.name}</div>
              <div className="text-xs text-gray-400 mt-1">{agent.description}</div>
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm text-gray-400 mb-1 block">Target Venue</label>
              <select
                value={selectedVenue}
                onChange={(e) => setSelectedVenue(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm"
              >
                <option value="">All Venues</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => runAgent(activeAgent)}
              disabled={runningAgent === activeAgent}
              className={`px-6 py-2 bg-gradient-to-r ${getAgentColor(activeAgent)} rounded text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50`}
            >
              {runningAgent === activeAgent ? 'Running...' : `Run ${AGENTS.find(a => a.id === activeAgent)?.name}`}
            </button>
            <button
              onClick={runAllAgents}
              disabled={runningAgent === 'ALL'}
              className="px-6 py-2 bg-gradient-to-r from-red-600 to-orange-600 rounded text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {runningAgent === 'ALL' ? 'Running All...' : 'Run All Agents'}
            </button>
          </div>
        </div>

        {/* Agent Capabilities */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
          <h3 className="font-bold mb-4">{AGENTS.find(a => a.id === activeAgent)?.name} Capabilities</h3>
          <div className="flex flex-wrap gap-2">
            {AGENT_ACTIONS[activeAgent]?.map((action) => (
              <span key={action} className="px-3 py-1 bg-gray-900 border border-gray-700 rounded-full text-sm text-gray-300">
                {action.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>

        {/* Execution History */}
        <div className="space-y-4">
          <h3 className="font-bold">Recent Executions</h3>
          {executions.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-8 border border-gray-700 text-center text-gray-400">
              No executions yet. Run an agent to see results.
            </div>
          ) : (
            executions.map((exec) => (
              <div key={exec.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(exec.priority)}`}>
                      {exec.priority}
                    </span>
                    <span className="font-medium text-sm">{exec.actionType.replace(/_/g, ' ')}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(exec.executedAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-gray-400">{exec.reason}</p>
                {exec.result && (
                  <div className="mt-2 p-2 bg-gray-900 rounded text-xs text-gray-500 font-mono">
                    {JSON.stringify(exec.result, null, 2)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentControlPanel;
