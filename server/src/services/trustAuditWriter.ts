import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export type TrustAuditEntryInput = {
  userId: string;
  previousScore: number;
  newScore: number;
  changeReason: string;
  component: string;
  severity: 'positive' | 'neutral' | 'negative';
  weightUsed?: number | null;
  metadata?: any;
  methodology?: string;
};

export class TrustAuditWriter {
  private buffer: any[] = [];
  private maxBuffer = 100;
  private interval: NodeJS.Timeout | null = null;
  private isFlushing = false;

  constructor() {
    this.startInterval();
  }

  private startInterval() {
    // 5 seconds
    this.interval = setInterval(() => this.flush(), 5000);
  }

  public async enqueue(entry: TrustAuditEntryInput) {
    // Determine previous hash for this user
    let previousHash = null;

    // We can fetch the last recorded hash for this user from DB,
    // or from the buffer if there's one pending.
    // To ensure strict chain, we get the last one in the buffer first.
    const lastInBuffer = this.buffer.slice().reverse().find(e => e.userId === entry.userId);
    if (lastInBuffer) {
      previousHash = lastInBuffer.currentHash;
    } else {
      const lastInDb = await prisma.trustAuditTrail.findFirst({
        where: { userId: entry.userId },
        orderBy: { createdAt: 'desc' },
      });
      if (lastInDb) {
        previousHash = lastInDb.currentHash;
      }
    }

    const payloadToHash = JSON.stringify({
      userId: entry.userId,
      previousScore: entry.previousScore,
      newScore: entry.newScore,
      changeReason: entry.changeReason,
      component: entry.component,
      previousHash: previousHash || 'GENESIS',
      timestamp: Date.now()
    });

    const currentHash = crypto.createHash('sha256').update(payloadToHash).digest('hex');

    const auditRecord = {
      userId: entry.userId,
      previousScore: entry.previousScore,
      newScore: entry.newScore,
      changeReason: entry.changeReason,
      component: entry.component,
      severity: entry.severity,
      weightUsed: entry.weightUsed || null,
      metadata: entry.metadata || {},
      previousHash,
      currentHash,
      methodology: entry.methodology || "1.0.0",
    };

    this.buffer.push(auditRecord);

    if (this.buffer.length >= this.maxBuffer) {
      await this.flush();
    }
  }

  public async flush() {
    if (this.buffer.length === 0 || this.isFlushing) return;
    this.isFlushing = true;
    try {
      const batch = [...this.buffer];
      this.buffer = [];
      await prisma.trustAuditTrail.createMany({ data: batch });
    } catch (err) {
      logger.error('[TrustAuditWriter] Flush error', err);
      // In a robust system, we would put the batch back to the front of the buffer
    } finally {
      this.isFlushing = false;
    }
  }

  public stop() {
    if (this.interval) clearInterval(this.interval);
  }
}

export const trustAuditWriter = new TrustAuditWriter();
