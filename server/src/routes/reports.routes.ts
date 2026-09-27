import { Router } from 'express';
import { ReportsService } from '../services/reports.service';

const router = Router();

const getRange = (req: any) => {
  const { startDate, endDate } = req.query;
  const start = startDate ? new Date(startDate) : undefined;
  const end = endDate ? new Date(endDate) : undefined;
  return { start, end };
};

router.get('/pipeline', async (req, res) => {
  try {
    const businessId = String(req.query.businessId);
    const { start, end } = getRange(req);
    const data = await ReportsService.getPipeline(businessId, start, end);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/revenue', async (req, res) => {
  try {
    const businessId = String(req.query.businessId);
    const { start, end } = getRange(req);
    const data = await ReportsService.getRevenue(businessId, start, end);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/expenses', async (req, res) => {
  try {
    const businessId = String(req.query.businessId);
    const { start, end } = getRange(req);
    const data = await ReportsService.getExpenses(businessId, start, end);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/client-health', async (req, res) => {
  try {
    const businessId = String(req.query.businessId);
    const { start, end } = getRange(req);
    const data = await ReportsService.getClientHealth(businessId, start, end);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/trust', async (req, res) => {
  try {
    const businessId = String(req.query.businessId);
    const { start, end } = getRange(req);
    const data = await ReportsService.getTrustInsights(businessId, start, end);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/activities', async (req, res) => {
  try {
    const businessId = String(req.query.businessId);
    const { start, end } = getRange(req);
    const data = await ReportsService.getActivityMetrics(businessId, start, end);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
