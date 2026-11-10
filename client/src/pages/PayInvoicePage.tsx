import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Clock, ShieldCheck, Printer, ArrowRight, CreditCard } from 'lucide-react';
import { Badge, Button, tokens } from '../design-system';
import { API_HOST } from '../utils/apiHost';
import { PabandiCheckoutModal } from '../components/PabandiCheckoutModal';

const WARM_CLAY = {
  clay: '#C97B5A',
  cream: '#F5EFE6',
  warmInk: '#2A2520',
  softStone: '#5C5248',
  sage: '#5F6F52',
  dustyRose: '#991B1B',
  warmSand: '#E8D9C5',
};

// Generates a standard RFC 4122 v4 UUID for request idempotency
function generateUuidV4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function PayInvoicePage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const [invoice, setInvoice] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [result, setResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [srAnnouncement, setSrAnnouncement] = useState<string>('');

  const claimIdempotencyKeyRef = useRef<string>(generateUuidV4());

  const fetchInvoice = useCallback(async (silent = false) => {
    if (!invoiceId) return;
    try {
      const response = await fetch(`${API_HOST}/api/v1/public/invoices/${invoiceId}`);
      if (response.ok) {
        const data = await response.json();
        setInvoice(data);
      } else if (!silent) {
        setResult({ success: false, error: 'Invoice not found or expired.' });
      }
    } catch {
      if (!silent) {
        setResult({ success: false, error: 'Failed to connect to Pabandi payment network.' });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [invoiceId]);

  // Initial load
  useEffect(() => {
    fetchInvoice(false);
  }, [fetchInvoice]);

  // Real-time status polling every 5s while invoice is active or claimed
  useEffect(() => {
    if (!invoice || invoice.status === 'paid') return;

    const interval = setInterval(() => {
      fetchInvoice(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [invoice, fetchInvoice]);

  const handlePayClick = () => {
    setCheckoutOpen(true);
  };

  const handleClaimPaid = async () => {
    if (!invoiceId || claiming) return;
    setClaiming(true);
    setResult(null);
    setSrAnnouncement('Submitting payment claim with idempotency guard...');

    try {
      const response = await fetch(`${API_HOST}/api/v1/public/invoices/${invoiceId}/claim-paid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': claimIdempotencyKeyRef.current,
        },
      });

      if (response.ok) {
        setInvoice((prev: any) => ({ ...prev, status: 'payment_claimed' }));
        setResult({ success: true });
        setSrAnnouncement('Payment claim submitted successfully. Awaiting merchant confirmation.');
        // Rotate key for any future claim operations
        claimIdempotencyKeyRef.current = generateUuidV4();
      } else {
        const err = await response.json();
        const errorMsg = err.error || 'Failed to submit payment claim.';
        setResult({ success: false, error: errorMsg });
        setSrAnnouncement(`Claim failed: ${errorMsg}`);
      }
    } catch {
      const errorMsg = 'Network connectivity issue. Please retry.';
      setResult({ success: false, error: errorMsg });
      setSrAnnouncement(errorMsg);
    } finally {
      setClaiming(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const styles: Record<string, React.CSSProperties> = {
    page: {
      minHeight: '100vh',
      background: WARM_CLAY.cream,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: tokens.space.lg,
      fontFamily: "'Inter', sans-serif",
    },
    card: {
      background: '#fff',
      borderRadius: tokens.radius.xl,
      padding: tokens.space.xl,
      maxWidth: '540px',
      width: '100%',
      boxShadow: `0 12px 40px rgba(42, 37, 32, 0.08)`,
      border: `1px solid ${WARM_CLAY.warmSand}`,
    },
    header: {
      textAlign: 'center' as const,
      marginBottom: tokens.space.xl,
    },
    title: {
      fontSize: '1.75rem',
      fontWeight: 700,
      color: WARM_CLAY.warmInk,
      margin: 0,
    },
    invoiceInfo: {
      background: '#FAF6F0',
      borderRadius: tokens.radius.lg,
      padding: tokens.space.lg,
      marginBottom: tokens.space.lg,
      border: `1px solid ${WARM_CLAY.warmSand}`,
    },
    invoiceRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: `${tokens.space.sm} 0`,
      borderBottom: `1px solid rgba(191,179,163,0.3)`,
    },
    label: {
      color: WARM_CLAY.softStone,
      fontWeight: 600,
      fontSize: '0.875rem',
    },
    value: {
      color: WARM_CLAY.warmInk,
      fontWeight: 700,
      fontSize: '0.95rem',
    },
    actions: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: tokens.space.md,
      marginTop: tokens.space.xl,
    },
    statusBox: {
      background: result?.success ? WARM_CLAY.sage : WARM_CLAY.dustyRose,
      color: '#fff',
      borderRadius: tokens.radius.md,
      padding: tokens.space.md,
      marginTop: tokens.space.md,
      textAlign: 'center' as const,
      fontWeight: 600,
    },
  };

  if (loading) {
    return (
      <div style={{ ...styles.page, justifyContent: 'center' }} role="status">
        <span className="font-semibold text-[#2A2520]">Loading secure invoice details...</span>
      </div>
    );
  }

  const isPaid = invoice?.status?.toLowerCase() === 'paid';
  const isClaimed = invoice?.status?.toLowerCase() === 'payment_claimed';

  return (
    <main style={styles.page} role="main" aria-label="Invoice Settlement Portal">
      {/* Screen reader live updates */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {srAnnouncement}
      </div>

      <div style={styles.card}>
        <div style={styles.header}>
          <div className="flex items-center justify-center gap-2 mb-2">
            <ShieldCheck size={24} className="text-[#5F6F52]" aria-hidden="true" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#5C5248]">
              Pabandi Trust & Settlement
            </span>
          </div>
          <h1 style={styles.title}>Invoice #{invoice?.number || invoice?.id || 'Payment'}</h1>
        </div>

        {invoice && (
          <div style={styles.invoiceInfo}>
            <div style={styles.invoiceRow}>
              <span style={styles.label}>Settlement Status</span>
              <Badge>{isPaid ? 'PAID & SETTLED' : isClaimed ? 'PAYMENT CLAIMED' : invoice.status}</Badge>
            </div>
            <div style={styles.invoiceRow}>
              <span style={styles.label}>Merchant / Business</span>
              <span style={styles.value}>{invoice.business?.name || 'Verified Merchant'}</span>
            </div>
            <div style={{ ...styles.invoiceRow, borderBottom: 'none', paddingTop: tokens.space.md }}>
              <span style={styles.label}>Total Amount Due</span>
              <span style={{ color: WARM_CLAY.clay, fontSize: '1.65rem', fontWeight: 800 }}>
                ${Number(invoice.subtotal || invoice.amount || 0).toFixed(2)}{' '}
                <span className="text-sm font-semibold text-[#5C5248]">
                  {invoice.currency || 'USD'}
                </span>
              </span>
            </div>
          </div>
        )}

        {/* ── Status Banners & Actions ── */}
        <div style={styles.actions}>
          {isPaid ? (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-center space-y-3">
              <div className="flex items-center justify-center gap-2 text-emerald-800 font-bold text-base">
                <CheckCircle2 size={20} className="text-emerald-600" />
                <span>Invoice Fully Paid & Settled</span>
              </div>
              <p className="text-xs text-[#5C5248] leading-relaxed">
                Payment verified on-chain / via payment rail. Your escrow release receipt is
                cryptographically sealed.
              </p>
              <button
                type="button"
                onClick={handlePrintReceipt}
                className="w-full min-h-[48px] py-2.5 px-4 rounded-xl border border-emerald-600 text-emerald-800 hover:bg-emerald-100 font-semibold text-xs flex items-center justify-center gap-2 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:outline-none"
              >
                <Printer size={15} />
                <span>Print or Save Verified Receipt</span>
              </button>
            </div>
          ) : isClaimed ? (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-center space-y-2">
              <div className="flex items-center justify-center gap-2 text-amber-900 font-bold text-sm">
                <Clock size={18} className="text-amber-600" />
                <span>Payment Claim Submitted</span>
              </div>
              <p className="text-xs text-[#5C5248] leading-relaxed">
                Your direct payment assertion has been recorded under reference{' '}
                <code className="font-mono font-bold text-[#2A2520]">inv-{invoice?.id}</code>. Live
                sync is monitoring for confirmation.
              </p>
            </div>
          ) : (
            <>
              <Button
                variant="primary"
                onClick={handlePayClick}
                style={{
                  width: '100%',
                  padding: '1rem',
                  fontSize: '1.05rem',
                  minHeight: '48px',
                  fontWeight: 700,
                }}
              >
                💳 Pay Now (Card, Solana USDC, or Raast)
              </Button>

              <Button
                variant="outline"
                onClick={handleClaimPaid}
                disabled={claiming}
                style={{ width: '100%', padding: '0.85rem', minHeight: '48px' }}
              >
                {claiming ? '⏳ Verifying...' : "I've Sent Payment Directly (Raast / Wire)"}
              </Button>
            </>
          )}
        </div>

        {/* ── Universal Multi-Rail Checkout Modal ── */}
        {invoice && (
          <PabandiCheckoutModal
            open={checkoutOpen}
            onClose={() => setCheckoutOpen(false)}
            title={`Invoice #${invoice.number || invoice.id}`}
            subtitle={
              invoice.business?.name ? `Pay ${invoice.business.name}` : 'Pabandi Invoice Settlement'
            }
            amount={Number(invoice.subtotal || invoice.amount || 0)}
            currency={invoice.currency || 'USD'}
            referenceId={`inv-${invoice.id}`}
            squareNote={`pabandi:invoice:${invoice.id}:${invoice.number || invoice.id}`}
            existingPaymentLink={invoice.paymentLink}
            recipientWallet={invoice.business?.solanaWallet || invoice.business?.walletAddress}
            merchantRaastId={invoice.business?.raastId || invoice.business?.phone}
            merchantJazzCash={invoice.business?.phone}
            merchantEasyPaisa={invoice.business?.phone}
            onSuccess={(rail) => {
              if (rail === 'raast' || rail === 'wallets') {
                setInvoice((prev: any) => ({ ...prev, status: 'payment_claimed' }));
              } else if (rail === 'solana') {
                setInvoice((prev: any) => ({ ...prev, status: 'paid' }));
              }
            }}
          />
        )}

        {/* ── Error / Notice Box ── */}
        {result && !result.success && (
          <div style={styles.statusBox} role="alert">
            ❌ {result.error}
          </div>
        )}

        {/* ── Sulha Trust Footer ── */}
        <div className="mt-6 pt-4 border-t border-[rgba(191,179,163,0.3)] flex items-center justify-between text-[11px] text-[#5C5248]">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-[#5F6F52]" />
            <span>Protected by Sulha Non-Custodial Escrow</span>
          </div>
          <span className="font-mono text-[10px]">WCAG 2.1 AA</span>
        </div>
      </div>
    </main>
  );
}
