import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { PublicKey } from '@solana/web3.js';
import { DigitalDollarsSetupCard } from '../components/DigitalDollarsSetupCard';
import { PabandiCheckoutModal } from '../components/PabandiCheckoutModal';
import { formatClientRiskDepositSummary } from '../components/coordinator/risk';
import WorkOrderCard from '../components/coordinator/WorkOrderCard';
import Inspector from '../components/coordinator/Inspector';
import TransparencyPage, {
  ESCROW_PROGRAM_ID,
  decodeEscrowStateSeeds,
} from './TransparencyPage';
import type { WorkOrder } from '../components/coordinator/types';

vi.mock('../lib/phantomConnect', () => ({
  connectWithPhantom: vi.fn(async () => ({
    address: '8xMockPhantomWalletAddress1111111111111111111',
    provider: 'injected',
  })),
  isPhantomEmbeddedConfigured: vi.fn(() => false),
}));

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('Phase 1: Real Exit Self-Custody Settings (DigitalDollarsSetupCard)', () => {
  it('renders primary Phantom Self-Custodial CTA, secondary 1-Click Embedded Wallet CTA, and Your Keys Your Crypto export guidance', async () => {
    const onSave = vi.fn(async () => {});
    render(
      <MemoryRouter>
        <DigitalDollarsSetupCard existingAddress={null} onSaveAddress={onSave} />
      </MemoryRouter>
    );

    const primaryBtn = screen.getByRole('button', {
      name: /Connect Phantom Wallet \(Self-Custodial\)/i,
    });
    const secondaryBtn = screen.getByRole('button', {
      name: /Use Pabandi Embedded Wallet \(1-Click\)/i,
    });
    expect(primaryBtn).toBeTruthy();
    expect(secondaryBtn).toBeTruthy();

    // Advanced section copy
    expect(screen.getByText(/Your Keys, Your Crypto\./i)).toBeTruthy();
    expect(
      screen.getByText(
        /Pabandi is non-custodial\. Your funds are held in a smart contract\. If Pabandi goes offline, you can recover your funds directly on Solana\./i
      )
    ).toBeTruthy();

    // Clicking Export Private Key on an external Phantom setup shows calm non-error guidance + Phantom docs link
    fireEvent.click(screen.getByRole('button', { name: /Export Private Key/i }));
    const guidance = await screen.findByTestId('phantom-self-custody-guidance');
    expect(guidance.getAttribute('role')).toBe('status');
    expect(guidance.textContent).toContain(
      "You are using a self-custodial Phantom wallet. Your keys never leave your extension. If you ever need to export them, follow Phantom's official guide."
    );
    const guideLink = within(guidance).getByRole('link', {
      name: /Read Phantom's Official Export Guide/i,
    });
    expect(guideLink.getAttribute('href')).toContain('help.phantom.com');
  });
});

describe('Phase 2: US Checkout Flow (PabandiCheckoutModal)', () => {
  it('displays Digital Dollars (Solana Pay / USDC) 0% fee and Credit/Debit Card (Square) 2.9% + 30¢ tabs with Solana Pay URI', () => {
    render(
      <PabandiCheckoutModal
        open={true}
        onClose={() => {}}
        title="Roofing Inspection Deposit"
        amount={150}
        currency="USD"
        referenceId="booking-us-101"
        squareNote="pabandi:booking:us-101"
        recipientWallet="8xMockMerchantWallet111111111111111111111111"
      />
    );

    const tablist = screen.getByRole('tablist', { name: /Payment rails/i });
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0].textContent).toContain('Digital Dollars (Solana Pay / USDC)');
    expect(tabs[0].textContent).toContain('0% Fee');
    expect(tabs[0].textContent).toContain('Instant Settlement');
    expect(tabs[1].textContent).toContain('Credit/Debit Card (Square)');
    expect(tabs[1].textContent).toContain('2.9% + 30¢');

    // No Raast or JazzCash tabs in US Checkout
    expect(tablist.textContent).not.toMatch(/Raast|Jazz|EasyPaisa/i);

    // Exact Solana Pay URI link for USDC amount
    const directPayLink = screen.getByRole('link', { name: /Direct Solana Pay \(150\.00 USDC\)/i });
    const href = directPayLink.getAttribute('href') || '';
    expect(href).toContain('solana:8xMockMerchantWallet111111111111111111111111');
    expect(href).toContain('amount=150.00');
    expect(href).toContain('spl-token=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

    // Switching to Square tab shows Square Web Payments container
    fireEvent.click(tabs[1]);
    expect(screen.getByText(/Credit\/Debit Card \(Square Web Payments\)/i)).toBeTruthy();
  });
});

describe('Phase 3: DRPE Trust Score & Coordinator Dashboard Banner', () => {
  it('computes 0% deposit for Trust Score 90+ (LOW) and 20% deposit for brand-new Trust Score 70 (MEDIUM)', () => {
    expect(formatClientRiskDepositSummary({ clientTrustScore: 92 })).toBe(
      'Client Risk: LOW. Deposit Required: 0%.'
    );
    expect(formatClientRiskDepositSummary({ clientTrustScore: 70 })).toBe(
      'Client Risk: MEDIUM. Deposit Required: 20%.'
    );
  });

  it('displays "Client Risk: LOW. Deposit Required: 0%." on Coordinator WorkOrderCard and Inspector', () => {
    const lowRiskWorkOrder: WorkOrder = {
      id: 'wo-us-001',
      status: 'PENDING_ASSIGNMENT',
      priority: 'ROUTINE',
      issueType: 'HVAC Annual Tune-Up',
      description: 'Standard seasonal inspection',
      address: '410 N Michigan Ave, Chicago, IL',
      createdAt: '2026-11-20T10:00:00Z',
      invoiceStatus: 'NOT_READY',
      customer: { id: 'c-1', name: 'Sarah Jenkins' },
      assignments: [],
      attachments: [],
      auditCount: 1,
      clientTrustScore: 94,
      risk: {
        score: 0.14,
        confidence: 0.88,
        p10: 0.1,
        p50: 0.14,
        p90: 0.2,
        outOfRange: false,
        band: 'low',
        factors: [],
        policy: 'AUTONOMOUS',
        calibrated: true,
      },
    };

    render(
      <div>
        <ul>
          <WorkOrderCard workOrder={lowRiskWorkOrder} selected={true} onSelect={() => {}} />
        </ul>
        <Inspector isMobile={false} workOrder={lowRiskWorkOrder} onClose={() => {}} />
      </div>
    );

    expect(screen.getByTestId('coordinator-deposit-summary').textContent).toBe(
      'Client Risk: LOW. Deposit Required: 0%.'
    );
    expect(screen.getByTestId('inspector-deposit-summary').textContent).toBe(
      'Client Risk: LOW. Deposit Required: 0%.'
    );
  });
});

describe('Phase 4: Transparency Page (/transparency)', () => {
  it('renders headline, contract address + Explorer link, and sums live USDC TVL from Solana RPC PDA accounts', async () => {
    // Build a real Anchor EscrowState binary payload matching `lib.rs`
    const discriminator = new Uint8Array([19, 90, 148, 111, 55, 130, 229, 108]);
    const reservationBytes = new TextEncoder().encode('res-us-001');
    const customerPubkey = new PublicKey('11111111111111111111111111111112');
    const raw = new Uint8Array(8 + 4 + reservationBytes.length + 32);
    raw.set(discriminator, 0);
    new DataView(raw.buffer).setUint32(8, reservationBytes.length, true);
    raw.set(reservationBytes, 12);
    raw.set(customerPubkey.toBytes(), 12 + reservationBytes.length);
    const rawBase64 = btoa(String.fromCharCode(...raw));

    // Confirm pure browser decoder extracts exact seeds
    const decoded = decodeEscrowStateSeeds(rawBase64);
    expect(decoded?.reservationId).toBe('res-us-001');

    // Stub Solana JSON-RPC fetch responses
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body || '{}'));
      if (body.method === 'getSlot') {
        return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: 312450123 }), { status: 200 });
      }
      if (body.method === 'getProgramAccounts') {
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: [{ pubkey: 'EscrowStatePda11111111111111111111111111111', account: { data: [rawBase64, 'base64'] } }],
          }),
          { status: 200 }
        );
      }
      if (body.method === 'getMultipleAccounts') {
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: {
              value: [
                {
                  data: {
                    parsed: {
                      info: {
                        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                        tokenAmount: { uiAmount: 2450.5, amount: '2450500000', decimals: 6 },
                      },
                    },
                  },
                },
              ],
            },
          }),
          { status: 200 }
        );
      }
      if (body.method === 'getTokenAccountsByOwner') {
        return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { value: [] } }), { status: 200 });
      }
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: null }), { status: 200 });
    });

    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={['/transparency']}>
          <TransparencyPage />
        </MemoryRouter>
      </HelmetProvider>
    );

    expect(
      screen.getByRole('heading', { name: /A Real Exit\. Pabandi is 100% Non-Custodial\./i })
    ).toBeTruthy();

    expect(screen.getByTestId('smart-contract-address').textContent).toBe(ESCROW_PROGRAM_ID);
    const explorerLink = screen.getByRole('link', { name: /View on Solana Explorer/i });
    expect(explorerLink.getAttribute('href')).toContain(
      `https://explorer.solana.com/address/${ESCROW_PROGRAM_ID}`
    );

    await waitFor(() => {
      const alertText = screen.queryByRole('alert')?.textContent;
      if (alertText) {
        throw new Error(`Unexpected RPC alert: ${alertText}`);
      }
      expect(screen.getByTestId('live-tvl-usdc').textContent).toBe('$2,450.50');
    });
  });
});
