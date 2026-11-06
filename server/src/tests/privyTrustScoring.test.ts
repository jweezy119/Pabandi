import { describe, it, expect } from 'vitest';
import { evaluatePrivyTrustBand } from '../services/privyTrustScoring';
import { trustScoringConfig } from '../config/trust-scoring.config';

describe('evaluatePrivyTrustBand Pure Function', () => {
  it('assigns Band A when user has 4+ links including a phishing-resistant passkey', () => {
    const user = {
      id: 'did:privy:user1',
      linkedAccounts: [
        { type: 'email', address: 'alice@example.com' },
        { type: 'passkey' },
        { type: 'google_oauth' },
        { type: 'github_oauth' },
      ],
    };

    const result = evaluatePrivyTrustBand(user, trustScoringConfig);
    expect(result.band).toBe('A');
    expect(result.score).toBe(90.0);
    expect(result.hasPhishingResistant).toBe(true);
    expect(result.totalLinks).toBe(4);
  });

  it('assigns Band A when user has 4+ links including a verified phone', () => {
    const user = {
      id: 'did:privy:user2',
      linkedAccounts: [
        { type: 'email', address: 'bob@example.com' },
        { type: 'phone', number: '+13125550199' },
        { type: 'google_oauth' },
        { type: 'wallet', address: 'So11111111111111111111111111111111111111112' },
      ],
    };

    const result = evaluatePrivyTrustBand(user, trustScoringConfig);
    expect(result.band).toBe('A');
    expect(result.score).toBe(90.0);
    expect(result.hasPhishingResistant).toBe(true);
  });

  it('assigns Band B when user has 3 links including an OAuth provider but no phishing-resistant method', () => {
    const user = {
      id: 'did:privy:user3',
      linkedAccounts: [
        { type: 'email', address: 'carol@example.com' },
        { type: 'google_oauth' },
        { type: 'wallet', address: 'So11111111111111111111111111111111111111112' },
      ],
    };

    const result = evaluatePrivyTrustBand(user, trustScoringConfig);
    expect(result.band).toBe('B');
    expect(result.score).toBe(75.0);
    expect(result.hasOAuth).toBe(true);
    expect(result.hasPhishingResistant).toBe(false);
  });

  it('assigns Band C when user has at least 1 verified link beyond email', () => {
    const user = {
      id: 'did:privy:user4',
      linkedAccounts: [
        { type: 'email', address: 'dave@example.com' },
        { type: 'wallet', address: 'So11111111111111111111111111111111111111112' },
      ],
    };

    const result = evaluatePrivyTrustBand(user, trustScoringConfig);
    expect(result.band).toBe('C');
    expect(result.score).toBe(55.0);
    expect(result.nonEmailLinks).toBe(1);
  });

  it('assigns Band D for email-only accounts', () => {
    const user = {
      id: 'did:privy:user5',
      linkedAccounts: [{ type: 'email', address: 'eve@example.com' }],
    };

    const result = evaluatePrivyTrustBand(user, trustScoringConfig);
    expect(result.band).toBe('D');
    expect(result.score).toBe(25.0);
    expect(result.totalLinks).toBe(1);
  });

  it('assigns Band D for anonymous / empty accounts', () => {
    const user = {
      id: 'did:privy:user6',
      linkedAccounts: [],
    };

    const result = evaluatePrivyTrustBand(user, trustScoringConfig);
    expect(result.band).toBe('D');
    expect(result.score).toBe(25.0);
    expect(result.totalLinks).toBe(0);
  });
});
