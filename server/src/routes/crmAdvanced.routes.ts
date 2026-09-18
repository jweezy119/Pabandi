import { Router } from 'express';
import {
  generateMonthlyRent,
  getOverdueRent,
  applyLateFees,
  getExpiringLeases,
  renewLease,
  createInspection,
  getInspection,
  signInspection,
  autoAssignVendor,
  listVendors,
  addVendor,
  getPropertyFinancials,
  getCashFlowForecast,
  getTenantRisk,
  getTenantLedger,
  createAutomation,
  listAutomations,
  triggerAutomation,
  runAutomations,
} from '../controllers/crmAdvanced.controller';

const router = Router();

// Rent routes
router.post('/rent/generate', generateMonthlyRent);
router.get('/rent/overdue', getOverdueRent);
router.post('/late-fees/apply', applyLateFees);

// Lease routes
router.get('/leases/expiring', getExpiringLeases);
router.post('/leases/:id/renew', renewLease);

// Inspection routes
router.post('/inspections', createInspection);
router.get('/inspections/:id', getInspection);
router.post('/inspections/:id/sign', signInspection);

// Maintenance routes
router.get('/maintenance/auto-assign/:id', autoAssignVendor);
router.get('/maintenance/vendors', listVendors);
router.post('/maintenance/vendors', addVendor);

// Financial routes
router.get('/financials/:propertyId', getPropertyFinancials);
router.get('/cashflow/:propertyId', getCashFlowForecast);

// Tenant routes
router.get('/tenant/:tenantId/risk', getTenantRisk);
router.get('/tenant/:tenantId/ledger', getTenantLedger);

// Automation routes
router.post('/automations', createAutomation);
router.get('/automations', listAutomations);
router.post('/automations/:id/trigger', triggerAutomation);
router.get('/automations/run', runAutomations);

export default router;
