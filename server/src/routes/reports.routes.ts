import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { ReportsService } from '../services/reports.service';

const router = Router();
router.use(authenticate);
// AUTHENTICATED.
//
// This router had NO authentication at all — every route below was reachable by anyone
// who could reach the API, and each one takes a tenant from the query string or body.
// That is 6 routes of business financials and writes (rent generation, late fees,
// lease renewal, inspections, maintenance vendors, cashflow) with no caller identity.
//
// `router.use` rather than per-route so a route added later is covered by default. Adding
// auth per handler is how the next one ends up unprotected.



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
