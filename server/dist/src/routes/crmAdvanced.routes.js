"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crmAdvanced_controller_1 = require("../controllers/crmAdvanced.controller");
const router = (0, express_1.Router)();
// Rent routes
router.post('/rent/generate', crmAdvanced_controller_1.generateMonthlyRent);
router.get('/rent/overdue', crmAdvanced_controller_1.getOverdueRent);
router.post('/late-fees/apply', crmAdvanced_controller_1.applyLateFees);
// Lease routes
router.get('/leases/expiring', crmAdvanced_controller_1.getExpiringLeases);
router.post('/leases/:id/renew', crmAdvanced_controller_1.renewLease);
// Inspection routes
router.post('/inspections', crmAdvanced_controller_1.createInspection);
router.get('/inspections/:id', crmAdvanced_controller_1.getInspection);
router.post('/inspections/:id/sign', crmAdvanced_controller_1.signInspection);
// Maintenance routes
router.get('/maintenance/auto-assign/:id', crmAdvanced_controller_1.autoAssignVendor);
router.get('/maintenance/vendors', crmAdvanced_controller_1.listVendors);
router.post('/maintenance/vendors', crmAdvanced_controller_1.addVendor);
// Financial routes
router.get('/financials/:propertyId', crmAdvanced_controller_1.getPropertyFinancials);
router.get('/cashflow/:propertyId', crmAdvanced_controller_1.getCashFlowForecast);
// Tenant routes
router.get('/tenant/:tenantId/risk', crmAdvanced_controller_1.getTenantRisk);
router.get('/tenant/:tenantId/ledger', crmAdvanced_controller_1.getTenantLedger);
// Automation routes
router.post('/automations', crmAdvanced_controller_1.createAutomation);
router.get('/automations', crmAdvanced_controller_1.listAutomations);
router.post('/automations/:id/trigger', crmAdvanced_controller_1.triggerAutomation);
router.get('/automations/run', crmAdvanced_controller_1.runAutomations);
exports.default = router;
//# sourceMappingURL=crmAdvanced.routes.js.map