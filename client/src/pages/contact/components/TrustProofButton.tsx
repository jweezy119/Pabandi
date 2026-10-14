import { useState } from 'react';
import { getAuthToken } from '../../../utils/authToken';
import { withBusinessId } from '../../../utils/businessContext';

/**
 * Show a client they can prove their standing without revealing their record.
 *
 * The copy is the product. A client reading this must not encounter a wallet, a
 * signature, a credential or the word blockchain — they are being offered something
 * simple and genuinely valuable: *prove you're reliable without handing over your
 * history*.
 *
 * What is deliberately absent, in order of how much it would scare someone:
 *
 *   - no score. Not "your score is 84" — a number invites "so what does 84 mean" and
 *     then an argument about the scale. A band is a promise, not a metric.
 *   - no "verification", "attestation", "VC" or "JWT". The UI never names the format.
 *   - no explanation of ES256, signing keys or the issuer. Nobody needs it to decide,
 *     and it is the single fastest way to lose someone who came here to run a salon.
 *   - nothing that asks the client to do anything. They receive a short code or link
 *     and give it to a business. That is the entire interaction.
 *
 * The one thing it must be honest about is what the receiving business learns: the
 * band and nothing else. A privacy feature that oversells is worse than none.
 */

const BAND_COPY: Record<string, string> = {
  TOP: 'Established',
  ESTABLISHED: 'Established',
  STEADY: 'Steady',
  DEVELOPING: 'Building',
  EARLY: 'Building',
};

export function TrustProofButton({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [proof, setProof] = useState<{ band: string; credential: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  /** The raw code is hidden unless it could not be copied, or is asked for. */
  const [showCode, setShowCode] = useState(false);

  const base = `${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm`;

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${base}/clients/${clientId}/trust-disclosure?${withBusinessId().replace(/^\?/, '')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken() || ''}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Could not create the proof');
      setProof(body.data);

      // Copied for them, immediately.
      //
      // What gets pasted is a long opaque string beginning `eyJ`. Handing that to
      // someone to read, select and copy is exactly the moment this feature loses a
      // customer — it looks like the blockchain barrier we set out to remove, and the
      // person did not come here to read base64.
      //
      // They paste, we read. So we do the copy.
      try {
        await navigator.clipboard.writeText(body.data.credential);
        setCopied(true);
        setTimeout(() => setCopied(false), 4000);
      } catch {
        setShowCode(true);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!proof) return;
    try {
      await navigator.clipboard.writeText(proof.credential);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard is genuinely unavailable in some contexts. Say so rather than
      // reporting success — the same bug the trust-profile share button had.
      setError('Could not copy automatically. Select the code and copy it manually.');
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-2 rounded-full text-sm border border-[var(--soft-stone)]/40 text-[var(--warm-ink)] hover:bg-[var(--warm-sand)]/20 transition-colors"
      >
        Share a proof of trust
      </button>
    );
  }

  return (
    <div className="mt-3 p-5 rounded-2xl bg-[var(--warm-sand)]/15 border border-[rgba(191,179,163,0.4)]">
      <div className="flex items-start justify-between gap-4">
        <h4 className="font-bold text-[var(--warm-ink)]">Proof of trust</h4>
        <button
          onClick={() => { setOpen(false); setProof(null); setError(null); }}
          aria-label="Close"
          className="text-[var(--soft-stone)] hover:text-[var(--warm-ink)]"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      {!proof ? (
        <>
          <p className="text-sm text-[var(--warm-ink)] mt-2">
            This client can show a business that they are worth working with, without
            sharing their payment history, their contact details, or anything about
            anyone else they have worked with.
          </p>
          <p className="text-xs text-[var(--soft-stone)] mt-2">
            They get a short code. A business checks it and sees one thing: that they
            meet your bar. Nothing about them is revealed beyond that.
          </p>
          {error && <p role="alert" className="text-xs mt-2" style={{ color: 'var(--dusty-rose)' }}>{error}</p>}
          <button
            onClick={create}
            disabled={busy}
            className="mt-4 px-4 py-2 rounded-full text-sm font-medium text-white disabled:opacity-40"
            style={{ background: 'var(--clay)' }}
          >
            {busy ? 'Creating…' : 'Create a proof'}
          </button>
        </>
      ) : (
        <>
          <div className="mt-3 p-3 rounded-xl bg-white">
            <p className="text-xs text-[var(--soft-stone)]">Their standing</p>
            <p className="font-bold text-[var(--warm-ink)]">{BAND_COPY[proof.band] ?? 'Established'}</p>
          </div>

          <p className="text-sm text-[var(--warm-ink)] mt-3">
            {copied
              ? 'Copied. Send it to the business — they can paste it straight into a message.'
              : 'Copy the code below and send it to the business.'}
          </p>

          <p className="text-xs text-[var(--soft-stone)] mt-1">
            They do not need to read it, and it is safe to send like any other message.
            Valid until {new Date(proof.expiresAt).toLocaleString()}.
          </p>

          <button
            onClick={copy}
            className="mt-3 px-4 py-2 rounded-full text-sm font-medium text-white"
            style={{ background: 'var(--clay)' }}
          >
            {copied ? 'Copy again' : 'Copy the code'}
          </button>

          {/* Hidden by default. It has to be copyable and it has to be pasteable, but
              showing it unprompted puts a wall of base64 in front of someone who came
              here to run a salon. */}
          <button
            onClick={() => setShowCode((v) => !v)}
            className="ml-2 mt-3 px-4 py-2 rounded-full text-sm border border-[var(--soft-stone)]/40"
          >
            {showCode ? 'Hide the code' : 'Show the code'}
          </button>

          {showCode && (
            <textarea
              aria-label="Proof code"
              readOnly
              value={proof.credential}
              rows={3}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full mt-2 px-3 py-2 rounded-xl border border-[var(--soft-stone)]/40 text-[10px] font-mono break-all"
            />
          )}

          {copied && <p role="status" className="text-xs mt-2" style={{ color: 'var(--sage)' }}>Copied to your clipboard.</p>}
          {error && <p role="alert" className="text-xs mt-2" style={{ color: 'var(--dusty-rose)' }}>{error}</p>}
        </>
      )}
    </div>
  );
}

export default TrustProofButton;
