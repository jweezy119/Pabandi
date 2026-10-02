import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Badge, Button, tokens } from '../design-system';
import { API_HOST } from '../utils/apiHost';

const WARM_CLAY = {
  clay: '#C97B5A',
  cream: '#F5EFE6',
  warmInk: '#2A2520',
  softStone: '#BFB3A3',
  sage: '#8A9A7B',
  dustyRose: '#D4A5A5',
  warmSand: '#E8D9C5',
};

export default function PayInvoicePage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const [invoice, setInvoice] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [result, setResult] = useState<{ success: boolean; error?: string } | null>(null);

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const response = await fetch(`${API_HOST}/api/v1/public/invoices/${invoiceId}`);
        if (response.ok) {
          const data = await response.json();
          setInvoice(data);
        } else {
          setResult({ success: false, error: 'Invoice not found.' });
        }
      } catch {
        setResult({ success: false, error: 'Failed to load invoice.' });
      } finally {
        setLoading(false);
      }
    };
    fetchInvoice();
  }, [invoiceId]);

  const handlePayClick = () => {
    if (invoice?.paymentLink) {
      window.open(invoice.paymentLink, '_blank');
    } else {
      alert("No payment method configured for this business.");
    }
  };

  const handleClaimPaid = async () => {
    if (!invoiceId) return;
    setClaiming(true);
    setResult(null);
    try {
      const response = await fetch(`${API_HOST}/api/v1/public/invoices/${invoiceId}/claim-paid`, {
        method: 'POST'
      });
      if (response.ok) {
        setInvoice({ ...invoice, status: 'payment_claimed' });
        setResult({ success: true });
      } else {
        const err = await response.json();
        setResult({ success: false, error: err.error || 'Failed to claim payment.' });
      }
    } catch {
      setResult({ success: false, error: 'Network error.' });
    } finally {
      setClaiming(false);
    }
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
      maxWidth: '520px',
      width: '100%',
      boxShadow: `0 8px 32px rgba(42, 37, 32, 0.05)`,
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
      background: WARM_CLAY.cream,
      borderRadius: tokens.radius.lg,
      padding: tokens.space.lg,
      marginBottom: tokens.space.lg,
    },
    invoiceRow: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: `${tokens.space.sm} 0`,
      borderBottom: `1px solid ${WARM_CLAY.warmSand}`,
    },
    label: {
      color: WARM_CLAY.softStone,
      fontWeight: 500,
    },
    value: {
      color: WARM_CLAY.warmInk,
      fontWeight: 600,
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
    },
  };

  if (loading) {
    return <div style={{ ...styles.page, justifyContent: 'center' }}>Loading invoice...</div>;
  }

  const isPaid = invoice?.status === 'paid';
  const isClaimed = invoice?.status === 'payment_claimed';

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Invoice</h1>
        </div>

        {invoice && (
          <div style={styles.invoiceInfo}>
            <div style={styles.invoiceRow}>
              <span style={styles.label}>Invoice #{invoice.number}</span>
              <Badge>{invoice.status}</Badge>
            </div>
            <div style={styles.invoiceRow}>
              <span style={styles.label}>Business</span>
              <span style={styles.value}>{invoice.business.name}</span>
            </div>
            <div style={{ ...styles.invoiceRow, borderBottom: 'none', paddingTop: tokens.space.md }}>
              <span style={styles.label}>Amount Due</span>
              <span style={{ color: WARM_CLAY.clay, fontSize: '1.5rem', fontWeight: 700 }}>
                {invoice.subtotal} {invoice.currency}
              </span>
            </div>
          </div>
        )}

        <div style={styles.actions}>
          {isPaid ? (
            <div style={{ textAlign: 'center', padding: '1rem', background: WARM_CLAY.sage, color: 'white', borderRadius: '8px' }}>
              ✅ This invoice has been paid
            </div>
          ) : isClaimed ? (
            <div style={{ textAlign: 'center', padding: '1rem', background: WARM_CLAY.warmSand, color: WARM_CLAY.warmInk, borderRadius: '8px' }}>
              ⏳ Payment claimed. Awaiting verification from business.
            </div>
          ) : (
            <>
              {invoice?.paymentLink ? (
                <Button variant="primary" onClick={handlePayClick} style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}>
                  Pay {invoice.subtotal} {invoice.currency}
                </Button>
              ) : (
                <div style={{ textAlign: 'center', padding: '1rem', background: WARM_CLAY.warmSand, color: WARM_CLAY.warmInk, borderRadius: '8px' }}>
                  Contact the business for payment instructions.
                </div>
              )}
              
              <Button variant="outline" onClick={handleClaimPaid} disabled={claiming} style={{ width: '100%', padding: '1rem' }}>
                {claiming ? '⏳ Updating...' : "I've Paid"}
              </Button>
            </>
          )}
        </div>

        {result && !result.success && (
          <div style={styles.statusBox}>
            ❌ {result.error}
          </div>
        )}
      </div>
    </div>
  );
};
