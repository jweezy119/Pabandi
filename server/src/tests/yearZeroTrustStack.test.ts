import { describe, it, expect } from 'vitest';
import { evaluatePrivyTrustBand } from '../services/privyTrustScoring';
import {
  computeBayesianColdStartScore,
  evaluateRegionalFprParity,
  evaluateShadowModeBatch,
  generateCounterfactualRecourse,
} from '../services/trustGovernance.service';
import {
  createSignedTrustAttestation,
  verifySignedTrustAttestation,
} from '../services/signedAttestation.service';
import {
  issueSdJwtTrustCredential,
  selectSdJwtClaims,
  verifySdJwtPresentation,
} from '../services/sdJwtCredential.service';
import {
  buildPrivySolanaEscrowPolicyPayload,
  executePrivyAgentEscrowSpend,
  SOLANA_USDC_MINT,
} from '../services/privyAgentPolicyWallet.service';
import { TOOLS } from '../mcp/pabandiMcpServer';

describe('Year-0 Trust Stack — 1. ML Governance & Counterfactual Recourse', () => {
  it('computes a Bayesian cold-start score and attribution vector for a new user', () => {
    const evaluation = evaluatePrivyTrustBand({
      id: 'did:privy:user-cold',
      linkedAccounts: [
        { type: 'email' },
        { type: 'google_oauth' },
        { type: 'passkey' },
      ],
    });

    const { bayesianScore, attribution } = computeBayesianColdStartScore({
      evaluation,
      completedEscrows: 0,
    });

    expect(bayesianScore).toBeGreaterThan(50);
    expect(attribution.basePrior).toBe(22.5);
    expect(attribution.phishingResistantContribution).toBeGreaterThan(0);
    expect(attribution.oauthContribution).toBeGreaterThan(0);
  });

  it('generates actionable counterfactual recourse for Band D, C, B, and A', () => {
    const bandD = evaluatePrivyTrustBand({
      id: 'did:privy:d',
      linkedAccounts: [{ type: 'email' }],
    });
    const recourseD = generateCounterfactualRecourse(bandD);
    expect(recourseD.currentBand).toBe('D');
    expect(recourseD.targetBand).toBe('C');
    expect(recourseD.steps.length).toBeGreaterThan(0);

    const bandC = evaluatePrivyTrustBand({
      id: 'did:privy:c',
      linkedAccounts: [{ type: 'email' }, { type: 'wallet' }],
    });
    const recourseC = generateCounterfactualRecourse(bandC);
    expect(recourseC.currentBand).toBe('C');
    expect(recourseC.targetBand).toBe('B');
    expect(recourseC.summary).toMatch(/OAuth/i);

    const bandB = evaluatePrivyTrustBand({
      id: 'did:privy:b',
      linkedAccounts: [{ type: 'email' }, { type: 'google_oauth' }, { type: 'github' }],
    });
    const recourseB = generateCounterfactualRecourse(bandB);
    expect(recourseB.currentBand).toBe('B');
    expect(recourseB.targetBand).toBe('A');
    expect(recourseB.summary).toMatch(/Passkey|phone/i);

    const bandA = evaluatePrivyTrustBand({
      id: 'did:privy:a',
      linkedAccounts: [
        { type: 'email' },
        { type: 'google_oauth' },
        { type: 'github' },
        { type: 'passkey' },
      ],
    });
    const recourseA = generateCounterfactualRecourse(bandA);
    expect(recourseA.currentBand).toBe('A');
    expect(recourseA.targetBand).toBeNull();
    expect(recourseA.steps).toHaveLength(0);
  });

  it('checks regional FPR parity between Chicago and Lahore', () => {
    const balancedSamples = [
      { region: 'Chicago', actualGoodOutcome: true, predictedHighRisk: false },
      { region: 'Chicago', actualGoodOutcome: true, predictedHighRisk: false },
      { region: 'Lahore', actualGoodOutcome: true, predictedHighRisk: false },
      { region: 'Lahore', actualGoodOutcome: true, predictedHighRisk: false },
    ];
    const passResult = evaluateRegionalFprParity(balancedSamples);
    expect(passResult.passesParity).toBe(true);
    expect(passResult.absoluteGap).toBe(0);

    const biasedSamples = [
      { region: 'Chicago', actualGoodOutcome: true, predictedHighRisk: false },
      { region: 'Lahore', actualGoodOutcome: true, predictedHighRisk: true },
    ];
    const failResult = evaluateRegionalFprParity(biasedSamples);
    expect(failResult.passesParity).toBe(false);
    expect(failResult.absoluteGap).toBe(1);
  });

  it('enforces shadow-mode drift and Band A rank-order preservation gates', () => {
    const cleanBatch = [
      { principalId: 'u1', productionScore: 92, shadowScore: 91, isBandA: true },
      { principalId: 'u2', productionScore: 85, shadowScore: 84, isBandA: true },
    ];
    expect(evaluateShadowModeBatch(cleanBatch).passesPromotionGate).toBe(true);

    const invertedBatch = [
      { principalId: 'u1', productionScore: 92, shadowScore: 80, isBandA: true },
      { principalId: 'u2', productionScore: 85, shadowScore: 88, isBandA: true },
    ];
    const invertedResult = evaluateShadowModeBatch(invertedBatch);
    expect(invertedResult.rankOrderPreserved).toBe(false);
    expect(invertedResult.passesPromotionGate).toBe(false);
  });
});

describe('Year-0 Trust Stack — 2. Lightweight Ed25519 Signed Attestation', () => {
  it('signs and verifies the (ModelHash, InputHash, Score, Band, SHAPHash) tuple', () => {
    const evaluation = evaluatePrivyTrustBand({
      id: 'did:privy:test-1',
      linkedAccounts: [
        { type: 'email' },
        { type: 'google_oauth' },
        { type: 'github' },
        { type: 'passkey' },
      ],
    });
    const { attribution } = computeBayesianColdStartScore({ evaluation });

    const attestation = createSignedTrustAttestation({
      subjectId: 'user-123',
      evaluation,
      attribution,
    });

    expect(attestation.algorithm).toBe('Ed25519');
    expect(attestation.payload.trustBand).toBe('A');
    expect(attestation.payload.predictedScore).toBe(90);

    const verified = verifySignedTrustAttestation(attestation);
    expect(verified.valid).toBe(true);
  });

  it('rejects an attestation if the score or SHAP commitment is tampered with', () => {
    const evaluation = evaluatePrivyTrustBand({
      id: 'did:privy:test-2',
      linkedAccounts: [{ type: 'email' }],
    });
    const { attribution } = computeBayesianColdStartScore({ evaluation });

    const attestation = createSignedTrustAttestation({
      subjectId: 'user-456',
      evaluation,
      attribution,
    });

    const tamperedScore = {
      ...attestation,
      payload: { ...attestation.payload, predictedScore: 95 },
    };
    expect(verifySignedTrustAttestation(tamperedScore).valid).toBe(false);

    const tamperedCanonical = {
      ...attestation,
      canonicalTuple: attestation.canonicalTuple.replace('||25.00||', '||95.00||'),
      payload: { ...attestation.payload, predictedScore: 95 },
    };
    expect(verifySignedTrustAttestation(tamperedCanonical).valid).toBe(false);
  });
});

describe('Year-0 Trust Stack — 3. Selective Disclosure Credentials (SD-JWT)', () => {
  it('issues an SD-JWT and verifies a minimal selective presentation without leaking hidden claims', () => {
    const evaluation = evaluatePrivyTrustBand({
      id: 'did:privy:test-sd',
      linkedAccounts: [
        { type: 'email' },
        { type: 'google_oauth' },
        { type: 'github' },
        { type: 'passkey' },
      ],
    });

    const credential = issueSdJwtTrustCredential({
      subjectId: 'user-sd-1',
      evaluation,
    });

    // Verify minimal presentation (reveals only trust_band, zero_deposit_eligible, score_gte_75)
    const verifiedMinimal = verifySdJwtPresentation(credential.minimalPresentation);
    expect(verifiedMinimal.valid).toBe(true);
    expect(verifiedMinimal.disclosedClaims).toEqual({
      trust_band: 'A',
      zero_deposit_eligible: true,
      score_gte_75: true,
    });
    // Hidden claims (exact_score, total_links) are NOT disclosed in minimal presentation
    expect(verifiedMinimal.disclosedClaims?.exact_score).toBeUndefined();
    expect(verifiedMinimal.disclosedClaims?.total_links).toBeUndefined();

    // Holder can also select a single predicate claim
    const singlePredicate = selectSdJwtClaims(credential, ['zero_deposit_eligible']);
    const verifiedSingle = verifySdJwtPresentation(singlePredicate);
    expect(verifiedSingle.valid).toBe(true);
    expect(verifiedSingle.disclosedClaims).toEqual({ zero_deposit_eligible: true });
  });

  it('rejects a forged or unanchored disclosure in an SD-JWT presentation', () => {
    const evaluation = evaluatePrivyTrustBand({
      id: 'did:privy:test-sd-2',
      linkedAccounts: [{ type: 'email' }],
    });

    const credential = issueSdJwtTrustCredential({
      subjectId: 'user-sd-2',
      evaluation,
    });

    const forgedDisclosure = Buffer.from(
      JSON.stringify(['fake-salt', 'zero_deposit_eligible', true]),
      'utf8'
    ).toString('base64url');

    const forgedPresentation = `${credential.issuerJwt}~${forgedDisclosure}~`;
    const verified = verifySdJwtPresentation(forgedPresentation);
    expect(verified.valid).toBe(false);
    expect(verified.reason).toMatch(/does not match any signed _sd commitment/i);
  });
});

describe('Phase 3 — Privy TEE Policy-Enforced Agent Wallets & MCP Tools', () => {
  it('builds a DENY-by-default Privy TEE Solana policy restricting USDC mint, max per-tx base units, and expiry', () => {
    const { policyPayload, maxPerTransactionBaseUnits } = buildPrivySolanaEscrowPolicyPayload({
      ownerUserId: 'user-tee-1',
      agentName: 'Roofing Concierge Agent',
      maxPerTransactionUsdc: 250,
      dailyBudgetUsdc: 500,
      expiresInHours: 24,
    });

    expect(policyPayload.version).toBe('1.0');
    expect(policyPayload.chain_type).toBe('solana');
    expect(policyPayload.default_action).toBe('DENY');
    expect(maxPerTransactionBaseUnits).toBe('250000000');
    expect(policyPayload.rules.length).toBe(2);
    expect(policyPayload.rules[0].conditions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field_source: 'solana_token_transfer_instruction',
          field: 'mint',
          operator: 'eq',
          value: SOLANA_USDC_MINT,
        }),
        expect.objectContaining({
          field_source: 'solana_token_transfer_instruction',
          field: 'amount',
          operator: 'lte',
          value: '250000000',
        }),
      ])
    );
  });

  it('enforces Guardrail #3: refuses agent wallet spend without a bound Privy policy_id', async () => {
    await expect(
      executePrivyAgentEscrowSpend({
        agentWalletId: 'wal_123',
        policyId: '',
        amountUsdc: 50,
        unsignedTransactionBase64: 'AAAA',
      })
    ).rejects.toThrow(/Guardrail #3/i);
  });

  it('publishes Year-0 trust and contractor escrow tools on the MCP server', () => {
    const names = (TOOLS as Array<{ name: string }>).map((t) => t.name);
    expect(names).toContain('pabandi_verify_sd_jwt');
    expect(names).toContain('pabandi_verify_ed25519_receipt');
    expect(names).toContain('pabandi_book_contractor_escrow');
  });
});
