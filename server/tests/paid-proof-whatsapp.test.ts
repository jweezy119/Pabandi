import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { send } = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock('../src/services/ai.service', () => ({
  sendWhatsAppMessage: send,
}));

vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../src/utils/pii', () => ({
  maskPhone: (phone: string) => phone,
}));

import {
  sendPaidProofWhatsApp,
  getQueuedWhatsAppMessages,
} from '../src/services/serviceCoordinatorWhatsApp.service';

const base = {
  recipientPhone: '923001234567',
  bookingId: 'bk_123456789',
  amount: 250,
  currency: 'PKR',
  publicId: 'paid_abc123',
  rail: 'raast',
};

describe('paid proof WhatsApp notification', () => {
  beforeEach(() => {
    send.mockReset().mockResolvedValue('msg_1');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sends the public proof link when the provider is configured', async () => {
    vi.stubEnv('OPENWA_API_KEY', 'test');
    vi.stubEnv('APP_URL', 'https://pabandi.test');

    const result = await sendPaidProofWhatsApp(base);

    expect(result).toMatchObject({ success: true, queued: false, messageId: 'msg_1' });
    const message = send.mock.calls[0][1] as string;
    expect(message).toContain('250 PKR');
    expect(message).toContain('https://pabandi.test/paid/paid_abc123');
  });

  it('queues the proof when the provider is not configured', async () => {
    delete process.env.OPENWA_API_KEY;
    delete process.env.EVOLUTION_API_KEY;

    const before = getQueuedWhatsAppMessages().length;
    const result = await sendPaidProofWhatsApp(base);

    expect(result).toMatchObject({ success: true, queued: true });
    const queue = getQueuedWhatsAppMessages();
    expect(queue.length).toBe(before + 1);
    expect(queue[queue.length - 1]).toMatchObject({
      templateName: 'PAID_PROOF',
      recipientPhone: base.recipientPhone,
    });
  });
});
