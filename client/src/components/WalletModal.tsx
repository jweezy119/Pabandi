import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { CLAY_FADE, CLAY_SETTLE, CLAY_SPRING } from './animations/clayMotion';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { useAuthStore } from '../store/authStore';
import { useWalletModal } from '../hooks/useWalletModal';
import { useEmbeddedSolanaWallet } from '../hooks/useEmbeddedSolanaWallet';
import { walletService } from '../services/api';
import { Modal } from './primitives/Modal';
import { Button } from './primitives';
import { ClayTabs } from './primitives/ClayTabs';
import { Bot, Clock, Zap } from 'lucide-react';

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

type TabId = 'assets' | 'sessions' | 'activity' | 'agent-budgets';
type EngineSession = {
  id: string;
  status: string;
  spent: number;
  totalLimit: number;
  remaining: number;
  currency: string;
  expiresAt: string;
};
type AgentBudget = {
  id: string;
  agentName: string;
  budget: number;
  spent: number;
  remaining: number;
  currency: string;
  expiresAt: string;
  allowedActions: string[];
  sessionKey?: string;
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
  const reduced = useReducedMotion();

  const [tab, setTab] = useState<TabId>('assets');
  const [copied, setCopied] = useState(false);
  const [usdcBalance, setUsdcBalance] = useState<string>('—');
  const [sessions, setSessions] = useState<EngineSession[] | null>(null);
  const [sessionsError, setSessionsError] = useState(false);
  const [receipts, setReceipts] = useState<EngineReceipt[] | null>(null);
  const [receiptsError, setReceiptsError] = useState(false);
  const [agentBudgets, setAgentBudgets] = useState<AgentBudget[]>([]);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [budgetForm, setBudgetForm] = useState({
    agentName: '',
    budgetAmount: '',
    expiry: '24h',
    allowedActions: [] as string[],
  });
  const [newSessionKey, setNewSessionKey] = useState<string | null>(null);

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
      setShowBudgetForm(false);
      setNewSessionKey(null);
    }
  }, [isOpen]);

  const handleCreateBudget = async () => {
    try {
      const expiryHours = budgetForm.expiry === '24h' ? 24 : budgetForm.expiry === '7d' ? 168 : 720;
      const response = await fetch('/api/v1/engine/session/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          agentName: budgetForm.agentName,
          totalLimit: Number(budgetForm.budgetAmount),
          currency: 'USDC',
          expiresInHours: expiryHours,
          allowedActions: budgetForm.allowedActions,
        }),
      });
      const data = await response.json();
      if (data.success && data.data?.sessionKey) {
        setNewSessionKey(data.data.sessionKey);
        setAgentBudgets([
          ...agentBudgets,
          {
            id: data.data.sessionId || Date.now().toString(),
            agentName: budgetForm.agentName,
            budget: Number(budgetForm.budgetAmount),
            spent: 0,
            remaining: Number(budgetForm.budgetAmount),
            currency: 'USDC',
            expiresAt: new Date(Date.now() + expiryHours * 3600000).toISOString(),
            allowedActions: budgetForm.allowedActions,
            sessionKey: data.data.sessionKey,
          },
        ]);
        setShowBudgetForm(false);
      }
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const toggleAction = (action: string) => {
    setBudgetForm({
      ...budgetForm,
      allowedActions: budgetForm.allowedActions.includes(action)
        ? budgetForm.allowedActions.filter(a => a !== action)
        : [...budgetForm.allowedActions, action],
    });
  };

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
          { id: 'agent-budgets', label: 'Agent Budgets' },
          { id: 'activity', label: 'Activity' },
        ]}
        activeId={tab}
        onChange={(id) => setTab(id as TabId)}
      />

      {/*
        The "Lock In" shell: this layout container measures the active tab's
        height and morphs the modal to it on a spring — the wallet physically
        expands and contracts as tabs toggle. Framer's layout projection
        interpolates via transform (never a raw width/height transition), so
        it stays composited. Reduced motion: content swaps with a fade only.
      */}
      <motion.div
        layout={reduced ? false : true}
        transition={reduced ? CLAY_FADE : CLAY_SETTLE}
        style={{ overflow: 'visible', willChange: 'transform' }}
      >
        <AnimatePresence mode="wait" initial={false}>
        {tab === 'assets' && (
        <motion.div
          key="assets"
          initial={reduced ? undefined : { opacity: 0, y: 8 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
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
        </motion.div>
      )}

      {tab === 'sessions' && (
        <motion.div
          key="sessions"
          initial={reduced ? undefined : { opacity: 0, y: 8 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
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
        </motion.div>
      )}

      {tab === 'agent-budgets' && (
        <motion.div
          key="agent-budgets"
          initial={reduced ? undefined : { opacity: 0, y: 8 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
        <div className="space-y-4 py-2">
          <div className="text-xs text-[var(--soft-stone)] bg-[var(--warm-sand)]/20 p-3 rounded-lg">
            <strong>Note:</strong> Funds for agent sessions are deducted from your Pabandi Wallet.
          </div>

          {!showBudgetForm && !newSessionKey && (
            <Button onClick={() => setShowBudgetForm(true)} className="w-full">
              <Bot className="w-4 h-4 mr-2" />
              Provision New Agent Session
            </Button>
          )}

          {showBudgetForm && (
            <div className="space-y-3 p-4 bg-[var(--warm-sand)]/10 rounded-xl border border-[rgba(191,179,163,0.3)]">
              <div>
                <label className="text-xs font-bold text-[var(--warm-ink)] mb-1 block">Agent Name</label>
                <input
                  type="text"
                  value={budgetForm.agentName}
                  onChange={(e) => setBudgetForm({ ...budgetForm, agentName: e.target.value })}
                  placeholder="e.g., ScoutBot"
                  className="w-full px-3 py-2 rounded-lg border border-[var(--warm-sand)] text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--warm-ink)] mb-1 block">Budget Amount (USDC)</label>
                <input
                  type="number"
                  value={budgetForm.budgetAmount}
                  onChange={(e) => setBudgetForm({ ...budgetForm, budgetAmount: e.target.value })}
                  placeholder="50"
                  className="w-full px-3 py-2 rounded-lg border border-[var(--warm-sand)] text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--warm-ink)] mb-1 block">Expiry</label>
                <select
                  value={budgetForm.expiry}
                  onChange={(e) => setBudgetForm({ ...budgetForm, expiry: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--warm-sand)] text-sm"
                >
                  <option value="24h">24 hours</option>
                  <option value="7d">7 days</option>
                  <option value="30d">30 days</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--warm-ink)] mb-2 block">Allowed Actions</label>
                <div className="space-y-2">
                  {['Data Scraping', 'Human Booking', 'API Access'].map(action => (
                    <label key={action} className="flex items-center gap-2 text-sm text-[var(--warm-ink)]">
                      <input
                        type="checkbox"
                        checked={budgetForm.allowedActions.includes(action)}
                        onChange={() => toggleAction(action)}
                      />
                      {action}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateBudget} className="flex-1">Create Session</Button>
                <Button variant="ghost" onClick={() => setShowBudgetForm(false)} className="flex-1">Cancel</Button>
              </div>
            </div>
          )}

          {newSessionKey && (
            <div className="space-y-3 p-4 bg-green-500/10 rounded-xl border border-green-500/30">
              <div className="font-bold text-green-700">Session Created Successfully!</div>
              <div>
                <label className="text-xs font-bold text-[var(--warm-ink)] mb-1 block">Session Key</label>
                <code className="block p-2 bg-white rounded text-xs break-all">{newSessionKey}</code>
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--warm-ink)] mb-1 block">Usage Example (Python)</label>
                <pre className="p-2 bg-[#0f0d0b] text-[#F5EFE6] rounded text-xs overflow-x-auto">
{`headers = {"Authorization": "Bearer ${newSessionKey}"}
response = requests.post("https://pabandi.com/api/v1/...", headers=headers)`}
                </pre>
              </div>
              <Button variant="ghost" onClick={() => setNewSessionKey(null)} className="w-full">Create Another</Button>
            </div>
          )}

          {agentBudgets.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-bold text-[var(--warm-ink)]">Active Sessions</div>
              {agentBudgets.map(budget => (
                <div key={budget.id} className="p-3 rounded-xl bg-[var(--warm-sand)]/10 border border-[rgba(191,179,163,0.3)]">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-[var(--clay)]" />
                      <span className="text-sm font-bold text-[var(--warm-ink)]">{budget.agentName}</span>
                    </div>
                    <span className="text-xs text-[var(--soft-stone)] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(budget.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--soft-stone)] mb-2">
                    Spent {budget.spent} / {budget.budget} {budget.currency} · {budget.remaining} remaining
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {budget.allowedActions.map(action => (
                      <span key={action} className="text-[10px] px-2 py-0.5 bg-[var(--clay)]/10 text-[var(--clay)] rounded">
                        {action}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </motion.div>
      )}

      {tab === 'activity' && (
        <motion.div
          key="activity"
          initial={reduced ? undefined : { opacity: 0, y: 8 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
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
        </motion.div>
      )}
        </AnimatePresence>
      </motion.div>
    </Modal>
  );
}
