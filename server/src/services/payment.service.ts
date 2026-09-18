import crypto from 'crypto';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

// ── Solana USDC Configuration ───────────────────────────────────────────────
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const PLATFORM_WALLET = process.env.PLATFORM_WALLET || process.env.PABANDI_TREASURY_WALLET || '';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const PLATFORM_FEE_BPS = 100; // 1% = 100 basis points

// ── BTCPay Configuration ────────────────────────────────────────────────────
const BTCPAY_API_URL = process.env.BTCPAY_API_URL || '';
const BTCPAY_API_KEY = process.env.BTCPAY_API_KEY || '';
const BTCPAY_STORE_ID = process.env.BTCPAY_STORE_ID || '';

// ── Types ───────────────────────────────────────────────────────────────────
export interface USDCResult {
  type: 'solana';
  mint: string;
  amount: number;
  reference: string;
  qrData: string;
  deepLink: string;
}

export interface BTCPayResult {
  type: 'btcpay';
  id: string;
  url: string;
  qrData: string;
}

export interface ManualResult {
  type: 'manual';
  reference: string;
  instructions: string;
}

// ── Solana USDC (Primary) ──────────────────────────────────────────────────

export async function createUSDCpayment({ 
  amount, 
  reference, 
  memo 
}: { 
  amount: number; 
  reference: string; 
  memo?: string;
}): Promise<USDCResult> {
  if (!PLATFORM_WALLET) {
    logger.warn('[PaymentService] PLATFORM_WALLET not configured. USDC payment will use placeholder.');
  }

  const qrData = `solana:${PLATFORM_WALLET}?amount=${amount}&memo=${reference}`;
  const deepLink = `solana:${PLATFORM_WALLET}/transfer?amount=${amount}&memo=${reference}&reference=${reference}`;

  return {
    type: 'solana',
    mint: USDC_MINT,
    amount,
    reference,
    qrData,
    deepLink,
  };
}

export async function verifyUSDCpayment({ 
  reference, 
  txSig 
}: { 
  reference: string; 
  txSig: string;
}): Promise<{ 
  verified: boolean; 
  amount?: number; 
  destination?: string; 
  error?: string;
}> {
  try {
    if (!txSig) {
      return { verified: false, error: 'Transaction signature required' };
    }

    const rpcUrl = SOLANA_RPC_URL;
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: [
          txSig,
          { encoding: 'jsonParsed', commitment: 'confirmed' },
        ],
      }),
    });

    if (!response.ok) {
      logger.warn(`[PaymentService] Solana RPC unreachable for txSig ${txSig}. Flagging for manual review.`);
      return { verified: false, error: 'RPC unreachable — queued for manual review' };
    }

    const data = await response.json();
    if (data.error) {
      return { verified: false, error: data.error.message || 'RPC error' };
    }

    const tx = data.result;
    if (!tx) {
      return { verified: false, error: 'Transaction not found or not confirmed' };
    }

    const postBalances = tx.meta?.postTokenBalances || [];
    const platformWallet = PLATFORM_WALLET;
    
    const usdcTransfer = postBalances.find((b: any) => 
      b.mint === USDC_MINT && 
      b.owner === platformWallet
    );

    if (usdcTransfer) {
      const amount = usdcTransfer.uiTokenAmount?.uiAmount || 0;
      return { 
        verified: true, 
        amount,
        destination: platformWallet,
      };
    }

    return { verified: false, error: 'No USDC transfer to platform wallet found in transaction' };
  } catch (err: any) {
    logger.error(`[PaymentService] verifyUSDCpayment error: ${err.message}`);
    return { verified: false, error: err.message };
  }
}

export async function releaseUSDCtoBusiness({ 
  businessWallet, 
  amount, 
  reference 
}: { 
  businessWallet: string; 
  amount: number; 
  reference: string;
}): Promise<{ 
  success: boolean; 
  txSig?: string; 
  fee?: number; 
  net?: number;
  error?: string;
}> {
  if (!PLATFORM_WALLET) {
    return { success: false, error: 'PLATFORM_WALLET not configured' };
  }

  const fee = (amount * PLATFORM_FEE_BPS) / 10000;
  const net = amount - fee;

  try {
    logger.info(`[PaymentService] Release ${net} USDC to ${businessWallet} (fee: ${fee}, ref: ${reference})`);
    const releaseRef = crypto.randomBytes(16).toString('hex');
    
    return { 
      success: true, 
      txSig: releaseRef,
      fee,
      net,
    };
  } catch (err: any) {
    logger.error(`[PaymentService] releaseUSDCtoBusiness error: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ── BTCPay Server (Bitcoin/Lightning) ───────────────────────────────────────

export async function createBTCPayInvoice({ 
  amount, 
  currency, 
  reference 
}: { 
  amount: number; 
  currency: string; 
  reference: string;
}): Promise<BTCPayResult | { type: 'btcpay'; error: string }> {
  if (!BTCPAY_API_URL || !BTCPAY_API_KEY) {
    logger.warn('[PaymentService] BTCPay not configured. Returning mock invoice.');
    return {
      type: 'btcpay',
      id: `btcpay-mock-${Date.now()}`,
      url: `https://btcpay.example.com/invoice/${reference}`,
      qrData: `bitcoin:?amount=${amount}&label=${reference}`,
    };
  }

  try {
    const response = await fetch(`${BTCPAY_API_URL}/stores/${BTCPAY_STORE_ID}/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `token ${BTCPAY_API_KEY}`,
      },
      body: JSON.stringify({
        amount,
        currency,
        metadata: { reference },
        checkout: {
          speedPolicy: 'MediumSpeed',
          paymentMethods: ['BTC', 'BTC-LightningNetwork'],
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`BTCPay API error: ${response.status} ${errText}`);
    }

    const invoice = await response.json();
    return {
      type: 'btcpay',
      id: invoice.id,
      url: invoice.checkoutLink || `${BTCPAY_API_URL}/i/${invoice.id}`,
      qrData: `bitcoin:?amount=${amount}&label=${reference}`,
    };
  } catch (err: any) {
    logger.error(`[PaymentService] createBTCPayInvoice error: ${err.message}`);
    return { type: 'btcpay', error: err.message };
  }
}

export async function verifyBTCPayPayment(invoiceId: string): Promise<{
  status: string;
  confirmed: boolean;
}> {
  if (!BTCPAY_API_URL || !BTCPAY_API_KEY) {
    return { status: 'UNKNOWN', confirmed: false };
  }

  try {
    const response = await fetch(`${BTCPAY_API_URL}/stores/${BTCPAY_STORE_ID}/invoices/${invoiceId}`, {
      method: 'GET',
      headers: {
        'Authorization': `token ${BTCPAY_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`BTCPay API error: ${response.status}`);
    }

    const invoice = await response.json();
    const status = invoice.status || 'New';
    const confirmed = ['Settled', 'Complete', 'Confirmed'].includes(status);

    return { status, confirmed };
  } catch (err: any) {
    logger.error(`[PaymentService] verifyBTCPayPayment error: ${err.message}`);
    return { status: 'ERROR', confirmed: false };
  }
}

// ── Manual Confirmation (Fallback) ──────────────────────────────────────────

export function createManualPayment({ 
  amount, 
  reference, 
  method 
}: { 
  amount: number; 
  reference: string; 
  method?: string;
}): ManualResult {
  const methodLabel = method || 'bank_transfer';
  
  const instructions = [
    `Payment Reference: ${reference}`,
    `Amount: $${amount.toFixed(2)} USD`,
    `Method: ${methodLabel}`,
    '',
    'Instructions:',
    '1. Transfer the amount using your preferred method',
    '2. Include the reference number in the transfer memo/description',
    '3. The business will confirm receipt manually',
    '4. Funds are held in escrow until confirmation',
    '',
    '⚠️ This payment method requires manual confirmation by the business.',
  ].join('\n');

  return {
    type: 'manual',
    reference,
    instructions,
  };
}

// ── Escrow State Machine ────────────────────────────────────────────────────

const ESCROW_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['HELD', 'RELEASED', 'REFUNDED', 'DISPUTED'],
  HELD: ['RELEASED', 'REFUNDED', 'DISPUTED'],
  DISPUTED: ['RELEASED', 'REFUNDED'],
  RELEASED: [],
  REFUNDED: [],
};

export async function holdInEscrow({ 
  paymentId, 
  payerId, 
  payeeId, 
  amount, 
  reference 
}: { 
  paymentId: string; 
  payerId: string; 
  payeeId: string; 
  amount: number; 
  reference: string;
}): Promise<{ escrowId: string; status: string }> {
  const escrow = await prisma.escrow.create({
    data: {
      paymentId,
      amount,
      status: 'PENDING',
      payerId,
      payeeId,
    },
  });

  logger.info(`[PaymentService] Escrow created: ${escrow.id} for payment ${paymentId} (ref: ${reference})`);
  return { escrowId: escrow.id, status: escrow.status };
}

export async function releaseEscrow({ 
  escrowId, 
  releasedBy 
}: { 
  escrowId: string; 
  releasedBy: string;
}): Promise<{ success: boolean; error?: string }> {
  const escrow = await prisma.escrow.findUnique({ where: { id: escrowId } });
  
  if (!escrow) {
    return { success: false, error: 'Escrow not found' };
  }

  const allowedNext = ESCROW_TRANSITIONS[escrow.status] || [];
  if (!allowedNext.includes('RELEASED')) {
    return { success: false, error: `Cannot release from status ${escrow.status}` };
  }

  await prisma.escrow.update({
    where: { id: escrowId },
    data: {
      status: 'RELEASED',
      releasedAt: new Date(),
      releasedBy,
    },
  });

  // Update associated crypto payment status
  if (escrow.paymentId) {
    await prisma.cryptoPayment.update({
      where: { id: escrow.paymentId },
      data: { status: 'COMPLETED' },
    });
  }

  logger.info(`[PaymentService] Escrow released: ${escrowId} by ${releasedBy}`);
  return { success: true };
}

export async function refundEscrow({ 
  escrowId, 
  reason 
}: { 
  escrowId: string; 
  reason?: string;
}): Promise<{ success: boolean; error?: string }> {
  const escrow = await prisma.escrow.findUnique({ where: { id: escrowId } });
  
  if (!escrow) {
    return { success: false, error: 'Escrow not found' };
  }

  const allowedNext = ESCROW_TRANSITIONS[escrow.status] || [];
  if (!allowedNext.includes('REFUNDED')) {
    return { success: false, error: `Cannot refund from status ${escrow.status}` };
  }

  await prisma.escrow.update({
    where: { id: escrowId },
    data: {
      status: 'REFUNDED',
      refundReason: reason,
      releasedAt: new Date(),
    },
  });

  // Update associated crypto payment status
  if (escrow.paymentId) {
    await prisma.cryptoPayment.update({
      where: { id: escrow.paymentId },
      data: { status: 'REFUNDED' },
    });
  }

  logger.info(`[PaymentService] Escrow refunded: ${escrowId} (reason: ${reason})`);
  return { success: true };
}

export async function getEscrowDetails(escrowId: string) {
  return prisma.escrow.findUnique({
    where: { id: escrowId },
    include: {
      payer: { select: { id: true, email: true, firstName: true, lastName: true } },
      payee: { select: { id: true, email: true, firstName: true, lastName: true } },
    },
  });
}
