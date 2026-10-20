import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WalletModal } from './WalletModal';

/**
 * The identity-layer requirement: the Universal Wallet must read the same in
 * Business and Personal mode — one wallet, one set of numbers, no mode-specific
 * fork of balances or custody. And the honesty requirements: the deposit
 * address is the Privy custody wallet (never a placeholder), and empty
 * sessions/activity states describe how to reach one instead of pretending.
 */

const auth = vi.hoisted(() => ({
  wallet: { address: null, type: null, pabBalance: 42, totalEarned: 0 },
  user: null as null | { preferredMode?: string },
}));

const modal = vi.hoisted(() => ({ isOpen: true }));

vi.mock('../hooks/useWalletModal', () => ({
  useWalletModal: () => ({ isOpen: modal.isOpen, openModal: () => {}, closeModal: () => {} }),
}));

vi.mock('../store/authStore', () => ({
  useAuthStore: () => auth,
}));

vi.mock('../hooks/useEmbeddedSolanaWallet', () => ({
  useEmbeddedSolanaWallet: () => ({
    wallet: { address: 'SoLanaPrivyCustodyAddress11111111111111111111' },
    ready: true,
  }),
}));

vi.mock('@solana/web3.js', () => ({
  Connection: vi.fn(() => ({
    getTokenAccountBalance: async () => ({ value: { uiAmount: 12.5 } }),
  })),
  PublicKey: vi.fn((v: string) => ({ toBase58: () => v })),
}));

vi.mock('@solana/spl-token', () => ({
  getAssociatedTokenAddress: async (mint: unknown, owner: unknown) => ({ mint, owner }),
}));

// The USDC fetch is an async side effect; stub it wholesale — the modal must
// not speak to the real mainnet from tests.
vi.mock('../services/api', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    walletService: {
      ...(actual.walletService as object),
      getEngineSessions: async () => ({ data: { data: [] } }),
      getEngineReceipts: async () => ({ data: { data: [] } }),
    },
  };
});

function setAuth(mode: 'business' | 'personal') {
  auth.wallet = { address: null, type: null, pabBalance: 42, totalEarned: 0 };
  auth.user = { preferredMode: mode };
}

beforeEach(() => {
  modal.isOpen = true;
});

describe('WalletModal identity layer', () => {
  it('renders the Privy custody deposit address verbatim in Business mode', async () => {
    setAuth('business');
    render(<WalletModal />);
    await screen.findByText('SoLanaPrivyCustodyAddress11111111111111111111');
    expect(screen.getByText(/Universal Deposit Address/i)).toBeDefined();
  });

  it('reads exactly the same in Personal mode — one wallet, both modes', async () => {
    setAuth('personal');
    render(<WalletModal />);
    await screen.findByText('SoLanaPrivyCustodyAddress11111111111111111111');
    expect(screen.getByText(/42 PAB/i)).toBeDefined();
  });

  it('explains custody instead of offering a seed-phrase export', async () => {
    setAuth('personal');
    render(<WalletModal />);
    await screen.findByText('SoLanaPrivyCustodyAddress11111111111111111111');
    const custodyNote = screen.getByText(/no seed-phrase/i);
    expect(custodyNote).toBeDefined();
  });

  it('Sessions empty state points at the open-session call instead of faking data', async () => {
    setAuth('business');
    render(<WalletModal />);
    fireEvent.click(screen.getByRole('button', { name: 'Sessions' }));
    expect(await screen.findByText(/session\/open/i)).toBeDefined();
  });

  it('Activity empty state describes engine-signed spends, no fake rows', async () => {
    setAuth('personal');
    render(<WalletModal />);
    fireEvent.click(screen.getByRole('button', { name: 'Activity' }));
    expect(await screen.findByText(/no recent transactions/i)).toBeDefined();
  });
});
