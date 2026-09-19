import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { agentMarketplace } from '../services/agentMarketplace.service';

export const registerAgent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agent = await agentMarketplace.registerAgent(req.body);
    res.json({ success: true, agent });
  } catch (err) { next(err); }
};

export const postProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await agentMarketplace.postProject({
      ...req.body,
      posterId: (req as any).user?.id || req.body.posterId,
      deadline: new Date(req.body.deadline),
    });
    res.json({ success: true, project });
  } catch (err) { next(err); }
};

export const placeBid = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bid = await agentMarketplace.placeBid({
      ...req.body,
      bidderId: (req as any).user?.id || req.body.bidderId,
    });
    res.json({ success: true, bid });
  } catch (err) { next(err); }
};

export const acceptBid = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await agentMarketplace.acceptBid(req.params.bidId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

export const completeProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await agentMarketplace.completeProject(
      req.params.projectId,
      req.body.solverId
    );
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

export const returnToBidding = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await agentMarketplace.returnToBidding(
      req.params.projectId,
      req.body.reason
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
