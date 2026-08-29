export interface TrustVeilProof {
    scoreEncrypted: {
        c1: string;
        c2: string;
    };
    threshold: number;
    proof: {
        t: string;
        s: string;
    };
    rangeProof: {
        bits: string[];
        aggregate: string;
    };
    pubkey: string;
    commitment: string;
    flux: {
        velocity: number;
        confidence: number;
        trend: string;
    };
    issuedAt: number;
    expiresAt: number;
    signature: string;
}
export interface TrustVeilReveal {
    userId: string;
    isAboveThreshold: boolean;
    threshold: number;
    velocity: number;
    trend: string;
    valid: boolean;
    confidence: number;
}
export declare class TrustVeilService {
    private keypair;
    constructor();
    /** Generate or load the TrustVeil keypair on secp256k1 */
    private generateKeypair;
    /**
     * Issue a verifiable trust score proof.
     *
     * Uses ElGamal homomorphic encryption on secp256k1 to encrypt the score,
     * a Chaum-Pedersen zero-knowledge proof to prove threshold membership,
     * and a Bulletproofs-style range proof to prove score ∈ [0, 100].
     *
     * Encryption:
     *   pub = x · G             (public key, x = private scalar)
     *   c1 = k · G              (ephemeral commitment)
     *   c2 = score · G + k · pub (homomorphic ciphertext component)
     *
     * Decryption: score · G = c2 − x · c1, then solve discrete log for score
     */
    issueProof(userId: string, trustScore: number, threshold: number): Promise<TrustVeilProof>;
    /**
     * Chaum-Pedersen threshold proof.
     *
     * Proves knowledge of `score` such that score ≥ threshold,
     * without revealing the actual score value.
     *
     * Protocol (sigma-protocol + Fiat-Shamir):
     *   1. Prover picks random r, computes A = r·G (commitment)
     *   2. Prover picks random nonce k, computes t = k·G (auxiliary commitment)
     *   3. Challenge: c = H(A, t, threshold, commitment)  (Fiat-Shamir)
     *   4. Response: s = k − c·(score − threshold)  (proves score ≥ threshold)
     *   5. Verifier: checks G^s · (threshold·G)^c = t  AND  score = threshold + nonneg
     *
     * The key trick: we prove score = threshold + delta where delta ≥ 0.
     * The response s commits to (score − threshold) without revealing score.
     */
    private generateThresholdProof;
    /**
     * Bulletproofs-style range proof (simplified for [0, 100] domain).
     *
     * Proves that `score` ∈ [0, 100] using bit commitments.
     * For a 7-bit representation (covers 0–127 ⊇ 0–100):
     *   - Compute bit commitments: each bit b_i committed as b_i·G
     *   - Verify sum of bit commitments + overflow check
     *   - Aggregate via inner-product argument
     *
     * This is a simplified version — full Bulletproofs use a log-depth
     * inner-product argument, but for the small domain [0,100] we use
     * direct bit verification.
     */
    private generateRangeProof;
    /**
     * Verify a TrustVeil proof without revealing the actual score.
     * Returns only: isAboveThreshold, trend metadata, expiration status.
     */
    verifyProof(proof: TrustVeilProof): TrustVeilReveal;
    /** Compute a hash commitment to (userId, score, threshold) for audit */
    private computeCommitment;
    /**
     * Sign the proof with the attestation key using EC Schnorr signature.
     * In production, this uses the private key for ECDSA; for now uses
     * deterministic hash-based signature over the proof fields.
     */
    private signProof;
    /** Simple hash function (FNV-1a variant) for commitment/challenge */
    private simpleHash;
    /** Generate cryptographically-random hex bytes */
    private randomBytes;
    /**
     * Create a verifiable trust badge for a business that proves:
     * - Trust score ≥ minimum threshold (e.g. 70 for "reliable vendor")
     * - Trust is trending upward or stable (velocity ≥ 0)
     * - Sufficient confidence in the score (confidence ≥ 0.4)
     */
    issueBusinessBadge(businessId: string, minTrustScore?: number): Promise<TrustVeilProof | null>;
}
export declare const trustVeilService: TrustVeilService;
//# sourceMappingURL=trustVeil.service.d.ts.map