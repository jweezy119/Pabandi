import { Request, Response } from 'express';
import { prisma } from '../utils/database';
import crypto from 'crypto';
import { AuthRequest } from '../middleware/auth.middleware';

export const generateApiKey = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { name, billingMode, preferredCurrency } = req.body;

    // Generate a secure API Key
    const apiKeyStr = `pab_${crypto.randomBytes(24).toString('hex')}`;

    const apiClient = await prisma.apiClient.create({
      data: {
        name: name || 'Default Application',
        email: user.email,
        apiKey: apiKeyStr,
        tier: 'STARTER',
        callsLimit: billingMode === 'PAY_AS_YOU_GO' ? 0 : 500, // 0 means unlimited
        billingMode: billingMode || 'PAY_AS_YOU_GO',
        preferredCurrency: preferredCurrency || 'PAB'
      }
    });

    res.status(201).json({
      message: 'API Key generated successfully',
      apiClient
    });
  } catch (error) {
    console.error('Error generating API Key:', error);
    res.status(500).json({ message: 'Error generating API Key', error: (error as any).message });
  }
};

export const getApiKeys = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const apiClients = await prisma.apiClient.findMany({
      where: { email: user.email }
    });

    res.json(apiClients);
  } catch (error) {
    console.error('Error fetching API Keys:', error);
    res.status(500).json({ message: 'Error fetching API Keys', error: (error as any).message });
  }
};
