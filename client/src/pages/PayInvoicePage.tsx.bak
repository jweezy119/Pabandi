import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePrivy } from '@privy-io/react-auth';
import { Badge, Button, tokens } from '../design-system';
import { payInvoice, InvoiceData } from '../lib/payInvoice';

const WARM_CLAY = {
  clay: '#C97B5A',
  cream: '#F5EFE6',
  warmInk: '#2A2520',
  softStone: '#BFB3A3',
  sage: '#8A9A7B',
  dustyRose: '#D4A5A5',
  mutedOchre: '#D9A854',
  skyWash: '#B8C9D4',
  terracotta: '#A85A3C',
  warmSand: '#E8D9C5',
};

export const PayInvoicePage: React.FC = () => {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();
  const { authenticated } = usePrivy();

  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [result, setResult] = useState<{ success: boolean; txHash?: string; error?: string } | null>(null);

  // Fetch invoice details
  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const response = await fetch(`/api/v1/public/invoices/${invoiceId}`);
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

  const handlePay = async () => {
    if (!invoiceId) return;
    setPaying(true);
    setResult(null);
    try {
      const paymentResult = await payInvoice(invoiceId);
      setResult(paymentResult);
      if (paymentResult.success && paymentResult.transactionHash) {
        setTimeout(() => navigate(`/payment/success?tx=${paymentResult.transactionHash}`), 2000);
      }
    } catch {
      setResult({ success: false, error: 'Payment failed.' });
    } finally {
      setPaying(false);
    }
  };

  const styles: Record<string, React.CSSProperties> = {
    page: {
      minHeight: '100vh',
      background: `linear-gradient(135deg, ${WARM_CLAY.cream} 0%, ${WARM_CLAY.warmSand} 50%, ${WARM_CLAY.skyWash} 100%)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: tokens.space.lg,
      fontFamily: "'Georgia', 'Times New Roman', serif",
    },
    card: {
      background: WARM_CLAY.cream,
      borderRadius: tokens.radius.xl,
      padding: tokens.space.xl,
      maxWidth: '520px',
      width: '100%',
      boxShadow: `0 8px 32px rgba(201, 123, 90, 0.15)`,
      border: `1px solid ${WARM_CLAY.softStone}`,
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
    subtitle: {
      color: WARM_CLAY.clay,
      fontSize: '0.95rem',
      marginTop: tokens.space.sm,
    },
    invoiceInfo: {
      background: WARM_CLAY.warmSand,
      borderRadius: tokens.radius.lg,
      padding: tokens.space.lg,
      marginBottom: tokens.space.lg,
    },
    invoiceRow: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: `${tokens.space.sm} 0`,
      borderBottom: `1px solid ${WARM_CLAY.softStone}`,
    },
    label: {
      color: WARM_CLAY.warmInk,
      fontWeight: 500,
    },
    value: {
      color: WARM_CLAY.warmInk,
      fontWeight: 600,
    },
    button: {
      width: '100%',
      background: `linear-gradient(135deg, ${WARM_CLAY.clay} 0%, ${WARM_CLAY.terracotta} 100%)`,
      color: '#fff',
      border: 'none',
      borderRadius: tokens.radius.lg,
      padding: tokens.space.md,
      fontSize: '1.1rem',
      fontWeight: 600,
      cursor: paying ? 'not-allowed' : 'pointer',
      opacity: paying ? 0.7 : 1,
      transition: 'all 0.3s ease',
      fontFamily: "'Georgia', serif",
      marginTop: tokens.space.sm,
    },
    statusBox: {
      background: result?.success ? WARM_CLAY.sage : WARM_CLAY.dustyRose,
      color: '#fff',
      borderRadius: tokens.radius.md,
      padding: tokens.space.md,
      marginTop: tokens.space.md,
      textAlign: 'center' as const,
    },
    statusText: {
      fontSize: '0.9rem',
    },
    walletBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: tokens.space.sm,
      background: WARM_CLAY.skyWash,
      color: WARM_CLAY.warmInk,
      borderRadius: tokens.radius.md,
      padding: `${tokens.space.sm} ${tokens.space.md}`,
      fontSize: '0.85rem',
      marginBottom: tokens.space.md,
    },
    loading: {
      textAlign: 'center' as const,
      padding: tokens.space.xl,
      color: WARM_CLAY.warmInk,
    },
  };

  if (loading) {
    return <div style={styles.loading}>Loading invoice...</div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Pay Invoice</h1>
          <p style={styles.subtitle}>Secure USDC payment on Solana</p>
        </div>

        {!authenticated && (
          <div style={styles.walletBadge}>
            🔒 Please connect your wallet to pay
          </div>
        )}

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
            <div style={styles.invoiceRow}>
              <span style={styles.label}>Amount</span>
              <span style={{ ...styles.value, color: WARM_CLAY.clay, fontSize: '1.3rem', fontWeight: 700 }}>
                {invoice.subtotal} {invoice.currency}
              </span>
            </div>
          </div>
        )}

        <Button
          variant="primary"
          onClick={handlePay}
          disabled={!authenticated || paying || !invoice || invoice.status !== 'pending'}
          style={styles.button}
        >
          {paying ? (
            <span>⏳ Processing...</span>
          ) : !authenticated ? (
            <span>🔗 Connect Wallet to Pay</span>
          ) : (
            <span>💎 Pay {invoice?.subtotal} {invoice?.currency}</span>
          )}
        </Button>

        {result && (
          <div style={styles.statusBox}>
            <div style={styles.statusText}>
              {result.success ? (
                <>✅ Payment successful! TX: {result.txHash?.slice(0, 16)}...</>
              ) : (
                <>❌ {result.error}</>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
