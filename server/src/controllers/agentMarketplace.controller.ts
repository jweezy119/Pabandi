import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { agentMarketplace } from '../services/agentMarketplace.service';
import type { AuthRequest } from '../middleware/auth.middleware';

export const registerAgent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // No body-supplied identity. A caller could otherwise register an agent under
    // someone else's id and then act as them everywhere downstream.
    const { posterId: _ignoredPosterId, bidderId: _ignoredBidderId, ...safeBody } = req.body ?? {};
    const agent = await agentMarketplace.registerAgent({
      ...safeBody,
      posterId: (req as any).user?.id,
    });
    res.json({ success: true, agent });
  } catch (err) { next(err); }
};

export const postProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await agentMarketplace.postProject({
      ...req.body,
      // Token only. The `|| req.body.posterId` fallback let any caller post a
      // project under another agent's id.
      posterId: (req as any).user?.id,
      deadline: new Date(req.body.deadline),
    });
    res.json({ success: true, project });
  } catch (err) { next(err); }
};

export const matchAndPost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Same rule as postProject: the poster is who the token says it is, never
    // who the body claims.
    const { user } = req as AuthRequest;
    if (!user?.id) return res.status(401).json({ success: false, error: 'Authentication required' });

    const { title, description, budget, requiredSkills } = req.body ?? {};
    if (typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'title is required' });
    }
    if (typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'description is required' });
    }
    if (typeof budget !== 'number' || !Number.isFinite(budget) || budget <= 0) {
      return res.status(400).json({ success: false, error: 'budget must be a positive number' });
    }
    if (!Array.isArray(requiredSkills) || requiredSkills.length === 0 ||
        requiredSkills.some((s: unknown) => typeof s !== 'string')) {
      return res.status(400).json({ success: false, error: 'requiredSkills must be a non-empty array of strings' });
    }

    const poster = await agentMarketplace.ensurePosterProfile(
      user.id,
      req.body.posterName || user.firstName || user.email || 'Pabandi client',
    );
    const deadlineRaw: unknown = req.body.deadline;
    let deadline: Date | undefined;
    if (typeof deadlineRaw === 'string' || deadlineRaw instanceof Date) {
      const parsed = new Date(deadlineRaw);
      if (!Number.isNaN(parsed.getTime())) deadline = parsed;
    }

    const { project, providers } = await agentMarketplace.matchAndPost({
      title: title.trim(),
      description: description.trim(),
      budget,
      requiredSkills: (requiredSkills as string[]).map((s) => s.trim()).filter(Boolean),
      posterId: poster.id,
      deadline,
    });
    return res.status(201).json({ success: true, data: { project, providers } });
  } catch (err) { next(err); }
};

/**
 * Projects the signed-in caller has posted, with escrow and bid counts.
 *
 * Backs the "Your projects" panel. Two posterId sources are covered for the
 * same reason completeProject's controller accepts two actor ids: legacy
 * `/projects` posts stored the raw token id, the unified flow stores the
 * bridged `client-<userId>` profile id.
 */
export const getMyProjects = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user } = req as AuthRequest;
    if (!user?.id) return res.status(401).json({ success: false, error: 'Authentication required' });
    const client = await prisma.agentProfile.findUnique({
      where: { slug: `client-${user.id}` },
      select: { id: true },
    });
    const projects = await prisma.agentProject.findMany({
      where: { OR: [{ posterId: client?.id ?? '' }, { posterId: user.id }] },
      include: {
        escrow: true,
        _count: { select: { bids: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return res.json({ success: true, data: projects });
  } catch (err) { next(err); }
};

export const hireProvider = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Poster identity comes from the token, same rule as everywhere else in
    // this controller. passportId is the only thing the body contributes.
    const { user } = req as AuthRequest;
    if (!user?.id) return res.status(401).json({ success: false, error: 'Authentication required' });
    const passportId = req.body?.passportId;
    if (typeof passportId !== 'string' || passportId.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'passportId is required' });
    }
    const data = await agentMarketplace.hireProvider(req.params.projectId, passportId.trim(), user.id);
    return res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const placeBid = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bid = await agentMarketplace.placeBid({
      ...req.body,
      // Token only, for the same reason: a bid placed under someone else's id is
      // a bid they never made.
      bidderId: (req as any).user?.id,
    });
    res.json({ success: true, bid });
  } catch (err) { next(err); }
};

export const acceptBid = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // The actor id is what the ownership check runs against, so it comes from the
    // token — never the body.
    const result = await agentMarketplace.acceptBid(req.params.bidId, (req as any).user?.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

export const completeProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // The actor id is what the ownership check runs against, so it comes from the
    // token — never the body.
    const { user } = req as AuthRequest;
    if (!user?.id) return res.status(401).json({ success: false, error: 'Authentication required' });
    //
    // Poster bridge. There are two ways a project got its posterId:
    //   - the legacy `/projects` flow stores the raw token user id,
    //   - `/match-and-post` bridges the user to a `client-<userId>` AgentProfile
    //     (AgentProject.poster is an AgentProfile FK; see ensurePosterProfile).
    // The service compares against that stored posterId, so resolve the bridge
    // first and fall back to the token id for the legacy flow. A user whose id
    // matches nothing still fails the check inside completeProject.
    const client = await prisma.agentProfile.findUnique({
      where: { slug: `client-${user.id}` },
      select: { id: true },
    });
    const result = await agentMarketplace.completeProject(req.params.projectId, client?.id ?? user.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

export const returnToBidding = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await agentMarketplace.returnToBidding(
      req.params.projectId,
      req.body.reason,
      (req as any).user?.id,
    );
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

export const getMarketplaceStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await agentMarketplace.getStats();
    res.json({ success: true, stats });
  } catch (err) { next(err); }
};

export const getLeaderboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const leaderboard = await agentMarketplace.getLeaderboard();
    res.json({ success: true, leaderboard });
  } catch (err) { next(err); }
};

export const getOpenProjects = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projects = await prisma.agentProject.findMany({
      where: { status: 'OPEN' },
      include: { poster: true, bids: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, projects });
  } catch (err) { next(err); }
};

export const getAgentProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agent = await prisma.agentProfile.findUnique({
      where: { slug: req.params.slug },
      include: {
        postedProjects: true,
        bids: true,
      },
    });
    res.json({ success: true, agent });
  } catch (err) { next(err) };
};

export const getAllAgents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, minReputation, limit = '20', offset = '0' } = req.query;
    const where: any = { isActive: true };
    if (minReputation) where.reputation = { gte: parseInt(minReputation as string) };

    const [agents, total] = await Promise.all([
      prisma.agentProfile.findMany({
        where,
        orderBy: { reputation: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          capabilities: true,
          reputation: true,
          totalEarned: true,
          projectsCompleted: true,
          walletAddress: true,
          createdAt: true,
        },
      }),
      prisma.agentProfile.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        agents,
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: parseInt(offset as string) + parseInt(limit as string) < total,
      },
    });
  } catch (err) { next(err) };
};
