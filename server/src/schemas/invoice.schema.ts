import { z } from 'zod';

/**
 * Shared Zod schemas for invoice payloads.
 *
 * Used by POST /api/v1/invoices (server/src/routes/invoice.routes.ts) and can be
 * reused by any other invoice-writing endpoint.
 */

const lineItemSchema = z.object({
  description: z
    .string()
    .min(1, 'Line item description is required')
    .max(500, 'Line item description is too long'),
  quantity: z.number().positive('Quantity must be positive'),
  rate: z.number().nonnegative('Rate cannot be negative'),
  amount: z.number().nonnegative('Amount cannot be negative'),
});

export const invoiceCreateSchema = z.object({
  clientId: z.string().uuid('clientId must be a valid UUID'),
  invoiceDate: z.string().datetime('Invalid invoice date').optional(),
  dateDue: z.string().datetime('Invalid due date'),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item is required'),
  subtotal: z.number().nonnegative('Subtotal cannot be negative'),
  taxPercent: z.number().min(0).max(100).optional().default(0),
  taxAmount: z.number().nonnegative('Tax amount cannot be negative').optional().default(0),
  grandTotal: z.number().nonnegative('Grand total cannot be negative'),
  notes: z.string().max(500, 'Notes must be 500 characters or fewer').optional().default(''),
  requireEscrow: z.boolean().optional().default(false),
  depositPercent: z.number().min(0).max(100).optional().default(0),
  depositAmount: z.number().nonnegative('Deposit amount cannot be negative').optional().default(0),
});

export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;

/**
 * Zod schema for client creation (POST /api/v1/crm/clients).
 */
export const clientCreateSchema = z.object({
  name: z.string().min(1, 'Client name is required').max(200, 'Client name is too long'),
  email: z.string().email('Invalid email address').max(200).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  company: z.string().max(200).optional().nullable(),
  notes: z.string().max(500, 'Notes must be 500 characters or fewer').optional().default(''),
  status: z.string().max(50).optional().nullable(),
  customData: z.record(z.string(), z.unknown()).optional(),
});

export type ClientCreateInput = z.infer<typeof clientCreateSchema>;
