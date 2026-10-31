import { prisma } from '../utils/database';
import { AGENT_MARKETPLACE_FEE } from '../config/fees';
import { PAB_USD_PRICE } from '../config/tokenomics';
import { TEMPLATE_BY_KEY } from '../config/agentTemplates';
import type { Prisma } from '@prisma/client';
import { trustCore } from '../trust/trust-core';
import { findMatchedProviders, type MatchedProvider } from './agentMatching.service';
import { squareService } from './squareCheckout.service';
import { agentEscrowNote } from './square-connection.service';

const PLATFORM_FEE_USD = AGENT_MARKETPLACE_FEE; // 2% total, from config/fees
const PAB_REWARD_RATE = 0.05;  // 5% PAB reward on both sides
const SOL_FEE_RATE = 0.001;    // 0.1% SOL fee (simulated)

/**
 * Real-money mode. While a rail key is absent, escrow rows are the ledger for
 * a simulated flow (status FUNDED at accept time); the platform fee earned is
 * accounting, not cash. When SQUARE_ACCESS_TOKEN exists, acceptBid defers the
 * FUNDED state until the poster's card payment actually lands via the Square
 * webhook — the fee becomes real revenue instead of a number nobody collected.
 */
const realMoneyEnabled = () => Boolean((process.env.SQUARE_ACCESS_TOKEN || '').trim());

/** Checkout redirect target after funding (or abandoning) an escrow. */
const escrowCheckoutUrls = (escrowId: string) => {
  const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
  return {
    successUrl: `${frontend}/agent-marketplace?escrow_funded=${escrowId}`,
    cancelUrl: `${frontend}/agent-marketplace?escrow_cancelled=${escrowId}`,
  };
};

/**
 * A Square hosted-checkout URL that funds this escrow. Fresh payment links
 * each call, so an expired or abandoned one never blocks funding once a
 * project is live. The note carries the escrow id on the house's
 * `pabandi:agentescrow:` scheme — it is what the Square webhook matches the
 * payment back to this escrow with, exactly, no amount-guessing.
 */
const createEscrowCheckout = async (escrow: { id: string; totalAmount: number }): Promise<string> => {
  const { successUrl, cancelUrl } = escrowCheckoutUrls(escrow.id);
  const checkout = await squareService.createCheckout({
    referenceId: escrow.id,
    amount: Math.round(escrow.totalAmount * 100),
    currency: 'USD',
    redirectUrl: successUrl,
    cancelUrl,
    note: agentEscrowNote(escrow.id),
  });
  return checkout.url;
};

export class AgentMarketplace {

  /**
   * Register a new AI agent
   */
  async registerAgent(params: {
    name: string;
    slug: string;
    description: string;
    capabilities: string[];
    walletAddress?: string;
    publicKey?: string;
    reputation?: number;
  }) {
    // Generate a real Solana wallet for the agent
    const { Keypair } = await import('@solana/web3.js');
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey.toBase58();
    const secretKey = Buffer.from(keypair.secretKey).toString('base64');
    
    // Encrypt the secret key
    const crypto = await import('crypto');
    const ALGORITHM = 'aes-256-gcm';
    const IV_LENGTH = 16;
    const encKeyStr = process.env.WALLET_ENC_KEY;
    const encKey = encKeyStr ? Buffer.from(encKeyStr, 'hex') : crypto.scryptSync(process.env.JWT_SECRET || 'fallback', 'salt', 32);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, encKey, iv);
    let encrypted = cipher.update(secretKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    const encryptedSecret = iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;

    // Create agent with wallet
    const agent = await prisma.agentProfile.create({
      data: {
        name: params.name,
        slug: params.slug,
        description: params.description,
        capabilities: params.capabilities,
        walletAddress: publicKey,
        publicKey: publicKey,
        reputation: params.reputation || 50,
      },
    });

    // Create encrypted agent wallet
    await prisma.agentWallet.create({
      data: {
        agentId: agent.id,
        publicKey,
        encryptedSecret,
        balanceUsdc: 0,
      },
    });

    return agent;
  }

  /**
   * Post a project
   */
  async postProject(params: {
    title: string;
    description: string;
    requirements: string;
    posterId: string;
    budgetUsd: number;
    deadline: Date;
    category: string;
    complexity: string;
    deliverableHash?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const pabPrice = PAB_USD_PRICE;
    return prisma.agentProject.create({
      data: {
        ...params,
        deliverableHash: params.deliverableHash ?? undefined,
        metadata: params.metadata
          ? (params.metadata as Prisma.InputJsonValue)
          : undefined,
        budgetPab: params.budgetUsd / pabPrice,
        status: 'OPEN',
      },
    });
  }

  /**
   * Post a project AND return the best-matched providers for it.
   *
   * Used by POST /agent-marketplace/match-and-post: the client posts once and
   * gets back both the created AgentProject and the top Trust-Score-ranked
   * TrustPassport holders whose skills overlap the project's requirements.
   * Defaults here are deliberate: the minimal payload the client sends is
   * title / description / budget / requiredSkills — deadline falls 14 days
   * out, complexity stays MEDIUM, and the requirements field carries the
   * required skills (that is what the field means for agent honeypots).
   */
  async matchAndPost(params: {
    title: string;
    description: string;
    budget: number;
    requiredSkills: string[];
    posterId: string;
    deadline?: Date;
    category?: string;
    complexity?: string;
    /** Optional template applied when a caller posts through a catalog key. */
    templateKey?: string;
    /** Poster opt-in: verified agents (identity + score ≥ 70) may book directly
     * and the escrow funds itself without the poster pressing accept. */
    autoBook?: boolean;
  }): Promise<{ project: Awaited<ReturnType<AgentMarketplace['postProject']>>; providers: MatchedProvider[] }> {
    // Template merge: caller-supplied fields win; template fields fill the
    // gaps (description, skills, complexity). A template is a starting draft,
    // not an override.
    const template = params.templateKey ? TEMPLATE_BY_KEY.get(params.templateKey) : undefined;

    const project = await this.postProject({
      title: params.title || template?.title || 'Untitled project',
      description:
        params.description ||
        template?.description ||
        'No description provided.',
      requirements: (params.requiredSkills.length ? params.requiredSkills : template?.requiredSkills ?? []).join(', '),
      posterId: params.posterId,
      budgetUsd: params.budget,
      deadline: params.deadline ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      category: params.category ?? 'AGENT_BOUNTY',
      complexity: params.complexity ?? template?.complexity ?? 'MEDIUM',
      metadata: {
        ...(params.autoBook ? { autoBook: true } : {}),
        ...(template ? { templateKey: template.key, deliverables: template.deliverables } : {}),
      },
    });

    const providers = await findMatchedProviders(params.requiredSkills);
    return { project, providers };
  }

  /**
   * Resolve or create the posting client's marketplace profile.
   * AgentProject.poster is an AgentProfile, but match-and-post callers are
   * ordinary signed-in users. The profiles have no user FK, so the bridge is
   * the stable slug convention `client-<userId>` — created on first post with
   * placeholder wallet fields (no on-chain identity exists yet), reused after.
   */
  async ensurePosterProfile(userId: string, displayName: string): Promise<{ id: string }> {
    const slug = `client-${userId}`;
    const existing = await prisma.agentProfile.findUnique({ where: { slug } });
    if (existing) return existing;
    return prisma.agentProfile.create({
      data: {
        name: displayName,
        slug,
        description: 'Client posting projects through the agent marketplace.',
        capabilities: [],
        walletAddress: '',
        publicKey: '',
        reputation: 0,
        metadata: { kind: 'client-poster', userId },
      },
    });
  }

  async placeBid(params: {
    projectId: string;
    bidderId: string;
    proposedAmount: number;
    timelineHours: number;
    approach: string;
  }) {
    const pabPrice = PAB_USD_PRICE;
    return prisma.agentProjectBid.create({
      data: {
        ...params,
        proposedPab: params.proposedAmount / pabPrice,
        status: 'PENDING',
      },
    });
  }

  /**
   * Direct hire from a Trust-Score match.
   *
   * The hire flow for the ProviderCard: the poster picks a matched passport,
   * the server creates a full-budget bid on the provider's behalf and then
   * runs the SAME acceptBid path a normal bid acceptance takes. One escrow
   * implementation for both flows means "Hire" cannot fund money differently
   * from "Accept bid".
   *
   * actorId is the signed-in USER id, not the AgentProfile id: clients never
   * hold agent identities. The poster profile is resolved with the same
   * `client-<userId>` slug convention match-and-post bridges with, and the
   * project ownership check inside acceptBid runs against it. A user who has
   * never posted has no client profile — that fails the check, which is the
   * correct outcome.
   */
  async hireProvider(projectId: string, passportId: string, actorUserId: string) {
    const client = await prisma.agentProfile.findUnique({
      where: { slug: `client-${actorUserId}` },
      select: { id: true },
    });
    if (!client) throw new Error('Not authorised to hire on this project');

    const project = await prisma.agentProject.findUnique({ where: { id: projectId } });
    if (!project) throw new Error('Project not found');
    if (project.posterId !== client.id) {
      throw new Error('Not authorised to hire on this project');
    }
    if (project.status !== 'OPEN') {
      throw new Error('Project is not open for hire');
    }

    const passport = await prisma.trustPassport.findUnique({ where: { id: passportId } });
    if (!passport) throw new Error('Provider passport not found');

    const provider = await this.ensureProviderProfile(passport);

    // Full-budget direct-hire bid. The provider never bid, so their price is
    // the posted budget — the poster decided it when they posted.
    const bid = await this.placeBid({
      projectId,
      bidderId: provider.id,
      proposedAmount: project.budgetUsd,
      timelineHours: 14 * 24,
      approach: 'Direct hire via Trust-Score match',
    });

    const { escrow, checkoutUrl } = await this.acceptBid(bid.id, client.id);

    // Remember which passport was hired — metadata, not a listed field.
    const updated = await prisma.agentProject.update({
      where: { id: projectId },
      data: { metadata: { hiredPassport: passportId } },
      select: { id: true, status: true, escrowId: true },
    });

    return { project: { ...updated, hiredPassport: passportId }, escrow, checkoutUrl };
  }

  /**
   * Resolve or create the marketplace AgentProfile behind a TrustPassport.
   * Real agents register with a wallet; passport-only providers are bridged
   * with the stable slug convention `provider-<passportId>`.
   */
  async ensureProviderProfile(passport: {
    id: string;
    displayName: string;
    headline: string | null;
    walletAddress: string | null;
    skills: unknown;
    score: number | null;
    handle: string;
  }) {
    if (passport.walletAddress) {
      const byWallet = await prisma.agentProfile.findFirst({
        where: { walletAddress: passport.walletAddress },
      });
      if (byWallet) return byWallet;
    }
    const slug = `provider-${passport.id}`;
    const bySlug = await prisma.agentProfile.findUnique({ where: { slug } });
    if (bySlug) return bySlug;
    return prisma.agentProfile.create({
      data: {
        name: passport.displayName,
        slug,
        description: passport.headline || 'Agent marketplace provider',
        capabilities: Array.isArray(passport.skills)
          ? passport.skills.filter((s): s is string => typeof s === 'string')
          : [],
        walletAddress: passport.walletAddress ?? '',
        publicKey: passport.walletAddress ?? '',
        reputation: passport.score ?? 0,
        metadata: { kind: 'trust-passport-provider', passportId: passport.id, handle: passport.handle },
      },
    });
  }

  /**
   * Provider identity: signed-in user → their TrustPassport → AgentProfile.
   *
   * Providers are passport holders, and TrustPassport.userId is the honest
   * link (each user owns at most one passport). Bridge profiles reuse the
   * ensureProviderProfile wallet/slug resolution so a passport that later
   * registers a real agent wallet keeps the same marketplace identity.
   */
  async resolveProviderProfile(userId: string) {
    const passport = await prisma.trustPassport.findUnique({ where: { userId } });
    if (!passport) throw new Error('No provider passport linked to this account');
    const profile = await this.ensureProviderProfile(passport);
    return { profile, passport };
  }

  /**
   * Provider workspace payload ("Your work").
   *
   * assigned: won, escrow-funded projects, newest first — the work an agent
   * has actually been booked for. openFeed: open projects the provider could
   * still book, excluding (a) projects they already bid on and (b) their own
   * postings — a booking feed, not a noise feed.
   */
  async getMyWork(userId: string) {
    const { profile } = await this.resolveProviderProfile(userId);

    const bids = await prisma.agentProjectBid.findMany({
      where: { bidderId: profile.id, isWinning: true },
      include: { project: { include: { escrow: true } } },
      orderBy: { submittedAt: 'desc' },
      take: 20,
    });

    const assigned = bids
      .filter((b) => b.project.status === 'FUNDED')
      .map((b) => ({
        projectId: b.projectId,
        title: b.project.title,
        budgetUsd: b.project.budgetUsd,
        deadline: b.project.deadline,
        escrow: b.project.escrow,
      }));

    const openFeed = await prisma.agentProject.findMany({
      where: {
        status: 'OPEN',
        posterId: { not: profile.id },
        bids: { none: { bidderId: profile.id } },
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });

    return {
      providerId: profile.id,
      assigned,
      completedCount: bids.filter((b) => b.project.status === 'COMPLETED').length,
      totalEarned: profile.totalEarned,
      openFeed,
    };
  }

  /**
   * Provider books a project.
   *
   * Trust-gated instant booking. The poster must have opted in (autoBook at
   * post time) AND the provider must be identity-verified with Trust Score
   * ≥ 70; only then does the booking fund itself — the bid is created and
   * immediately run through acceptBid with the TICKET as the poster's identity,
   * acting on the opt-in the poster explicitly gave when they posted. Everyone
   * else gets a normal bid at full budget for the poster to accept manually.
   */
  async bookProject(projectId: string, userId: string) {
    const { profile, passport } = await this.resolveProviderProfile(userId);

    const project = await prisma.agentProject.findUnique({ where: { id: projectId } });
    if (!project) throw new Error('Project not found');
    if (project.status !== 'OPEN') throw new Error('Project is not open for booking');
    if (project.posterId === profile.id) throw new Error('Cannot book your own project');

    const instantAllowed =
      (project.metadata as { autoBook?: unknown } | null)?.autoBook === true &&
      passport.verifiedIdentity === true &&
      (passport.score ?? 0) >= 70;

    const bid = await this.placeBid({
      projectId,
      bidderId: profile.id,
      proposedAmount: project.budgetUsd,
      timelineHours: 14 * 24,
      approach: instantAllowed
        ? 'Instant booking — identity-verified provider, Trust Score ≥ 70'
        : 'Provider application — awaiting poster acceptance',
    });

    if (!instantAllowed) {
      return { booked: false, bidId: bid.id };
    }

    const { escrow, checkoutUrl } = await this.acceptBid(bid.id, project.posterId);
    return { booked: true, bidId: bid.id, escrow, checkoutUrl };
  }

  /**
   * Accept a bid and fund escrow
   */
  async acceptBid(bidId: string, actorId?: string) {
    const bid = await prisma.agentProjectBid.findUnique({
      where: { id: bidId },
      include: { project: true },
    });
    if (!bid) throw new Error('Bid not found');

    // Accepting a bid creates escrow and commits the poster's money, so only the
    // party who posted the project may do it. Skipped when no actor is supplied —
    // internal callers and tests — but every routed call passes one.
    if (actorId && bid.project.posterId !== actorId) {
      throw new Error('Not authorised to accept bids on this project');
    }

    const platformFee = bid.proposedAmount * PLATFORM_FEE_USD;
    const releaseAmount = bid.proposedAmount - platformFee;

    // Real-money mode holds the escrow at AWAITING_PAYMENT until the poster's
    // card payment clears through checkout; the webhook flips it to FUNDED.
    // Simulated mode (no rail key) funds immediately, as before.
    const awaitingPayment = realMoneyEnabled();
    const escrow = await prisma.agentEscrow.create({
      data: {
        projectId: bid.projectId,
        totalAmount: bid.proposedAmount,
        releaseAmount,
        platformFee,
        status: awaitingPayment ? 'AWAITING_PAYMENT' : 'FUNDED',
      },
    });

    // Checkout for the poster to pay the escrow. Only produced when rails are
    // live; the caller's client redirects, and the webhook completes funding.
    const checkoutUrl = awaitingPayment
      ? await createEscrowCheckout(escrow)
      : undefined;

    // Update bid and project
    await prisma.agentProjectBid.update({
      where: { id: bidId },
      data: { status: 'ACCEPTED', isWinning: true, acceptedAt: new Date() },
    });

    // Reject other bids
    await prisma.agentProjectBid.updateMany({
      where: { projectId: bid.projectId, id: { not: bidId } },
      data: { status: 'REJECTED' },
    });

    // Update project status
    await prisma.agentProject.update({
      where: { id: bid.projectId },
      data: { status: 'FUNDED', selectedBidId: bidId, escrowId: escrow.id },
    });

    return { escrow, bid, checkoutUrl };
  }

  /**
   * Poster's payment link for an escrow still awaiting money. Hire/book
   * responses carry a checkout URL, but one that was abandoned, expired, or
   * viewed on the wrong device should never leave a project unpayable — the
   * poster can always mint a fresh session here until the webhook has funded
   * the escrow.
   */
  async getFundCheckoutUrl(projectId: string, actorUserId: string) {
    const { id: clientProfileId } = await this.ensurePosterProfile(actorUserId, 'Client');
    const project = await prisma.agentProject.findUnique({
      where: { id: projectId },
      include: { escrow: true },
    });
    const escrow = project?.escrow;
    if (!project || !escrow) throw new Error('Project or escrow not found');
    if (project.posterId !== actorUserId && project.posterId !== clientProfileId) {
      throw new Error('Not authorised to fund this project');
    }

    if (escrow.status === 'FUNDED') return { funded: true, checkoutUrl: null };
    if (escrow.status !== 'AWAITING_PAYMENT') {
      throw new Error(`Escrow is ${escrow.status}; no funding session available`);
    }
    return { funded: false, checkoutUrl: await createEscrowCheckout(escrow) };
  }

  /**
   * Complete project and release funds.
   *
   * WHO MAY CALL THIS, AND WHY IT IS CHECKED HERE
   * `solverId` used to arrive from the request body, which meant any authenticated
   * user could complete any project, release its escrow, and credit an arbitrary
   * agent with totalEarned and +5 reputation. The winning bidder is recorded on
   * the project, so the caller does not get to choose who is paid — only whether
   * the job is marked done.
   *
   * Authority is the poster's alone: they posted the work and they decide whether
   * it was delivered. The solver is not asked, because a solver who could decline
   * completion could also decline to finish a job they had already been paid for.
   */
  async completeProject(projectId: string, actorId: string) {
    const project = await prisma.agentProject.findUnique({
      where: { id: projectId },
      include: { escrow: true },
    });
    if (!project || !project.escrow) throw new Error('Project or escrow not found');

    // A payout needs money in escrow. In real-money mode a fresh bid sits at
    // AWAITING_PAYMENT until the poster's checkout payment clears; releasing
    // that early would pay the provider before the poster's card was charged.
    if (project.escrow.status !== 'FUNDED') {
      throw new Error('Escrow is not funded yet — complete the payment first');
    }

    if (project.posterId !== actorId) {
      // The caller is not the party who posted this work.
      throw new Error('Not authorised to complete this project');
    }

    if (project.status === 'COMPLETED') {
      // Idempotency guard. Completing twice incremented reputation and totalEarned
      // twice, so a retried request was a payout bug.
      throw new Error('Project is already completed');
    }

    // The solver is derived, never supplied. This is the fix for the body-supplied
    // id that let a caller credit an arbitrary agent.
    const winningBid = await prisma.agentProjectBid.findFirst({
      where: { projectId, isWinning: true },
      select: { bidderId: true },
    });
    const solverId = winningBid?.bidderId;
    if (!solverId) {
      // Without an accepted bid there is nobody to pay, and paying the poster's
      // own guess would be worse than refusing.
      throw new Error('No accepted bid on this project — cannot release funds');
    }

    const pabPrice = PAB_USD_PRICE;
    const pabReward = project.budgetUsd * PAB_REWARD_RATE;
    const solFee = project.budgetUsd * SOL_FEE_RATE;

    // Release escrow to solver
    await prisma.agentEscrow.update({
      where: { id: project.escrow.id },
      data: { status: 'RELEASED', releasedAt: new Date() },
    });

    // Update project
    await prisma.agentProject.update({
      where: { id: projectId },
      data: { status: 'COMPLETED' },
    });

    // Update solver stats
    await prisma.agentProfile.update({
      where: { id: solverId },
      data: {
        totalEarned: { increment: project.escrow.releaseAmount },
        projectsCompleted: { increment: 1 },
        reputation: { increment: 5 },
      },
    });

    // Update poster stats
    await prisma.agentProfile.update({
      where: { id: project.posterId },
      data: {
        totalSpent: { increment: project.budgetUsd },
      },
    });

    // Record transactions
    await prisma.agentMarketTransaction.create({
      data: {
        projectId,
        fromAgentId: project.posterId,
        toAgentId: solverId,
        amount: project.escrow.releaseAmount,
        pabReward: pabReward / pabPrice,
        platformFeeUsd: project.escrow.platformFee,
        platformFeeSol: solFee,
        type: 'PROJECT_PAYMENT',
        status: 'COMPLETED',
      },
    });

    // Reputation-bearing completion. A paid delivery is a Trust Score event —
    // `delivery.on_time`, the SAME event an on-schedule gig checkout produces —
    // so marketplace work and gig work land in one reputation history, and
    // with it one reason for the next poster to book this provider. Bridged
    // providers carry their passportId in profile metadata; real agents by
    // wallet. Failure to record trust must never fail the release itself.
    const solver = await prisma.agentProfile.findUnique({ where: { id: solverId } });
    let providerPassport = null as null | { id: string };
    const meta = (solver?.metadata as { passportId?: unknown } | null) ?? null;
    if (typeof meta?.passportId === 'string') {
      providerPassport = await prisma.trustPassport.findUnique({ where: { id: meta.passportId } });
    }
    if (!providerPassport && solver?.walletAddress) {
      providerPassport = await prisma.trustPassport.findFirst({
        where: { walletAddress: solver.walletAddress },
      });
    }
    if (providerPassport) {
      try {
        await trustCore.emit('delivery.on_time', {
          passportId: providerPassport.id,
          amount: project.escrow.releaseAmount,
          metadata: { source: 'agent-marketplace', projectId },
        });
        await trustCore.emit('job.completed', {
          passportId: providerPassport.id,
          amount: project.escrow.releaseAmount,
          timestamp: new Date(),
        });
        const now = new Date();
        await prisma.passportGigHistory.create({
          data: {
            passportId: providerPassport.id,
            gigId: projectId,
            title: project.title,
            scheduledDate: now,
            timeBucket: `${Math.floor(now.getHours() / 6) * 6}-${Math.floor(now.getHours() / 6) * 6 + 6}`,
            dayOfWeek: now.getDay(),
            status: 'COMPLETED',
          },
        });
      } catch (err) {
        console.error(`[AgentMarketplace] trust record failed for project ${projectId}:`, err);
      }
    }

    return { success: true, released: project.escrow.releaseAmount, pabReward: pabReward / pabPrice };
  }

  /**
   * Self-heal: if project fails, return to bidding
   */
  async returnToBidding(projectId: string, reason: string, actorId?: string) {
    const project = await prisma.agentProject.findUnique({
      where: { id: projectId },
      include: { escrow: true },
    });
    if (!project) throw new Error('Project not found');

    // Returning a project to bidding refunds the escrow, so only the poster may
    // do it — not the bidder who lost, who is the party with the most reason to
    // reach for it.
    if (actorId && project.posterId !== actorId) {
      throw new Error('Not authorised to return this project to bidding');
    }

    // Refund escrow to poster
    if (project.escrow) {
      await prisma.agentEscrow.update({
        where: { id: project.escrow.id },
        data: { status: 'REFUNDED', refundedAt: new Date() },
      });
    }

    // Reset bids
    await prisma.agentProjectBid.updateMany({
      where: { projectId },
      data: { status: 'PENDING', isWinning: false },
    });

    // Return project to OPEN
    await prisma.agentProject.update({
      where: { id: projectId },
      data: { status: 'OPEN', selectedBidId: null, escrowId: null },
    });

    // Penalize failed solver
    const winningBid = await prisma.agentProjectBid.findFirst({
      where: { projectId, isWinning: true },
    });
    if (winningBid) {
      await prisma.agentProfile.update({
        where: { id: winningBid.bidderId },
        data: {
          projectsFailed: { increment: 1 },
          reputation: { decrement: 10 },
        },
      });
    }

    return { success: true, message: 'Project returned to bidding', reason };
  }

  /**
   * Get marketplace stats
   */
  async getStats() {
    const [
      totalAgents,
      openProjects,
      activeProjects,
      completedProjects,
      totalVolume,
      totalFees,
    ] = await Promise.all([
      prisma.agentProfile.count({ where: { isActive: true } }),
      prisma.agentProject.count({ where: { status: 'OPEN' } }),
      prisma.agentProject.count({ where: { status: { in: ['FUNDED', 'IN_PROGRESS'] } } }),
      prisma.agentProject.count({ where: { status: 'COMPLETED' } }),
      prisma.agentMarketTransaction.aggregate({ _sum: { amount: true } }),
      prisma.agentMarketTransaction.aggregate({ _sum: { platformFeeUsd: true } }),
    ]);

    return {
      totalAgents,
      openProjects,
      activeProjects,
      completedProjects,
      totalVolume: totalVolume._sum.amount || 0,
      totalFees: totalFees._sum.platformFeeUsd || 0,
    };
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard() {
    return prisma.agentProfile.findMany({
      where: { isActive: true },
      orderBy: { reputation: 'desc' },
      take: 20,
      select: {
        id: true,
        name: true,
        slug: true,
        capabilities: true,
        reputation: true,
        totalEarned: true,
        projectsCompleted: true,
      },
    });
  }

  // ── M2M (Machine-to-Machine) Commerce Layer ────────────────────────────────
  //
  // Pure programmatic API surface for external AI agents. No UI, no human
  // approval: the math does the trust. These methods are the server-side half
  // of the M2M handshake; the route file wires them to /api/v1/m2m.

  /**
   * M2M: post a task from an external agent.
   *
   * `deliverableHash` is the SHA-256 of the expected output. It is the anchor
   * of the VCAP handshake: the provider submits the real hash at delivery
   time and the two are compared to decide release vs dispute. No hash, no
   automatic release — the caller must supply one.
   */
  async m2mPostProject(params: {
    agentId: string;
    title: string;
    description: string;
    budget: number;
    requiredSkills: string[];
    deliverableHash: string;
    deadlineHours?: number;
    category?: string;
  }) {
    if (!params.deliverableHash || typeof params.deliverableHash !== 'string') {
      throw new Error('deliverableHash is required for M2M projects');
    }
    const hash = params.deliverableHash.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(hash)) {
      throw new Error('deliverableHash must be a 64-character hex SHA-256 digest');
    }

    const project = await this.postProject({
      title: params.title,
      description: params.description,
      requirements: params.requiredSkills.join(', '),
      posterId: params.agentId,
      budgetUsd: params.budget,
      deadline: new Date(Date.now() + (params.deadlineHours ?? 14 * 24) * 60 * 60 * 1000),
      category: params.category ?? 'M2M_TASK',
      complexity: 'MEDIUM',
      deliverableHash: hash,
      metadata: { source: 'm2m', requiredSkills: params.requiredSkills },
    });

    return { projectId: project.id, deliverableHash: hash, status: project.status };
  }

  /**
   * M2M: list open projects. Filtered by the caller's capabilities when
   * supplied, so an agent only sees work it can actually do.
   */
  async m2mListProjects(params: {
    agentId: string;
    skills?: string[];
    limit?: number;
  }) {
    const limit = Math.min(Math.max(Number(params.limit) || 20, 1), 100);
    const projects = await prisma.agentProject.findMany({
      where: { status: 'OPEN' },
      include: { bids: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const skills = (params.skills ?? []).map((s) => s.toLowerCase());
    const filtered = skills.length
      ? projects.filter((p) => {
          const pSkills = (p.metadata as { requiredSkills?: string[] } | null)?.requiredSkills ?? [];
          const req = pSkills.map((s) => s.toLowerCase());
          return skills.some((s) => req.includes(s));
        })
      : projects;

    return filtered.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      budgetUsd: p.budgetUsd,
      deadline: p.deadline,
      category: p.category,
      deliverableHash: p.deliverableHash,
      requiredSkills: (p.metadata as { requiredSkills?: string[] } | null)?.requiredSkills ?? [],
      bids: p.bids.length,
    }));
  }

  /**
   * M2M: submit a bid. Identical shape to placeBid but goes through the M2M
   * path so the caller identity is the agent, not a signed-in user.
   */
  async m2mSubmitBid(params: {
    projectId: string;
    agentId: string;
    amount: number;
    timelineHours: number;
    proposal?: string;
  }) {
    const project = await prisma.agentProject.findUnique({ where: { id: params.projectId } });
    if (!project) throw new Error('Project not found');
    if (project.status !== 'OPEN') {
      throw new Error(`Project is ${project.status}; bidding is closed`);
    }
    if (!Number.isFinite(params.amount) || params.amount <= 0) {
      throw new Error('amount must be a number greater than zero');
    }

    return this.placeBid({
      projectId: params.projectId,
      bidderId: params.agentId,
      proposedAmount: params.amount,
      timelineHours: params.timelineHours,
      approach: params.proposal ?? 'M2M bid',
    });
  }

  /**
   * M2M: award a project to a specific bid. The poster's funds are locked into
   * escrow and the winning bid flips to ACCEPTED. Same authority check as
   * acceptBid — only the poster may award.
   */
  async m2mAwardProject(params: { projectId: string; bidId: string; agentId: string }) {
    const bid = await prisma.agentProjectBid.findUnique({
      where: { id: params.bidId },
      include: { project: true },
    });
    if (!bid) throw new Error('Bid not found');
    if (bid.projectId !== params.projectId) {
      throw new Error('Bid does not belong to this project');
    }
    if (bid.project.status !== 'OPEN') {
      throw new Error(`Project is ${bid.project.status}; cannot award`);
    }
    if (bid.project.posterId !== params.agentId) {
      throw new Error('Not authorised to award this project — only the poster may');
    }

    const { escrow } = await this.acceptBid(params.bidId, params.agentId);
    return {
      projectId: params.projectId,
      bidId: params.bidId,
      escrowId: escrow.id,
      status: bid.project.status,
      totalAmount: escrow.totalAmount,
      releaseAmount: escrow.releaseAmount,
    };
  }
}

export const agentMarketplace = new AgentMarketplace();
