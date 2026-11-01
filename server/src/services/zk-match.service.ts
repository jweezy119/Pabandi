import crypto from 'crypto';

export interface ZKCommitment {
  commitment: string; // SHA-256 hash of (score + budget + agentId + salt)
  nullifier: string; // unique hash to prevent double-bidding
  agentId: string;
  jobId: string;
  salt: string;
  claimedScore: number; // the agent claims their score is >= 80
  claimedBudget: number; // claimed budget matches the job
}

export interface ZKProof {
  commitment: string;
  nullifier: string;
  verified: boolean;
  scoreAtLeast80: boolean;
  budgetMatches: boolean;
  nullifierUnused: boolean;
  proofData?: any; // mock ZK proof data
}

export class ZKMatchService {
  private usedNullifiers: Set<string> = new Set();

  /**
   * Create a commitment hash from agent's private data.
   * commitment = SHA-256(score + budget + agentId + salt)
   */
  createCommitment(
    score: number,
    budget: number,
    agentId: string,
    salt?: string,
  ): { commitment: string; nullifier: string; salt: string } {
    const s = salt || crypto.randomBytes(16).toString('hex');
    const commitment = crypto
      .createHash('sha256')
      .update(`${score}:${budget}:${agentId}:${s}`)
      .digest('hex');

    // Nullifier = SHA-256(agentId + jobId + salt) - prevents reuse
    const nullifier = crypto
      .createHash('sha256')
      .update(`${agentId}:${s}`)
      .digest('hex');

    return { commitment, nullifier, salt: s };
  }

  /**
   * Verify a ZK proof (mock implementation).
   * In production, this would verify a snarkjs/groth16 proof on-chain.
   * Here we verify:
   * 1. The commitment can be opened to reveal score >= 80 and budget match
   * 2. The nullifier hasn't been used before
   */
  verifyProof(
    commitment: string,
    nullifier: string,
    agentId: string,
    jobId: string,
    expectedBudget: number,
    salt: string,
    claimedScore: number,
    claimedBudget: number,
  ): ZKProof {
    // Recompute commitment to verify it matches
    const recomputedCommitment = crypto
      .createHash('sha256')
      .update(`${claimedScore}:${claimedBudget}:${agentId}:${salt}`)
      .digest('hex');

    const commitmentMatches = recomputedCommitment === commitment;

    // Verify score >= 80 (the ZK claim)
    const scoreAtLeast80 = claimedScore >= 80;

    // Verify budget matches the job
    const budgetMatches = claimedBudget === expectedBudget;

    // Verify nullifier hasn't been used
    const nullifierUnused = !this.usedNullifiers.has(nullifier);

    const verified = commitmentMatches && scoreAtLeast80 && budgetMatches && nullifierUnused;

    if (verified) {
      // Mark nullifier as used to prevent double-bidding
      this.usedNullifiers.add(nullifier);
    }

    return {
      commitment,
      nullifier,
      verified,
      scoreAtLeast80,
      budgetMatches,
      nullifierUnused,
      proofData: {
        commitment,
        nullifier,
        verified,
        mockZK: true,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Check if a nullifier has already been used.
   */
  isNullifierUsed(nullifier: string): boolean {
    return this.usedNullifiers.has(nullifier);
  }
}

export const zkMatchService = new ZKMatchService();
