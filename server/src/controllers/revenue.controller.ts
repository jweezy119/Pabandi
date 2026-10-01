import { Request, Response, NextFunction } from 'express';
import { CustomError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';
import { requireCrmContext } from '../middleware/crmContext.middleware';
import { prisma } from '../utils/database';
import { getActiveAlerts, dismissAlert } from '../services/alerts.service';
import { updateClientScore, refreshClientTrust, getClientStage } from '../services/crm-reliability.service';

// ─── Alerts ───────────────────────────────────────────────────────────────────

export async function getAlertsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { serviceBusinessId } = requireCrmContext(req);
    const alerts = await getActiveAlerts(serviceBusinessId);
    res.json({ success: true, data: alerts });
  } catch (error) {
    next(error);
  }
}

export async function dismissAlertHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { id: alertId } = req.params;
    const { serviceBusinessId } = requireCrmContext(req);
    const result = await dismissAlert(alertId, serviceBusinessId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

// ─── Client Stage ─────────────────────────────────────────────────────────────

export async function getClientStageHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { id: clientId } = req.params;
    const { serviceBusinessId } = requireCrmContext(req);

    const client = await prisma.crmClient.findFirst({
      where: { id: clientId, serviceBusinessId },
      include: { jobs: true },
    });
    if (!client) {
      throw new CustomError('Client not found', 404);
    }

    // Refresh score + stage and return
    const result = await refreshClientTrust(clientId);
    res.json({
      success: true,
      data: {
        clientId: client.id,
        clientName: client.name,
        stage: result.stage,
        score: result.score,
      },
    });
  } catch (error) {
    next(error);
  }
}