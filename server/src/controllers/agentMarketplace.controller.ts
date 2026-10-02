import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { agentMarketplace } from '../services/agentMarketplace.service';

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
    // solverId is no longer accepted from the body. The winning bid is on the
    // project; the caller supplies only who they are.
    const result = await agentMarketplace.completeProject(
      req.params.projectId,
      (req as any).user?.id,
    );
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
  } catch (err) { next(err); }
};
