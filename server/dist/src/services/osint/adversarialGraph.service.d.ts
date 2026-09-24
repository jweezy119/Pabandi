/**
 * AdversarialGraphService — "Threat Constellation Mapping"
 * ────────────────────────────────────────────────────────────────────────────
 * Most fraud platforms only flag individual bad actors. Pabandi maps ENTIRE
 * FRAUD NETWORKS as directed graphs (constellations) and predicts future
 * node activations before they happen.
 *
 * Architecture:
 *   Node Types:
 *     - IDENTITY  (username, email, phone)
 *     - WALLET    (crypto address)
 *     - DOMAIN    (merchant website)
 *     - DEVICE    (fingerprint hash)
 *     - IP_RANGE  (ASN/CIDR block)
 *
 *   Edge Types:
 *     - CO_OCCURRENCE     (appeared in same transaction window)
 *     - FINANCIAL_FLOW    (funds moved between wallets)
 *     - INFRASTRUCTURE    (same hosting, DNS, or SSL cert)
 *     - BEHAVIORAL_CLONE  (identical interaction patterns)
 *
 *   Algorithm:
 *     1. Seed graph from initial flagged entity (from Shadow Escrow or OSINT MCP)
 *     2. BFS expansion: query Maigret, Shodan, WHOIS, VirusTotal for each node
 *     3. Edge weighting: temporal decay + evidence strength
 *     4. Community detection: Louvain modularity on the weighted graph
 *     5. Predictive activation: Markov chain on historical community reactivation
 *     6. Contagion scoring: if >30% of a community is flagged, unflagged nodes
 *        receive a "contagion risk" penalty
 *
 * This turns Pabandi from "catching one scammer" into "dismantling entire rings."
 */
export interface GraphNode {
    id: string;
    type: 'IDENTITY' | 'WALLET' | 'DOMAIN' | 'DEVICE' | 'IP_RANGE';
    label: string;
    riskScore: number;
    flagged: boolean;
    discoveredAt: number;
    metadata: Record<string, any>;
}
export interface GraphEdge {
    source: string;
    target: string;
    type: 'CO_OCCURRENCE' | 'FINANCIAL_FLOW' | 'INFRASTRUCTURE' | 'BEHAVIORAL_CLONE';
    weight: number;
    evidence: string;
    discoveredAt: number;
}
export interface ConstellationReport {
    constellationId: string;
    seedEntity: string;
    totalNodes: number;
    totalEdges: number;
    communities: Community[];
    contagionNodes: ContagionNode[];
    predictedActivations: PredictedActivation[];
    threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    generatedAt: string;
}
export interface Community {
    id: string;
    nodes: string[];
    flaggedRatio: number;
    avgRiskScore: number;
    label: string;
}
export interface ContagionNode {
    nodeId: string;
    nodeLabel: string;
    contagionScore: number;
    nearestFlaggedNode: string;
    hops: number;
}
export interface PredictedActivation {
    nodeId: string;
    nodeLabel: string;
    probabilityOfActivation: number;
    estimatedWindow: string;
    reasoning: string;
}
export declare class AdversarialGraphService {
    private nodes;
    private edges;
    /**
     * Build a threat constellation from a seed entity.
     * Performs BFS expansion using OSINT MCP tools to discover connected entities.
     */
    buildConstellation(seedId: string, seedType: GraphNode['type'], seedLabel: string, maxDepth?: number): Promise<ConstellationReport>;
    /**
     * Expand a node by querying relevant OSINT MCP tools based on node type.
     * Returns newly discovered nodes and their connecting edges.
     */
    private expandNode;
    /**
     * Community detection using a simplified Louvain modularity algorithm.
     * Groups tightly-connected nodes into communities (fraud rings).
     */
    private detectCommunities;
    /**
     * Contagion scoring: unflagged nodes that are close to flagged nodes
     * receive a "guilt by association" risk penalty.
     *
     * Uses BFS from each flagged node, with exponential decay per hop.
     */
    private computeContagion;
    /**
     * Predict future node activations using Markov chain transition probabilities.
     * Nodes in communities with high flagged ratios are likely to activate next.
     */
    private predictActivations;
    /**
     * Assess overall threat level of a constellation.
     */
    private assessThreatLevel;
    private addNode;
    private addEdge;
    private pseudoHash;
}
export declare const adversarialGraphService: AdversarialGraphService;
//# sourceMappingURL=adversarialGraph.service.d.ts.map