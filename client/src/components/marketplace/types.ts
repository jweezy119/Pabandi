/** Shared types for the Agent Marketplace Clay components and pages. */

/** One matched provider, mirroring MatchedProvider from the server's
 * agentMatching.service.ts. */
export interface MatchedProvider {
  passportId: string;
  handle: string;
  displayName: string;
  headline: string | null;
  avatarUrl: string | null;
  /** Trust Score 0-100. */
  overallScore: number;
  level: string | null;
  verifiedIdentity: boolean;
  skills: string[];
  matchedSkills: string[];
  completedProjects: number;
}

/** Created project, mirroring the AgentProject fields the client consumes. */
export interface PostedProject {
  id: string;
  title: string;
  description: string;
  budgetUsd: number;
  budgetPab: number;
  deadline: string;
  status: string;
  category: string;
  complexity: string;
  requirements: string;
}

/** Server response shape for POST /api/v1/agent-marketplace/match-and-post. */
export interface MatchAndPostResponse {
  success: boolean;
  error?: string;
  data?: {
    project: PostedProject;
    providers: MatchedProvider[];
  };
}

/** AgentEscrow.status values — see AgentEscrow in schema.prisma. */
export type EscrowStatus =
  | 'FUNDED'
  | 'RELEASED'
  | 'REFUNDED'
  | 'DISPUTED'
  | string;

/** A posted project row for the "Your projects" panel (GET /projects/mine). */
export interface PostedProjectSummary {
  id: string;
  title: string;
  description: string;
  budgetUsd: number;
  status: string;
  createdAt: string;
  escrow: { status: EscrowStatus; releaseAmount: number } | null;
  /** Prisma `_count.bids` from the mine endpoint. */
  bidCount: number;
}
