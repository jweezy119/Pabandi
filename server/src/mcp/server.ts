import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { prisma } from '../utils/database';
import { trustCore } from '../services/trust-core.service';

const server = new McpServer({
  name: 'pabandi-mcp',
  version: '1.0.0',
  description: 'PabandiOS MCP Server — Trust operating system for service businesses',
});

// ── BOOKING TOOLS ────────────────────────────────────

server.tool(
  'create_booking',
  'Create a booking with AI trust scoring and escrow protection',
  {
    restaurant: z.string().describe('Restaurant name or ID'),
    date: z.string().describe('Booking date (ISO 8601)'),
    guests: z.number().describe('Number of guests'),
    customerWallet: z.string().describe('Customer Solana wallet address'),
    specialRequests: z.string().optional().describe('Special requests'),
  },
  async (params) => {
    try {
      // In production: create booking with escrow
      const booking = {
        id: 'booking_' + Date.now(),
        ...params,
        status: 'PENDING',
        escrowId: 'escrow_' + Date.now(),
        trustScore: await trustCore.calculateScore(params.customerWallet),
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(booking, null, 2) }],
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
        isError: true,
      };
    }
  }
);

server.tool(
  'get_booking_status',
  'Check booking status and escrow release conditions',
  {
    bookingId: z.string().describe('Booking ID'),
  },
  async (params) => {
    try {
      const booking = await prisma.bookingRecord.findUnique({
        where: { id: params.bookingId },
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(booking, null, 2) }],
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
        isError: true,
      };
    }
  }
);

// ── FREIGHT TOOLS ────────────────────────────────────

server.tool(
  'get_freight_quote',
  'Get freight rate estimate with carrier matching',
  {
    origin: z.string().describe('Origin city'),
    destination: z.string().describe('Destination city'),
    weight: z.number().describe('Weight in kg'),
    cargoType: z.string().describe('Type of cargo'),
  },
  async (params) => {
    try {
      // In production: calculate rate, match carriers
      const quote = {
        id: 'quote_' + Date.now(),
        ...params,
        estimatedRate: 150 + Math.random() * 200,
        currency: 'USD',
        carriers: ['Carrier A', 'Carrier B'],
        trustRequired: 50,
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(quote, null, 2) }],
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
        isError: true,
      };
    }
  }
);

// ── PROPERTY TOOLS ───────────────────────────────────

server.tool(
  'list_properties',
  'List available properties with tenant trust scores',
  {
    city: z.string().optional().describe('City to search'),
    minTrustScore: z.number().optional().describe('Minimum tenant trust score'),
    maxRent: z.number().optional().describe('Maximum monthly rent in USD'),
  },
  async (params) => {
    try {
      const properties = await prisma.abodeUnit.findMany({
        where: {
          status: 'AVAILABLE',
          ...(params.city ? { city: params.city } : {}),
          ...(params.maxRent ? { rentAmount: { lte: params.maxRent } } : {}),
        },
        take: 20,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(properties, null, 2) }],
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
        isError: true,
      };
    }
  }
);

// ── PIPELINE TOOLS ───────────────────────────────────

server.tool(
  'create_lead',
  'Create a CRM lead with trust-enriched data',
  {
    name: z.string().describe('Lead name'),
    email: z.string().optional().describe('Lead email'),
    phone: z.string().optional().describe('Lead phone'),
    source: z.string().optional().describe('Lead source'),
    value: z.number().optional().describe('Estimated deal value'),
  },
  async (params) => {
    try {
      const lead = await prisma.pipelineLead.create({
        data: {
          name: params.name,
          email: params.email,
          phone: params.phone,
          source: params.source || 'mcp',
          value: params.value,
          stage: 'new',
          ownerId: 'system',
          businessId: 'default',
          passportId: '',
        },
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(lead, null, 2) }],
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
        isError: true,
      };
    }
  }
);

server.tool(
  'get_pipeline_stats',
  'Get pipeline statistics and conversion rates',
  {
    businessId: z.string().describe('Business ID'),
  },
  async (params) => {
    try {
      const stats = await prisma.pipelineLead.groupBy({
        by: ['stage'],
        where: { businessId: params.businessId },
        _count: { stage: true },
        _sum: { value: true },
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }],
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
        isError: true,
      };
    }
  }
);

// ── LEDGER TOOLS ─────────────────────────────────────

server.tool(
  'create_invoice',
  'Create an invoice with escrow backing',
  {
    clientId: z.string().describe('Client ID'),
    amount: z.number().describe('Invoice amount'),
    currency: z.string().default('USD').describe('Currency'),
    dueDate: z.string().describe('Due date (ISO 8601)'),
    description: z.string().optional().describe('Invoice description'),
  },
  async (params) => {
    try {
      const invoice = await prisma.ledgerInvoice.create({
        data: {
          businessId: 'default',
          clientId: params.clientId,
          number: 'INV-' + Date.now(),
          amount: params.amount,
          currency: params.currency,
          status: 'draft',
          dueDate: new Date(params.dueDate),
          lineItems: JSON.stringify([{ description: params.description, amount: params.amount }]),
        },
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(invoice, null, 2) }],
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
        isError: true,
      };
    }
  }
);

server.tool(
  'get_cashflow',
  'Get cash flow report for a business',
  {
    businessId: z.string().describe('Business ID'),
    period: z.enum(['week', 'month', 'quarter', 'year']).default('month'),
  },
  async (params) => {
    try {
      const invoices = await prisma.ledgerInvoice.findMany({
        where: { businessId: params.businessId },
      });
      const expenses = await prisma.ledgerExpense.findMany({
        where: { businessId: params.businessId },
      });
      const totalRevenue = invoices.reduce((sum: number, inv: any) => sum + inv.amount, 0);
      const totalExpenses = expenses.reduce((sum: number, exp: any) => sum + exp.amount, 0);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                period: params.period,
                totalRevenue,
                totalExpenses,
                netCashflow: totalRevenue - totalExpenses,
                invoiceCount: invoices.length,
                expenseCount: expenses.length,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
        isError: true,
      };
    }
  }
);

// ── TRUST TOOLS ──────────────────────────────────────

server.tool(
  'verify_trust',
  'Verify a user's or business's reliability score',
  {
    passportId: z.string().describe('Trust Passport ID'),
  },
  async (params) => {
    try {
      const passport = await trustCore.getPassport(params.passportId);
      return {
        content: [{ type: 'text', text: JSON.stringify(passport, null, 2) }],
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
        isError: true,
      };
    }
  }
);

server.tool(
  'initiate_escrow',
  'Initiate a Solana escrow for any conditional payment',
  {
    amount: z.number().describe('Amount in USDC'),
    currency: z.string().default('USDC').describe('Currency'),
    conditions: z.string().describe('Release conditions'),
    payer: z.string().describe('Payer wallet address'),
    payee: z.string().describe('Payee wallet address'),
  },
  async (params) => {
    try {
      // In production: create on-chain escrow
      const escrow = {
        id: 'escrow_' + Date.now(),
        ...params,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(escrow, null, 2) }],
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
        isError: true,
      };
    }
  }
);

// ── START SERVER ─────────────────────────────────────

export async function startMCPServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log('[MCP] PabandiOS MCP Server started');
}

export { server as mcpServer };
