import { prisma } from './utils/database';
import { trustCore } from './trust/trust-core';
import { markInvoicePaid } from './services/invoice.service';

async function main() {
  console.log('--- DB TEST SCRIPT ---');
  
  // 1. Find or create Business
  let business = await prisma.crmBusiness.findFirst();
  if (!business) {
    business = await prisma.crmBusiness.create({ data: { id: 'test_biz_' + Date.now(), businessName: 'Test Biz', ownerEmail: 'test@example.com', ownerName: 'Test Owner', serviceType: 'Test Service' } });
  }

  // 2. Find or create TrustPassport and Client
  let passport = await prisma.trustPassport.findFirst();
  if (!passport) {
    passport = await prisma.trustPassport.create({ data: { handle: 'test_h_' + Date.now(), displayName: 'Test', paymentScore: 500, deliveryScore: 500, showUpScore: 500 } });
  }

  let client = await prisma.crmClient.findFirst({ where: { passportId: passport.id } });
  if (!client) {
    client = await prisma.crmClient.create({ 
      data: { name: 'Test Client', businessId: business.id, passportId: passport.id } 
    });
  }

  // Trigger P3 events
  const crmService = require('./services/crm.service');
  const escrowService = require('./services/escrow.service').escrowService;
  const trustCore = require('./trust/trust-core').trustCore;

  // Create dummy invoice
  let invoice = await prisma.invoice.findFirst();
  if (!invoice) {
    invoice = await prisma.invoice.create({
      data: {
        businessId: business.id,
        clientId: client.id,
        clientPassportId: passport.id,
        clientName: client.name,
        currency: 'USD',
        subtotal: 100,
        tax: 0,
        total: 100,
        status: 'draft',
        dueDate: new Date(),
        issueDate: new Date(),
      }
    });
  }

  // manually emit client.created and client.updated for the test passport
  try { await trustCore.emit('client.created', { passportId: passport.id, invoiceId: invoice.id, metadata: { clientId: 'test_1' } }); } catch (e) {}
  try { await trustCore.emit('client.updated', { passportId: passport.id, invoiceId: invoice.id, metadata: { clientId: 'test_1' } }); } catch (e) {}

  // escrow events
  try { await escrowService.fundEscrow(passport.id, 100, 'esc_1', invoice.id); } catch (e) {}
  try { await escrowService.releaseEscrow(passport.id, 100, 'esc_1'); } catch (e) {}
  try { await escrowService.disputeEscrow(passport.id, 'Fraud', 'esc_1'); } catch (e) {}

  // 3. Check counts before
  const beforeEvents = await prisma.invoiceTrustEvent.count();
  const beforePassport = await prisma.trustPassport.findUnique({ where: { id: passport.id } });
  console.log(`BEFORE: InvoiceTrustEvent count: ${beforeEvents}`);
  console.log(`BEFORE: Passport ${passport.id} paymentScore: ${beforePassport?.paymentScore}`);

  // 4. Create an invoice
  const testInvoice = await prisma.invoice.create({
    data: {
      businessId: business.id,
      clientId: client.id,
      number: 'TEST-' + Date.now(),
      status: 'sent',
      dateDue: new Date(Date.now() + 86400000), // Due tomorrow (will be on time)
      subtotal: 100,
      lineItems: [],
    }
  });

  // 5. Mark paid
  await markInvoicePaid(business.id, testInvoice.id, 'hash_' + Date.now());

  // 6. Check counts after
  const afterEvents = await prisma.invoiceTrustEvent.count();
  const afterPassport = await prisma.trustPassport.findUnique({ where: { id: passport.id } });
  console.log(`AFTER: InvoiceTrustEvent count: ${afterEvents}`);
  console.log(`AFTER: Passport ${passport.id} paymentScore: ${afterPassport?.paymentScore}`);

  const events = await prisma.invoiceTrustEvent.groupBy({
    by: ['eventType'],
    _count: true
  });
  console.log('EVENTS:', events);
}

main().catch(console.error).finally(() => prisma.$disconnect());
