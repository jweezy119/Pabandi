import { useEffect, useState } from 'react';

/**
 * Guarantee visuals — the "money moving" half of the guarantee story.
 *
 * ─── WHY THESE ARE CSS, NOT FRAMER-MOTION/PARTICLES ─────────────────────────
 * Every one of these runs on the transform/opacity/colour properties only, so
 * they animate on the compositor: the landing page keeps its 60fps scroll even
 * with three of them on screen. They are also pure presentation — they make no
 * requests, read no props of substance, and degrade to their final states under
 * `prefers-reduced-motion`, where the animation loop is skipped entirely and
 * the resting state is shown immediately.
 */

/**
 * The hero's split-screen: a booking turning into secured money.
 *
 * Left: a client taps Book, a deposit lock swells into place.
 * Right: the corresponding calendar slot reads "Revenue Secured".
 * One shared tick drives both sides so the story reads in sequence:
 * book → lock → slot flips green.
 */
export function GuaranteeSplitVisual() {
  const [phase, setPhase] = useState(0); // 0 idle, 1 locking, 2 secured

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setPhase(2);
      return;
    }
    // Loop the story so it explains itself to someone who looks up mid-cycle.
    const t = setInterval(() => setPhase((p) => (p + 1) % 3), 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="guarantee-split" aria-label="A client books; the deposit is locked and the revenue is secured" role="img">
      {/* ── Left: the client side ─────────────────────────────────── */}
      <div className="guarantee-half guarantee-half--client">
        <p className="guarantee-half-label">Client</p>
        <div className="guarantee-tile">
          <p className="guarantee-tile-title">Roof Inspection</p>
          <p className="guarantee-tile-meta">Booked for tomorrow · 10:00 AM</p>
          <button className="guarantee-book-btn" type="button" onClick={() => setPhase(1)}>
            {phase === 0 ? 'Book' : 'Booked ✓'}
          </button>
        </div>
        <div className={`guarantee-lock ${phase >= 1 ? 'guarantee-lock--on' : ''}`}>
          <span className="material-symbols-outlined">lock</span>
          <span className="guarantee-lock-amount">$500</span>
        </div>
      </div>

      {/* ── Right: the money side ─────────────────────────────────── */}
      <div className="guarantee-half guarantee-half--calendar">
        <p className="guarantee-half-label">Your calendar</p>
        <div className="guarantee-slot">
          <span className="guarantee-slot-time">10:00</span>
          <span className="guarantee-slot-line" />
        </div>
        <div className="guarantee-slot guarantee-slot--booked">
          <span className="guarantee-slot-time">11:00</span>
          <span className="guarantee-slot-line" />
        </div>
        <div className={`guarantee-secured ${phase >= 2 ? 'guarantee-secured--on' : ''}`}>
          <span className="material-symbols-outlined">verified</span>
          Revenue Secured
        </div>
      </div>
    </div>
  );
}

/**
 * The four steps the escrow moves through. Used on /guarantee (rows) and as a
 * compact teaser on the landing page.
 */
export const GUARANTEE_STEPS = [
  {
    n: '1',
    title: 'The client books.',
    body: 'They commit to the slot and you hold the date.',
    icon: 'event_available',
  },
  {
    n: '2',
    title: 'Deposit locked in Solana escrow.',
    body: 'Not in your bank account. Not in theirs. In escrow, where neither of you can touch it.',
    icon: 'lock',
  },
  {
    n: '3',
    title: 'They show up.',
    body: 'The money returns to them toward the bill. You get paid for the work.',
    icon: 'check_circle',
  },
  {
    n: '4',
    title: "They don't show up.",
    body: 'The deposit is forfeited to you. Your time was never free.',
    icon: 'payments',
  },
  {
    n: '5',
    title: 'The default is paid.',
    body: 'After the appointment, a 48-hour settlement window closes. If no check-in and no dispute arrive inside it, the deposit settles to you automatically. On a card network the default favors the client and you fight the chargeback. Here the default favors you — because both sides agreed to the deposit up front.',
    icon: 'hourglass_bottom',
  },
];

/**
 * VaultLocked — the confirmation animation a client sees after their deposit
 * goes into escrow. Also used if you squint as the campaign's soul.
 */
export function VaultLocked({ amount }: { amount?: string | number | null }) {
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setAdded(true);
      return;
    }
    const t = setTimeout(() => setAdded(true), 650);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="vault-locked" role="status" aria-label="Deposit secured in escrow">
      <div className="vault-locked-arc">
        <span className="material-symbols-outlined vault-locked-lock">lock</span>
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle className="vault-ring vault-ring--track" cx="60" cy="60" r="52" />
          <circle
            className="vault-ring vault-ring--sweep"
            cx="60"
            cy="60"
            r="52"
            style={{ animationPlayState: added ? 'paused' : 'running' }}
          />
        </svg>
        <span className={`vault-locked-check ${added ? 'vault-locked-check--on' : ''}`}>
          <span className="material-symbols-outlined">check</span>
        </span>
      </div>
      {amount != null && (
        <p className="vault-locked-amount">
          <span className="vault-locked-fig">${amount}</span>
          <span className="vault-locked-into">secured in escrow</span>
        </p>
      )}
    </div>
  );
}
