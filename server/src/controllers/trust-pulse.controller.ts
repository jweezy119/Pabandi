import { Response } from 'express';
import { prisma } from '../utils/database';
import { trustScoreService } from '../services/trustScore.service';

export const streamTrustPulse = (req: any, res: Response) => {
  const userId = req.params.userId;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const sendPulse = async () => {
    try {
      const velocity = await trustScoreService.computeVelocity(userId);
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { trustScore: true, verificationTier: true },
      });

      const payload = {
        userId,
        score: user?.trustScore ?? 0,
        tier: user?.verificationTier ?? 'BASIC',
        velocity,
        timestamp: new Date().toISOString(),
      };

      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (error) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'Failed to compute trust pulse' })}\n\n`);
    }
  };

  // Send initial pulse immediately
  sendPulse();

  // Stream updates every 30 seconds
  const interval = setInterval(sendPulse, 30000);

  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
};
