import { z } from 'zod';

export const PriorityEnum = z.enum(['EMERGENCY', 'URGENT', 'ROUTINE']);
export const WorkOrderStatusEnum = z.enum([
  'DRAFT',
  'PENDING_ASSIGNMENT',
  'ASSIGNED',
  'EN_ROUTE',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'ESCALATED',
]);
export const InvoiceStatusEnum = z.enum(['NOT_READY', 'READY', 'INVOICED', 'PAID']);

// 1. Create Work Order Schema (Strict: reject unknown fields)
export const createWorkOrderSchema = z.object({
  customerId: z.string().min(1, 'customerId is required'),
  issueType: z.string().min(1).max(100), // e.g. "leak", "repair", "inspection", "maintenance"
  priority: PriorityEnum.default('ROUTINE'),
  description: z.string().min(3).max(5000),
  address: z.string().min(3).max(500),
  accessNotes: z.string().max(1000).optional(),
  scheduledFor: z.string().datetime().optional().nullable(),
}).strict();

// 2. Update Work Order Schema
export const updateWorkOrderSchema = z.object({
  status: WorkOrderStatusEnum.optional(),
  priority: PriorityEnum.optional(),
  description: z.string().min(3).max(5000).optional(),
  address: z.string().min(3).max(500).optional(),
  accessNotes: z.string().max(1000).optional().nullable(),
  scheduledFor: z.string().datetime().optional().nullable(),
  invoiceStatus: InvoiceStatusEnum.optional(),
}).strict();

// 3. Assign Technician Schema
export const assignWorkOrderSchema = z.object({
  technicianId: z.string().min(1, 'technicianId is required'),
  notifyWhatsApp: z.boolean().default(true),
}).strict();

// 3b. Unassign Technician Schema — the real revert behind the command bar's Undo.
// An omitted technicianId means "whoever is currently assigned".
export const unassignWorkOrderSchema = z.object({
  technicianId: z.string().min(1).optional(),
  notifyWhatsApp: z.boolean().default(false),
}).strict();

// 4. Technician Completion Report Schema
export const completeWorkOrderSchema = z.object({
  completionNotes: z.string().min(5).max(4000),
  materialsUsed: z.array(z.string().max(200)).optional(),
  photoUrls: z.array(z.string().url()).max(10).optional(),
  readyForInvoice: z.boolean().default(true),
}).strict();

// 5. Work Order Attachment Schema
export const createAttachmentSchema = z.object({
  kind: z.enum(['photo', 'report', 'signature']),
  url: z.string().url().max(1000),
}).strict();

// 6. Create Technician Schema
export const createTechnicianSchema = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().min(7).max(30),
  skills: z.array(z.string().max(50)).min(1, 'At least one skill is required'),
  active: z.boolean().default(true),
}).strict();

// 7. Update Technician Schema
export const updateTechnicianSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().min(7).max(30).optional(),
  skills: z.array(z.string().max(50)).optional(),
  active: z.boolean().optional(),
}).strict();

// 8. Create Customer Schema
export const createCustomerSchema = z.object({
  name: z.string().min(2).max(150),
  email: z.string().email().max(150).optional().nullable(),
  phone: z.string().min(7).max(30).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
}).strict();

// 9. AI Triage & Dispatch Schema
export const aiTriageSchema = z.object({
  commercialBuildingType: z.string().max(100).optional(), // "Warehouse", "Strip Mall", "Data Center", "Office Park"
  roofSystem: z.string().max(100).optional(), // "TPO", "EPDM", "Standing Seam Metal", "Built-up Asphalt", "Mod-Bit"
  weatherConditions: z.string().max(200).optional(),
}).strict();

export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>;
export type UpdateWorkOrderInput = z.infer<typeof updateWorkOrderSchema>;
export type AssignWorkOrderInput = z.infer<typeof assignWorkOrderSchema>;
export type UnassignWorkOrderInput = z.infer<typeof unassignWorkOrderSchema>;
export type CompleteWorkOrderInput = z.infer<typeof completeWorkOrderSchema>;
export type CreateAttachmentInput = z.infer<typeof createAttachmentSchema>;
export type CreateTechnicianInput = z.infer<typeof createTechnicianSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
// 10. Predictive Engine — Counterfactual Simulation Schema
/**
 * A perturbation is a per-feature delta in the feature's own units, so the
 * what-if strip can say "move the start three hours later" as
 * `{ lead_time_days: 0.125 }` without the client needing to know the model.
 *
 * `.strict()` so a typo in a slider name is rejected rather than silently
 * ignored — a silently ignored slider looks exactly like a prediction that
 * refused to move.
 */
export const simulateRiskSchema = z.object({
  schedule_density: z.number().min(-50).max(50).optional(),
  lead_time_days: z.number().min(-365).max(365).optional(),
  issue_type_complexity: z.number().min(-1).max(1).optional(),
  technician_skill_match: z.number().min(-1).max(1).optional(),
  technician_experience_years: z.number().min(-50).max(50).optional(),
}).strict();

export type SimulateRiskInput = z.infer<typeof simulateRiskSchema>;

export type AiTriageInput = z.infer<typeof aiTriageSchema>;

