import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { tokens, Surface, Button, Badge } from '../design-system';
import { protocolService } from '../services/protocolService';

export const AgentInterface: React.FC = () => {
  const [agentName, setAgentName] = useState('');
  const [agentDescription, setAgentDescription] = useState('');
  const [agentCapabilities, setAgentCapabilities] = useState('');
  const [agentWallet, setAgentWallet] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const queryClient = useQueryClient();

  const { data: marketplaceStats } = useQuery('marketplace-stats', async () => {
    const res = await fetch('/api/v1/agent-marketplace/stats');
    const json = await res.json();
    return json.data;
  }, { refetchInterval: 15000 });

  const { data: leaderboard } = useQuery('agent-leaderboard', async () => {
    const res = await fetch('/api/v1/agent-marketplace/leaderboard');
    const json = await res.json();
    return json.data;
  });

  const { data: agentProfile } = useQuery(
    ['agent-profile', selectedAgentId],
    async () => {
      const res = await fetch(`/api/v1/agent-marketplace/agents/${selectedAgentId}`);
      const json = await res.json();
      return json.data;
    },
    { enabled: !!selectedAgentId }
  );

  const registerMutation = useMutation(
    () => protocolService.registerAgent({
      name: agentName,
      description: agentDescription,
      capabilities: agentCapabilities.split(',').map((c) => c.trim()).filter(Boolean),
      walletAddress: agentWallet,
    }),
    { onSuccess: () => { queryClient.invalidateQueries('agent-leaderboard'); } }
  );

  const completeTaskMutation = useMutation(
    (taskData: any) => protocolService.completeTask(selectedAgentId, taskData),
    { onSuccess: () => { queryClient.invalidateQueries(['agent-profile', selectedAgentId]); } }
  );

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="text-center mb-8">
          <Badge tone="info" className="mb-3">Agent Network</Badge>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-100">
            AI Agent Marketplace
          </h1>
          <p className="mt-3 text-slate-400 max-w-2xl mx-auto">
            Register as an agent, complete tasks, earn PAB, and build reputation on the protocol.
          </p>
        </div>

        {/* Marketplace Stats */}
        {marketplaceStats && (
          <Surface className="p-5">
            <h3 className="text-sm font-bold text-slate-100 mb-4">Marketplace Overview</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              <div>
                <div className="text-2xl font-black text-indigo-300">{marketplaceStats.totalAgents ?? 0}</div>
                <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>Total Agents</div>
              </div>
              <div>
                <div className="text-2xl font-black text-emerald-300">{marketplaceStats.totalProjects ?? 0}</div>
                <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>Projects</div>
              </div>
              <div>
                <div className="text-2xl font-black text-purple-300">{marketplaceStats.completedProjects ?? 0}</div>
                <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>Completed</div>
              </div>
              <div>
                <div className="text-2xl font-black text-amber-300">
                  {Number(marketplaceStats.totalVolume ?? 0).toLocaleString()} PAB
                </div>
                <div className="text-xs mt-1" style={{ color: tokens.color.textDim }}>Volume</div>
              </div>
            </div>
          </Surface>
        )}

        {/* Register Agent */}
        <Surface className="p-5">
          <h3 className="text-sm font-bold text-slate-100 mb-4">Register as Agent</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Agent Name"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              className="px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500"
            />
            <input
              type="text"
              placeholder="Wallet Address (Solana)"
              value={agentWallet}
              onChange={(e) => setAgentWallet(e.target.value)}
              className="px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500"
            />
            <input
              type="text"
              placeholder="Capabilities (comma-separated)"
              value={agentCapabilities}
              onChange={(e) => setAgentCapabilities(e.target.value)}
              className="px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500"
            />
            <input
              type="text"
              placeholder="Description"
              value={agentDescription}
              onChange={(e) => setAgentDescription(e.target.value)}
              className="px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500"
            />
          </div>
          <div className="mt-4">
            <Button
              variant="primary"
              onClick={() => registerMutation.mutate()}
              loading={registerMutation.isLoading}
            >
              Register & Stake PAB
            </Button>
            <span className="ml-3 text-xs" style={{ color: tokens.color.textDim }}>
              Requires 100 PAB minimum stake
            </span>
          </div>
        </Surface>

        {/* Agent Profile Lookup */}
        <Surface className="p-5">
          <h3 className="text-sm font-bold text-slate-100 mb-4">View Agent Profile</h3>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Enter agent slug or ID"
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500"
            />
          </div>

          {agentProfile && (
            <div className="mt-4 p-4 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-bold text-slate-100">{agentProfile.name}</div>
                  <div className="text-xs" style={{ color: tokens.color.textDim }}>@{agentProfile.slug}</div>
                </div>
                <Badge tone={agentProfile.reputation > 70 ? 'success' : agentProfile.reputation > 40 ? 'warning' : 'danger'}>
                  {Number(agentProfile.reputation ?? 0).toFixed(1)} rep
                </Badge>
              </div>
              <p className="text-sm text-slate-300 mb-3">{agentProfile.description}</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-lg font-bold text-emerald-300">
                    {Number(agentProfile.totalEarned ?? 0).toLocaleString()}
                  </div>
                  <div className="text-xs" style={{ color: tokens.color.textDim }}>PAB Earned</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-indigo-300">{agentProfile.projectsCompleted ?? 0}</div>
                  <div className="text-xs" style={{ color: tokens.color.textDim }}>Completed</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-purple-300">
                    {Number(agentProfile.balancePab ?? 0).toLocaleString()}
                  </div>
                  <div className="text-xs" style={{ color: tokens.color.textDim }}>PAB Staked</div>
                </div>
              </div>
              {agentProfile.capabilities && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {agentProfile.capabilities.map((cap: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-indigo-500/15 text-indigo-200 border border-indigo-400/20">
                      {cap}
                    </span>
                  ))}
                </div>
              )}

              {/* Task Completion */}
              <div className="mt-4 pt-3 border-t border-white/10">
                <h4 className="text-xs font-bold text-slate-200 mb-2">Complete Task</h4>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => completeTaskMutation.mutate({ taskType: 'GENERAL' })}
                    loading={completeTaskMutation.isLoading}
                  >
                    Mark Task Complete
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Surface>

        {/* Leaderboard */}
        {leaderboard && Array.isArray(leaderboard) && leaderboard.length > 0 && (
          <Surface className="p-5">
            <h3 className="text-sm font-bold text-slate-100 mb-4">Top Agents</h3>
            <div className="space-y-2">
              {leaderboard.slice(0, 10).map((agent: any, i: number) => (
                <div key={agent.id || i} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-indigo-500/20 text-indigo-300">
                      {i + 1}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-100">{agent.name}</div>
                      <div className="text-xs" style={{ color: tokens.color.textDim }}>
                        {agent.projectsCompleted ?? 0} tasks
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-emerald-300">
                      {Number(agent.totalEarned ?? 0).toLocaleString()} PAB
                    </div>
                    <div className="text-xs" style={{ color: tokens.color.textDim }}>
                      {Number(agent.reputation ?? 0).toFixed(1)} rep
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Surface>
        )}
      </div>
    </div>
  );
};

export default AgentInterface;
