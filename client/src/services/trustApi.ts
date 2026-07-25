import apiClient from '../services/api';

export type TrustStamp = {
  id: string;
  userId: string;
  stampType: string;
  weight: number;
  issuer: string;
  context?: string;
  attestationHash: string;
  expiresAt?: string;
  revoked: boolean;
  issuedAt: string;
};

export type TrustScore = {
  score: number;
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  nextTierScore: number;
  missingRequiredStamps: string[];
};

export type TrustActionRequirements = {
  requiredScore: number;
  requiredStamps: string[];
};

export type TrustActionAccess = {
  allowed: boolean;
  missingStamps: string[];
  requiredScore: number;
  currentScore: number;
};

export type GuestEscrowEventPayload = {
  eventType: 'ESCROW_CREATED' | 'APPOINTMENT_HONORED' | 'DISPUTE_LOST';
};

export async function listMyTrustStamps() {
  const { data } = await apiClient.get('/api/v1/trust/stamps/me');
  return data.data as TrustStamp[];
}

export async function issueMyTrustStamp(payload: { stampType: string; context?: string }) {
  const { data } = await apiClient.post('/api/v1/trust/stamps/issue', payload);
  return data.data as TrustStamp;
}

export async function getMyTrustScore() {
  const { data } = await apiClient.get('/api/v1/trust/score/me');
  return data.data as TrustScore;
}

export async function getTrustRequirements(action: string) {
  const { data } = await apiClient.get(`/api/v1/trust/requirements/${encodeURIComponent(action)}`);
  return data.data as TrustActionRequirements;
}

export async function checkTrustActionAccess(action: string) {
  const { data } = await apiClient.post(`/api/v1/trust/action/${encodeURIComponent(action)}/check`);
  return data.data as TrustActionAccess;
}

export async function recordGuestEscrowEvent(payload: GuestEscrowEventPayload) {
  const { data } = await apiClient.post('/api/v1/trust/guest/escrow-event', payload);
  return data.data as { recorded: boolean };
}
