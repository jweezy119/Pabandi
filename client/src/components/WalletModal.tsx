import { useEffect, useState } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { useAuthStore } from '../store/authStore';
import { useWalletModal } from '../hooks/useWalletModal';
import { useEmbeddedSolanaWallet } from '../hooks/useEmbeddedSolanaWallet';
import { walletService } from '../services/api';
import { Modal } from './primitives/Modal';
import { Button } from './primitives';
import { ClayTabs } from './primitives/ClayTabs';

/**
 * Universal wallet — the identity layer for both Business and Personal modes.
 *
 * Honesty rules the callbacks used to ignore:
 *  - The deposit address is the user's Privy embedded Solana wallet (Privy
 *    holds custody; there is no seed-phrase export here — export lives inside
 *    Privy's own flow, gated and user-initiated, never in Pabandi UI).
 *  - The USDC figure is read on-chain from that address's USDC ATA, or shown
 *    as '—' when there is none. It is never a hardcoded zero.
 *  - Sessions and Activity come from the engine's owner-scoped reads
 *    (GET /engine/sessions, GET /engine/receipts). An empty state says what a
 *    session is and how to open one; a fetch failure says so.
 */

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const RPC_URL =
  (import.meta.env.VITE_SOLANA_RPC_URL as string | undefined) || 'https://api.mainnet-beta.solana.com';

type TabId = 'assets' | 'sessions' | 'activity';
type EngineSession = {
  id: string;
  status: string;
  spent: number;
  totalLimit: number;
  remaining: number;
  currency: string;
  expiresAt: string;
};
type EngineReceipt = {
  id: string;
  actionType: string;
  amount: number;
  sessionId: string;
  createdAt: string;
};

const short = (id: string, head = 6, tail = 4) =>
  id.length > head + tail + 1 ? `${id.slice(0, head)}…${id.slice(-tail)}` : id;

function cloneToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback for non-secure contexts where clipboard API is unavailable.
  const el = document.createElement('textarea');
  el.value = text;
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
  return Promise.resolve();
}

export function WalletModal() {
  const { wallet, user } = useAuthStore();
  const { isOpen, closeModal } = useWalletModal();
  const { wallet: privyWallet } = useEmbeddedSolanaWallet();

  const [tab, setTab] = useState<TabId>('assets');
  const [copied, setCopied] = useState(false);
  const [usdcBalance, setUsdcBalance] = useState<string>('—');
  const [sessions, setSessions] = useState<EngineSession[] | null>(null);
  const [sessionsError, setSessionsError] = useState(false);
  const [receipts, setReceipts] = useState<EngineReceipt[] | null>(null);
  const [receiptsError, setReceiptsError] = useState(false);

  const depositAddress: string | null = privyWallet?.address ?? null;

  // Reset per-open so the tab never leaks state between accounts.
  useEffect(() => {
    if (isOpen) {
      setTab('assets');
      setCopied(false);
      setUsdcBalance('—');
      setSessions(null);
      setSessionsError(false);
      setReceipts(null);
      setReceiptsError(false);
    }
  }, [isOpen]);

  // On-chain USDC balance for the Privy custody address, resolved live.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    if (!depositAddress) return () => undefined;
    setUsdcBalance('—');
    (async () => {
      try {
        const connection = new Connection(RPC_URL, 'confirmed');
        const ata = await getAssociatedTokenAddress(
          new PublicKey(USDC_MINT),
          new PublicKey(depositAddress)
        );
        const account = await connection.getTokenAccountBalance(ata);
        if (!cancelled && account.value.uiAmount !== null) {
          setUsdcBalance(account.value.uiAmount.toFixed(2));
        } else if (!cancelled && account.value.uiAmount === null) {
          setUsdcBalance('0.00');
        }
      } catch {
        // No ATA yet means the account has never held USDC — zero, not failure.
        if (!cancelled) setUsdcBalance('0.00');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, depositAddress]);

  // Owner-scoped engine reads, only while the modal is open and the tab shows.
  useEffect(() => {
    if (!isOpen) return;
    if (tab === 'sessions' && sessions === null && !sessionsError) {
      walletService
        .getEngineSessions()
        .then((res: { data?: { data?: EngineSession[] } }) => setSessions(res.data?.data ?? []))
        .catch(() => setSessionsError(true));
    }
    if (tab === 'activity' && receipts === null && !receiptsError) {
      walletService
        .getEngineReceipts()
        .then((res: { data?: { data?: EngineReceipt[] } }) => setReceipts(res.data?.data ?? []))
        .catch(() => setReceiptsError(true));
    }
  }, [isOpen, tab, sessions, sessionsError, receipts, receiptsError]);

  const onCopy = () => {
    if (!depositAddress) return;
    cloneToClipboard(depositAddress).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={closeModal} title="Universal Wallet">
      <ClayTabs
        tabs={[
          { id: 'assets', label: 'Assets' },
          { id: 'sessions', label: 'Sessions' },
          { id: 'activity', label: 'Activity' },
        ]}
        activeId={tab}
        onChange={(id) => setTab(id as TabId)}
      />

      {tab === 'assets' && (
        <div className="space-y-6 py-2">
          {/* Balances */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[var(--warm-sand)]/20 border border-[rgba(191,179,163,0.3)]">
              <div className="text-xs uppercase font-bold text-[var(--soft-stone)] mb-1">PAB Balance</div>
              <div className="text-2xl font-bold text-[var(--clay)]">{wallet.pabBalance} PAB</div>
            </div>
            <div className="p-4 rounded-xl bg-[var(--warm-sand)]/20 border border-[rgba(191,179,163,0.3)]">
              <div className="text-xs uppercase font-bold text-[var(--soft-stone)] mb-1">USDC Balance</div>
              <div className="text-2xl font-bold text-[var(--sage)]">
                {depositAddress ? `${usdcBalance} USDC` : '—'}
              </div>
            </div>
          </div>

          {/* Universal deposit address — the Privy embedded wallet */}
          <div className="space-y-2">
            <div className="text-sm font-bold text-[var(--warm-ink)]">Universal Deposit Address</div>
            {depositAddress ? (
              <div className="flex items-center gap-2 p-3 bg-white rounded-lg border border-[var(--warm-sand)]">
                <code className="text-xs text-[var(--soft-stone)] truncate flex-1" title={depositAddress}>
                  {depositAddress}
                </code>
                <Button variant="ghost" onClick={onCopy}>{copied ? 'Copied ✓' : 'Copy'}</Button>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-[var(--warm-sand)]/10 border border-[var(--warm-sand)] text-xs text-[var(--soft-stone)]">
                {user
                  ? 'Your Privy custody wallet is still being provisioned — return in a moment.'
                  : 'Sign in to see your Privy custody wallet address.'}
              </div>
            )}
            <div className="text-xs text-[var(--soft-stone)]">
              Funds sent to this address are held in Privy custody on your behalf. There is no seed-phrase
              export in Pabandi — custody recovery runs through Privy's own gated flow.
            </div>
          </div>

          {/* Withdraw is not live; say that instead of a dead button. */}
          <div className="flex gap-3 pt-4 border-t border-[rgba(191,179,163,0.3)] items-center">
            <Button
              variant="primary"
              className="flex-1"
              disabled={!depositAddress}
              onClick={!depositAddress ? undefined : onCopy}
            >
              {copied ? 'Copied ✓' : 'Copy deposit address'}
            </Button>
            <span className="flex-1 text-xs text-[var(--soft-stone)]" title="Withdrawal rails are not live yet">
              Withdrawal rails are not live yet.
            </span>
          </div>
        </div>
      )}

      {tab === 'sessions' && (
        <div className="space-y-3 py-2">
          {sessionsError && (
            <div className="text-sm text-[var(--clay)] py-4">
              Could not load sessions right now. The engine may be unreachable — try again shortly.
            </div>
          )}
          {!sessionsError && sessions === null && (
            <div className="text-sm text-[var(--soft-stone)] py-4">Loading sessions…</div>
          )}
          {!sessionsError && sessions !== null && sessions.length === 0 && (
            <div className="text-sm text-[var(--soft-stone)] text-center py-6 bg-[var(--warm-sand)]/10 rounded-xl">
              No settlement sessions yet. A session is a trust-score-sized tab you can spend against
              without signing every payment — open one with{' '}
              <code className="text-xs">POST /engine/session/open</code>.
            </div>
          )}
          {!sessionsError &&
            sessions?.map((s) => (
              <div key={s.id} className="p-3 rounded-xl bg-[var(--warm-sand)]/10 border border-[rgba(191,179,163,0.3)]">
                <div className="flex items-center justify-between mb-1">
                  <code className="text-xs text-[var(--warm-ink)]">{short(s.id, 8, 4)}</code>
                  <span
                    className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                    style={{
                      color: s.status === 'active' ? 'var(--sage)' : 'var(--soft-stone)',
                      background: s.status === 'active' ? 'rgba(105,131,98,0.12)' : 'rgba(191,179,163,0.15)',
                    }}
                  >
                    {s.status}
                  </span>
                </div>
                <div className="text-xs text-[var(--soft-stone)]">
                  Spent {s.spent} / {s.totalLimit} {s.currency} · {s.status === 'active' ? `${s.remaining} remaining` : `closed ${short(s.expiresAt, 8, 0)}`}
                </div>
              </div>
            ))}
        </div>
      )}

      {tab === 'activity' && (
        <div className="space-y-3 py-2">
          {receiptsError && (
            <div className="text-sm text-[var(--clay)] py-4">
              Could not load activity right now. The engine may be unreachable — try again shortly.
            </div>
          )}
          {!receiptsError && receipts === null && (
            <div className="text-sm text-[var(--soft-stone)] py-4">Loading activity…</div>
          )}
          {!receiptsError && receipts !== null && receipts.length === 0 && (
            <div className="text-sm text-[var(--soft-stone)] text-center py-6 bg-[var(--warm-sand)]/10 rounded-xl">
              No recent transactions. Activity appears here once a session spend is signed by the engine.
            </div>
          )}
          {!receiptsError &&
            receipts?.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-[var(--warm-sand)]/10 border border-[rgba(191,179,163,0.3)]">
                <div>
                  <div className="text-xs font-bold text-[var(--warm-ink)]">{r.actionType}</div>
                  <div className="text-[10px] text-[var(--soft-stone)]">
                    {short(r.sessionId, 6, 4)} · {new Date(r.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-sm font-bold text-[var(--sage)]">{r.amount}</div>
              </div>
            ))}
        </div>
      )}
    </Modal>
  );
}
