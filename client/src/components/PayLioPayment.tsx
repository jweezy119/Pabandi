import React, { useState } from 'react';
import { Button } from '../design-system';

interface PayLioPaymentProps {
  amount: number;
  reference: string;
  customerEmail?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export const PayLioPayment: React.FC<PayLioPaymentProps> = ({
  amount,
  reference,
  customerEmail,
  onSuccess,
  onError,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePay = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/payments/paylio/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          reference,
          customerEmail,
        }),
      });
      const data = await res.json();
      if (data.success && data.data.url) {
        window.location.href = data.data.url;
      } else {
        setError(data.error || 'Failed to create payment');
        onError?.(data.error || 'Failed to create payment');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
      onError?.(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {error && (
        <div className="mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-200">
          {error}
        </div>
      )}
      <Button
        onClick={handlePay}
        disabled={loading}
        className="w-full"
        size="lg"
      >
        {loading ? 'Creating checkout...' : `Pay $${amount.toFixed(2)} with Card`}
      </Button>
    </div>
  );
};

export default PayLioPayment;
