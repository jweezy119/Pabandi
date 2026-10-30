import type { EscrowStatus as EscrowStatusKind } from './types';

interface EscrowStatusProps {
  status: EscrowStatusKind;
  /** Total locked in escrow, USD. Renders the amount when provided. */
  amount?: number;
}

/** Human label per AgentEscrow.status. `undefined` = still the FUNDED default. */
const LABELS: Record<string, string> = {
  FUNDED: 'Funds locked in escrow',
  RELEASED: 'Funds released',
  REFUNDED: 'Funds refunded',
  DISPUTED: 'In dispute',
};

/** Warm clay tones: ochre = locked (money is waiting), sage = released,
 * dusty rose = disputed, stone = refunded. */
const TONES: Record<string, string> = {
  FUNDED: 'bg-[rgba(217,168,84,0.25)] border-[rgba(191,143,64,0.4)]',
  RELEASED: 'bg-[rgba(138,154,123,0.25)] border-[rgba(122,138,109,0.4)]',
  REFUNDED: 'bg-[rgba(90,83,72,0.12)] border-[rgba(90,83,72,0.25)]',
  DISPUTED: 'bg-[rgba(212,165,165,0.3)] border-[rgba(197,132,132,0.4)]',
};

/**
 * Visual badge for whether funds are locked in escrow. Deliberately loud:
 * a poster scrolling the project list should be able to see at a glance
 * that money is sitting on the table for this project.
 */
export function EscrowStatus({ status, amount }: EscrowStatusProps) {
  const canonical = typeof status === 'string' ? status.toUpperCase() : '';
  const label = LABELS[canonical] ?? 'Funds in escrow';
  const tone = TONES[canonical] ?? TONES.FUNDED;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-[var(--radius-pill)] border px-3 py-1 text-sm font-label text-[var(--warm-ink)] ${tone}`}
    >
      <span
        aria-hidden="true"
        className="w-2 h-2 rounded-full bg-[var(--terracotta)] animate-pulse"
      />
      {label}
      {typeof amount === 'number' && (
        <strong className="font-headline">$ {amount.toFixed(2)}</strong>
      )}
    </span>
  );
}

export default EscrowStatus;
