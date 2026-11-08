import { describe, it, expect, vi } from 'vitest';
import { openwaTemplateService } from '../src/services/openwa.template.service';

describe('WhatsApp No-Show Recovery Engine & Templates', () => {
  it('renders the high-converting noshow_recovery_outreach template', () => {
    const rendered = openwaTemplateService.renderTemplate('noshow_recovery_outreach', {
      ownerName: 'Dr. Tariq',
      businessName: 'Apex Dental Clinic',
      depositAmount: 'Rs. 1,000',
      claimUrl: 'https://pabandi.com/claim/apex-dental',
    });

    expect(rendered).toContain('Dr. Tariq');
    expect(rendered).toContain('Apex Dental Clinic');
    expect(rendered).toContain('100% Free to use');
    expect(rendered).toContain('transfers 80% directly to your bank account');
    expect(rendered).toContain('https://pabandi.com/claim/apex-dental');
  });

  it('renders the deposit_commitment_request template with checkout link', () => {
    const rendered = openwaTemplateService.renderTemplate('deposit_commitment_request', {
      customerName: 'Fatima',
      businessName: 'Studio Glow',
      reservationDate: 'Saturday',
      reservationTime: '3:00 PM',
      depositAmount: 'Rs. 500',
      checkoutUrl: 'https://pabandi.com/book/studio-glow?ref=wa_test',
    });

    expect(rendered).toContain('Fatima');
    expect(rendered).toContain('Studio Glow');
    expect(rendered).toContain('Saturday at 3:00 PM');
    expect(rendered).toContain('Rs. 500');
    expect(rendered).toContain('https://pabandi.com/book/studio-glow?ref=wa_test');
  });

  it('renders the forfeited_deposit_settlement notification with 80/20 split', () => {
    const grossDeposit = 50.0;
    const platformFee = Math.round(grossDeposit * 0.20 * 100) / 100;
    const merchantPayout = Math.round((grossDeposit - platformFee) * 100) / 100;

    const rendered = openwaTemplateService.renderTemplate('forfeited_deposit_settlement', {
      businessName: 'Glamour Salon',
      reservationDate: 'Nov 8, 2026',
      reservationTime: '2:30 PM',
      depositAmount: `$${grossDeposit.toFixed(2)}`,
      platformFeeAmount: `$${platformFee.toFixed(2)}`,
      payoutAmount: `$${merchantPayout.toFixed(2)}`,
      escrowId: 'res_123_abc',
    });

    expect(rendered).toContain('No-Show Deposit Recovered!');
    expect(rendered).toContain('$50.00');
    expect(rendered).toContain('$10.00');
    expect(rendered).toContain('$40.00');
    expect(rendered).toContain('#res_123_abc');
  });

  it('accurately calculates 20% platform recovery take rate on forfeited bookings', () => {
    const testCases = [
      { gross: 10.0, expectedPlatformTake: 2.0, expectedMerchantPayout: 8.0 },
      { gross: 25.0, expectedPlatformTake: 5.0, expectedMerchantPayout: 20.0 },
      { gross: 50.0, expectedPlatformTake: 10.0, expectedMerchantPayout: 40.0 },
      { gross: 100.0, expectedPlatformTake: 20.0, expectedMerchantPayout: 80.0 },
    ];

    for (const { gross, expectedPlatformTake, expectedMerchantPayout } of testCases) {
      const take = Math.round(gross * 0.20 * 100) / 100;
      const payout = Math.round((gross - take) * 100) / 100;

      expect(take).toBe(expectedPlatformTake);
      expect(payout).toBe(expectedMerchantPayout);
      expect(take + payout).toBe(gross);
    }
  });
});

