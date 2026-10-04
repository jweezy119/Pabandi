import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
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
router.use(authenticate);
// AUTHENTICATED.
//
// This router had NO authentication at all — every route below was reachable by anyone
// who could reach the API, and each one takes a tenant from the query string or body.
// That is 19 routes of business financials and writes (rent generation, late fees,
// lease renewal, inspections, maintenance vendors, cashflow) with no caller identity.
//
// `router.use` rather than per-route so a route added later is covered by default. Adding
// auth per handler is how the next one ends up unprotected.



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
