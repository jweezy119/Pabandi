import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelegramNotificationService } from '../src/services/telegram-notification.service';
import { prisma } from '../src/utils/database';
import { telegramBot } from '../src/services/telegram-bot.service';

vi.mock('../src/services/telegram-bot.service', () => ({
  telegramBot: {
    api: {
      sendMessage: vi.fn().mockResolvedValue({ message_id: 12345 }),
    },
  },
}));

vi.mock('../src/utils/database', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    escrowDispute: {
      findFirst: vi.fn(),
    },
  },
}));

describe('TelegramNotificationService (Real-Time Push Alerts via @PabanBot)', () => {
  let service: TelegramNotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TelegramNotificationService();
  });

  describe('sendToUser', () => {
    it('returns false if user is not found or has no telegramId', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

      const result = await service.sendToUser('user-123', {
        title: '🔔 Test Alert',
        body: 'Test body',
      });

      expect(result).toBe(false);
      expect(telegramBot?.api.sendMessage).not.toHaveBeenCalled();
    });

    it('sends formatted markdown message with inline webApp button when telegramId exists', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'user-123',
        telegramId: '987654321',
        firstName: 'Alice',
      } as any);

      const result = await service.sendToUser('user-123', {
        title: '💰 *Escrow Funded*',
        body: 'Amount: $500 USDC',
        actionUrl: 'https://pabandi.com/gigs',
        actionText: '🚀 View Gig',
      });

      expect(result).toBe(true);
      expect(telegramBot?.api.sendMessage).toHaveBeenCalledWith(
        '987654321',
        '💰 *Escrow Funded*\n\nAmount: $500 USDC',
        expect.objectContaining({
          parse_mode: 'Markdown',
          reply_markup: expect.anything(),
        })
      );
    });
  });

  describe('notifyEscrowFunded', () => {
    it('sends escrow funded push notification to payee', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'agent-bob',
        telegramId: '555123456',
        firstName: 'Bob',
      } as any);

      await service.notifyEscrowFunded({
        gigId: 'gig-999',
        gigTitle: 'Autonomous Trading Bot',
        amountUsd: 1200,
        rail: 'solana',
        payeeId: 'agent-bob',
        txHash: '5K3y...txid',
      });

      expect(telegramBot?.api.sendMessage).toHaveBeenCalledWith(
        '555123456',
        expect.stringContaining('Autonomous Trading Bot'),
        expect.anything()
      );
      expect(telegramBot?.api.sendMessage).toHaveBeenCalledWith(
        '555123456',
        expect.stringContaining('$1200.00 USDC'),
        expect.anything()
      );
    });
  });

  describe('notifyEscrowReleased', () => {
    it('sends release notice with trust score boost confirmation', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'agent-bob',
        telegramId: '555123456',
        firstName: 'Bob',
      } as any);

      await service.notifyEscrowReleased({
        gigId: 'gig-999',
        gigTitle: 'Autonomous Trading Bot',
        amountUsd: 1200,
        payeeId: 'agent-bob',
        payeeTrustScoreDelta: 25,
      });

      expect(telegramBot?.api.sendMessage).toHaveBeenCalledWith(
        '555123456',
        expect.stringContaining('+25 points earned!'),
        expect.anything()
      );
    });
  });

  describe('notifyNewGig', () => {
    it('broadcasts new gig alerts to active builders/agents with Telegram linked', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
        { id: 'builder-1', telegramId: '111111' },
        { id: 'builder-2', telegramId: '222222' },
      ] as any);

      await service.notifyNewGig({
        gigId: 'gig-101',
        title: 'Smart Contract Auditor Needed',
        description: 'Audit Solana Anchor program with Mollusk',
        category: 'Web3 Development',
        requiredSkills: ['Rust', 'Solana', 'Anchor'],
        budgetUsd: 2500,
      });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            telegramId: { not: null },
            profileType: { in: ['SOLO_BUILDER', 'SERVICE_BUSINESS'] },
          },
        })
      );

      expect(telegramBot?.api.sendMessage).toHaveBeenCalledTimes(2);
      expect(telegramBot?.api.sendMessage).toHaveBeenCalledWith(
        '111111',
        expect.stringContaining('Smart Contract Auditor Needed'),
        expect.anything()
      );
    });
  });

  describe('notifyDisputeEvidenceSubmitted', () => {
    it('sends tamper-proof evidence notification with VCAP integrity hash', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'juror-1',
        telegramId: '999888777',
      } as any);

      await service.notifyDisputeEvidenceSubmitted({
        workOrderId: 'wo-404',
        fileName: 'code_audit_defect_proof.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 204800,
        vcapHash: 'abcdef0123456789fedcba9876543210',
        targetUserIds: ['juror-1'],
      });

      expect(telegramBot?.api.sendMessage).toHaveBeenCalledWith(
        '999888777',
        expect.stringContaining('Sulha Dispute Evidence Uploaded'),
        expect.anything()
      );
      expect(telegramBot?.api.sendMessage).toHaveBeenCalledWith(
        '999888777',
        expect.stringContaining('code_audit_defect_proof.pdf'),
        expect.anything()
      );
      expect(telegramBot?.api.sendMessage).toHaveBeenCalledWith(
        '999888777',
        expect.stringContaining('abcdef0123456789'),
        expect.anything()
      );
    });
  });
});

