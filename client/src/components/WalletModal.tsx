import { useAuthStore } from '../store/authStore';
import { useWalletModal } from '../hooks/useWalletModal';
import { Modal } from './primitives/Modal';
import { Button } from './primitives';

export function WalletModal() {
  const { wallet } = useAuthStore();
  const { isOpen, closeModal } = useWalletModal();

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={closeModal} title="Universal Wallet">
      <div className="space-y-6 py-2">
        {/* Balances */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-[var(--warm-sand)]/20 border border-[rgba(191,179,163,0.3)]">
            <div className="text-xs uppercase font-bold text-[var(--soft-stone)] mb-1">PAB Balance</div>
            <div className="text-2xl font-bold text-[var(--clay)]">{wallet.pabBalance} PAB</div>
          </div>
          <div className="p-4 rounded-xl bg-[var(--warm-sand)]/20 border border-[rgba(191,179,163,0.3)]">
            <div className="text-xs uppercase font-bold text-[var(--soft-stone)] mb-1">USDC Balance</div>
            <div className="text-2xl font-bold text-[var(--sage)]">0.00 USDC</div>
          </div>
        </div>

        {/* Deposit Address */}
        <div className="space-y-2">
          <div className="text-sm font-bold text-[var(--warm-ink)]">Deposit Address</div>
          <div className="flex items-center gap-2 p-3 bg-white rounded-lg border border-[var(--warm-sand)]">
            <code className="text-xs text-[var(--soft-stone)] truncate flex-1">
              0x1234...5678 (Coming soon)
            </code>
            <Button variant="ghost" onClick={() => alert('Address copied!')}>Copy</Button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-[rgba(191,179,163,0.3)]">
          <Button variant="primary" className="flex-1" onClick={() => alert('Withdraw flow coming soon')}>
            Withdraw
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => alert('Deposit flow coming soon')}>
            Deposit
          </Button>
        </div>

        {/* Transaction History */}
        <div className="space-y-3 pt-4">
          <h3 className="text-sm font-bold text-[var(--warm-ink)]">Recent Transactions</h3>
          <div className="text-sm text-[var(--soft-stone)] text-center py-4 bg-[var(--warm-sand)]/10 rounded-xl">
            No recent transactions
          </div>
        </div>
      </div>
    </Modal>
  );
}
