import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const API_HOST = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API_BASE_URL = `${API_HOST}/api/v1`;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ═══════════════════════════════════════════════════════════════════════════
// Protocol Service — Staking, Escrow, Agents, Security
// ═══════════════════════════════════════════════════════════════════════════

export const protocolService = {
  // ── Protocol Stats ─────────────────────────────────────────────────────
  getStats: () => apiClient.get('/security/stats'),

  // ── Staking ───────────────────────────────────────────────────────────
  getStakingStatus: () => apiClient.get('/pab-staking/status'),
  getStakingTiers: () => apiClient.get('/pab-staking/tiers'),
  stake: (tier: string) => apiClient.post('/pab-staking/stake', { tier }),
  unstake: (stakingId: string) => apiClient.post('/pab-staking/unstake', { stakingId }),

  // ── Escrow ────────────────────────────────────────────────────────────
  createEscrow: (payload: any) => apiClient.post('/escrow', payload),
  getEscrow: (id: string) => apiClient.get(`/escrow/${id}`),
  fundEscrow: (id: string) => apiClient.post(`/escrow/${id}/fund`),
  releaseEscrow: (id: string) => apiClient.post(`/escrow/${id}/release`),
  disputeEscrow: (id: string) => apiClient.post(`/escrow/${id}/dispute`),
  listEscrows: (email: string) => apiClient.get('/escrow', { params: { email } }),

  // ── Agents ────────────────────────────────────────────────────────────
  getAgentProfile: (agentId: string) => apiClient.get(`/agent-marketplace/${agentId}`),
  registerAgent: (payload: any) => apiClient.post('/agent-marketplace/register', payload),
  completeTask: (agentId: string, taskData: any) => apiClient.post(`/agent-marketplace/${agentId}/complete`, taskData),
  getAgentEarnings: (agentId: string) => apiClient.get(`/agent-marketplace/${agentId}/earnings`),

  // ── Security (Jev) ───────────────────────────────────────────────────
  checkTransaction: (payload: any) => apiClient.post('/security/check-transaction', payload),
  checkAgent: (agentId: string, payload: any) => apiClient.post(`/security/check-agent/${agentId}`, payload),
  checkAnomaly: (payload: any) => apiClient.post('/security/check-anomaly', payload),
};
