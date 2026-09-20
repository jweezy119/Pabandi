import { useState, useEffect, useCallback } from 'react';

/**
 * Frictionless Payment Component
 * ================================
 * 
 * 1-click payments with optimistic UI.
 * User NEVER sees crypto — only USD.
 * Jev handles security, agent handles execution.
 */

interface FrictionlessPaymentProps {
  amount: number;
  description: string;
  recipientId?: string;
  onSuccess?: (result: PaymentResult) => void;
  onError?: (error: string) => void;
}

interface PaymentResult {
  success: boolean;
  txHash?: string;
  amountCharged: number;
  savings: number;
  method: 'usdc' | 'pab' | 'split';
}

export const FrictionlessPayment: React.FC<FrictionlessPaymentProps> = ({
  amount,
  description,
  recipientId,
  onSuccess,
  onError,
}) => {
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isJevChecking, setIsJevChecking] = useState(false);

  // 1-Click Pay — no wallet popup, no crypto jargon
  const handlePay = useCallback(async () => {
    if (status === 'processing') return;
    
    setStatus('processing');
    setError(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        // Guest checkout — create temporary account
        await guestPay();
        return;
      }

      // Step 1: Jev security check (invisible to user)
      setIsJevChecking(true);
      const securityRes = await fetch('/api/v1/security/check-transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount,
          token: 'USDC',
          recipient: recipientId,
        }),
      });
      const securityData = await securityRes.json();
      setIsJevChecking(false);

      if (!securityData.data?.approved) {
        // Jev flagged — but show friendly message, not crypto error
        setError('Unable to process payment. Please try again or contact support.');
        setStatus('error');
        return;
      }

      // Step 2: Get optimal payment route from Jev
      const routeRes = await fetch('/api/v1/jev/payment-route/me', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount }),
      });
      const routeData = await routeRes.json();

      // Step 3: Execute payment (agent handles all crypto)
      const payRes = await fetch('/api/v1/frictionless/pay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount,
          description,
          recipientId,
          route: routeData.data,
        }),
      });

      const payData = await payRes.json();

      if (payData.success) {
        setResult(payData.data);
        setStatus('success');
        onSuccess?.(payData.data);
      } else {
        // Auto-retry once on failure
        await autoRetryPayment(amount, description, recipientId, routeData.data);
      }
    } catch (err: any) {
      setError('Something went wrong. Please try again.');
      setStatus('error');
      onError?.(err.message);
    }
  }, [amount, description, recipientId, status]);

  // Guest checkout — pay without account
  const guestPay = async () => {
    try {
      const res = await fetch('/api/v1/frictionless/guest-pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, description }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.data);
        setStatus('success');
      } else {
        setError('Payment failed. Please create an account to continue.');
        setStatus('error');
      }
    } catch {
      setError('Payment failed. Please try again.');
      setStatus('error');
    }
  };

  // Auto-retry with higher gas
  const autoRetryPayment = async (
    amount: number,
    description: string,
    recipientId: string | undefined,
    route: any
  ) => {
    try {
      const token = localStorage.getItem('token');
      const retryRes = await fetch('/api/v1/frictionless/retry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount, description, recipientId, route }),
      });
      const retryData = await retryRes.json();
      if (retryData.success) {
        setResult(retryData.data);
        setStatus('success');
      } else {
        setError('Payment failed after retry. Please try again later.');
        setStatus('error');
      }
    } catch {
      setError('Payment failed after retry. Please try again later.');
      setStatus('error');
    }
  };

  // Reset after success
  useEffect(() => {
    if (status === 'success') {
      const timer = setTimeout(() => {
        setStatus('idle');
        setResult(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  // ── RENDER ────────────────────────────────────────────

  if (status === 'success' && result) {
    return (
      <div style={{
        padding: '20px',
        borderRadius: 12,
        background: 'linear-gradient(135deg, rgba(20,241,149,0.1), rgba(5,150,105,0.1))',
        border: '1px solid rgba(20,241,149,0.3)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
        <h3 style={{ color: '#14f195', margin: '0 0 4px' }}>Paid ${amount.toFixed(2)}</h3>
        {result.savings > 0 && (
          <p style={{ color: '#a78bfa', fontSize: 13, margin: '0 0 4px' }}>
            You saved ${result.savings.toFixed(2)} with PAB!
          </p>
        )}
        <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>{description}</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={{
        padding: '20px',
        borderRadius: 12,
        background: 'rgba(239,68,68,0.05)',
        border: '1px solid rgba(239,68,68,0.2)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>!</div>
        <h3 style={{ color: '#ef4444', margin: '0 0 8px' }}>{error}</h3>
        <button
          onClick={() => { setStatus('idle'); setError(null); }}
          style={{
            padding: '8px 20px',
            borderRadius: 8,
            border: '1px solid rgba(239,68,68,0.3)',
            background: 'transparent',
            color: '#ef4444',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div style={{
      padding: '20px',
      borderRadius: 12,
      background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.9))',
      border: '1px solid rgba(148,163,184,0.1)',
    }}>
      {/* Amount Display */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <p style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 4px' }}>{description}</p>
        <h2 style={{ color: '#fff', margin: 0, fontSize: 28, fontWeight: 700 }}>
          ${amount.toFixed(2)}
        </h2>
      </div>

      {/* 1-Click Pay Button */}
      <button
        onClick={handlePay}
        disabled={status === 'processing'}
        style={{
          width: '100%',
          padding: '14px 20px',
          borderRadius: 10,
          border: 'none',
          background: status === 'processing'
            ? 'rgba(148,163,184,0.2)'
            : 'linear-gradient(135deg, #14f195, #059669)',
          color: status === 'processing' ? '#94a3b8' : '#0f172a',
          fontSize: 15,
          fontWeight: 600,
          cursor: status === 'processing' ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        {status === 'processing' ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{
              width: 16,
              height: 16,
              border: '2px solid #94a3b8',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            {isJevChecking ? 'Securing...' : 'Processing...'}
          </span>
        ) : (
          `Pay $${amount.toFixed(2)}`
        )}
      </button>

      {/* Security Badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 12,
      }}>
        <div style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: '#14f195',
          boxShadow: '0 0 8px #14f195',
        }} />
        <span style={{ color: '#64748b', fontSize: 11 }}>
          Secured by Jev • No wallet needed
        </span>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default FrictionlessPayment;
