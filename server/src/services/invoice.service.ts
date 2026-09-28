import { prisma } from '../utils/database';
import { CustomError } from '../middleware/errorHandler';
import { trustCore } from '../trust/trust-core';

type InvoiceLineItem = {
  service: string;
  price: number;
  date?: string;
};

type InvoiceCreateData = {
  clientId: string;
  dateDue: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  notes?: string;
  status?: string;
  requireEscrow?: boolean;
};

export async function createInvoice(businessId: string, data: InvoiceCreateData) {
  const { clientId, dateDue, lineItems, subtotal, notes, status, requireEscrow } = data;
  if (!clientId || !dateDue) throw new CustomError('clientId and dateDue are required', 400);

  // Use notes to store metadata if needed, since schema doesn't have escrow/transaction fields
  const metadata = { requireEscrow: !!requireEscrow };
  const combinedNotes = JSON.stringify({ text: notes || '', metadata });

  const number = `INV-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;

  const invoice = await prisma.invoice.create({
    data: {
      businessId,
      clientId,
      number,
      dateDue: new Date(dateDue),
      lineItems: lineItems as object[],
      subtotal,
      notes: combinedNotes,
      status: status || 'draft',
    },
    include: {
      client: true,
    }
  });

  return invoice;
}

export async function getInvoices(businessId: string, filters?: { status?: string, search?: string }) {
  const where: Record<string, unknown> = { businessId };
  if (filters?.status && filters.status !== 'all') {
    where.status = filters.status;
  }
  if (filters?.search) {
    where.number = { contains: filters.search, mode: 'insensitive' };
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: { client: true },
    orderBy: { createdAt: 'desc' }
  });

  return invoices;
}

export async function getInvoice(businessId: string, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, businessId },
    include: { client: true }
  });
  if (!invoice) throw new CustomError('Invoice not found', 404);
  return invoice;
}

export async function updateInvoice(businessId: string, invoiceId: string, data: Partial<InvoiceCreateData>) {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, businessId }, include: { client: true } });
  if (!invoice) throw new CustomError('Invoice not found', 404);
  if (invoice.status !== 'draft') throw new CustomError('Only draft invoices can be edited', 400);

  const updateData: Record<string, unknown> = {};
  if (data.clientId) updateData.clientId = data.clientId;
  if (data.dateDue) updateData.dateDue = new Date(data.dateDue);
  if (data.lineItems) updateData.lineItems = data.lineItems;
  if (data.subtotal !== undefined) updateData.subtotal = data.subtotal;
  if (data.notes !== undefined || data.requireEscrow !== undefined) {
    let existingMetadata = { requireEscrow: false };
    let existingText = '';
    try {
      const parsed = JSON.parse(invoice.notes || '{}');
      existingMetadata = parsed.metadata || {};
      existingText = parsed.text || '';
    } catch {
      existingText = invoice.notes || '';
    }
    
    const newText = data.notes !== undefined ? data.notes : existingText;
    const newMetadata = data.requireEscrow !== undefined ? { ...existingMetadata, requireEscrow: data.requireEscrow } : existingMetadata;
    updateData.notes = JSON.stringify({ text: newText, metadata: newMetadata });
  }

  return prisma.invoice.update({
    where: { id: invoiceId },
    data: updateData,
    include: { client: true }
  });
}

import { paymentRails } from '../payments/rails';

export async function sendInvoice(businessId: string, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, businessId }, include: { client: true } });
  if (!invoice) throw new CustomError('Invoice not found', 404);

  // Look up default payment method
  const defaultMethod = await prisma.businessPaymentMethod.findFirst({
    where: { businessId, isDefault: true }
  });

  let paymentLink = null;
  if (defaultMethod) {
    const rail = paymentRails[defaultMethod.railId];
    if (rail) {
      paymentLink = rail.getPaymentUrl(defaultMethod.target, {
        amount: invoice.subtotal,
        number: invoice.number,
        currency: 'USD'
      });
    }
  }

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: 'sent', sentAt: new Date(), paymentLink },
    include: { client: true }
  });

  if (updated.client.passportId) {
    await trustCore.emit('invoice.sent', {
      invoiceId: updated.id,
      passportId: updated.client.passportId,
      amount: updated.subtotal
    });
  }

  return updated;
}

export async function markInvoicePaid(businessId: string, invoiceId: string, transactionHash?: string) {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, businessId }, include: { client: true } });
  if (!invoice) throw new CustomError('Invoice not found', 404);

  const now = new Date();
  
  let existingMetadata = { requireEscrow: false, transactionHash: '' };
  let existingText = '';
  try {
    const parsed = JSON.parse(invoice.notes || '{}');
    existingMetadata = parsed.metadata || {};
    existingText = parsed.text || '';
  } catch {
    existingText = invoice.notes || '';
  }
  
  if (transactionHash) {
    existingMetadata.transactionHash = transactionHash;
  }

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { 
      status: 'paid', 
      paidAt: now,
      notes: JSON.stringify({ text: existingText, metadata: existingMetadata })
    },
    include: { client: true }
  });

  if (updated.client.passportId) {
    const isLate = now > new Date(updated.dateDue);
    const eventType = isLate ? 'invoice.paid_late' : 'invoice.paid_on_time';
    await trustCore.emit(eventType, {
      invoiceId: updated.id,
      passportId: updated.client.passportId,
      amount: updated.subtotal
    });
  }

  return updated;
}

export async function scanOverdueInvoices() {
  const now = new Date();
  const overdueInvoices = await prisma.invoice.findMany({
    where: {
      status: 'sent',
      dateDue: { lt: now }
    },
    include: { client: true }
  });

  for (const inv of overdueInvoices) {
    await prisma.invoice.update({
      where: { id: inv.id },
      data: { status: 'overdue' }
    });

    if (inv.client.passportId) {
      await trustCore.emit('invoice.overdue', {
        invoiceId: inv.id,
        passportId: inv.client.passportId,
        amount: inv.subtotal
      });
    }
  }
}

export async function getPublicInvoice(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { client: true }
  });
  if (!invoice) throw new CustomError('Invoice not found', 404);
  return invoice;
}

export async function payPublicInvoice(invoiceId: string, transactionHash: string) {
  // Use a system bypass for businessId since this is a public endpoint
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId }
  });
  if (!invoice) throw new CustomError('Invoice not found', 404);

  return markInvoicePaid(invoice.businessId, invoiceId, transactionHash);
}
