// Payment Test Page
// Demonstrates all payment rails: USDC (Solana), BTCPay (Bitcoin/Lightning), Manual
// Includes escrow state machine and QR code display
import { useState, useEffect, useCallback } from 'react';

interface PaymentRequest {
  id: string;
  reference: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  txSignature?: string | null;
}

interface PaymentResponse {
  payment: PaymentRequest;
  request: any;
}

type PaymentMethod = 'usdc' | 'btcpay' | 'manual' | 'solana' | 'bitcoin';

export default function PaymentTestPage() {
  const [method, setMethod] = useState<PaymentMethod>('usdc');
  const [amount, setAmount] = useState('25');
  const [currency, setCurrency] = useState('USDC');
  const [loading, setLoading] = useState(false);
  const [payment, setPayment] = useState<PaymentResponse | null>(null);
  const [polling, setPolling] = useState(false);
  const [txSig, setTxSig] = useState('');
  const [escrowId, setEscrowId] = useState<string | null>(null);
  const [escrowStatus, setEscrowStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = '/api/v1/payments';

  const createPayment = async () => {
    setLoading(true);
    setError(null);
    setPayment(null);
    setEscrowId(null);
    setEscrowStatus(null);

    try {
      const res = await fetch(`${API_BASE}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount),
          currency,
          type: method,
          memo: `test_payment_${Date.now()}`,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to create payment');
      }

      setPayment(data.data);

      // Automatically create escrow for demo
      if (data.data.payment) {
        const escrowRes = await fetch(`${API_BASE}/escrow/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentId: data.data.payment.id,
            payerId: 'demo_payer',
            payeeId: 'demo_payee',
            amount: parseFloat(amount),
          }),
        });
        const escrowData = await escrowRes.json();
        if (escrowData.success) {
          setEscrowId(escrowData.data.id);
          setEscrowStatus(escrowData.data.status);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyPayment = async () => {
    if (!payment) return;
    setLoading(true);
    setError(null);

    try {
      const body: any = {};
      if (method === 'usdc' && txSig) {
        body.txSig = txSig;
      } else if (method === 'btcpay') {
        body.invoiceId = txSig || payment.request?.id;
      }

      const res = await fetch(`${API_BASE}/${payment.payment.id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Verification failed');
      }

      setPayment(prev => prev ? {
        ...prev,
        payment: { ...prev.payment, status: data.data.status, txSignature: txSig || prev.payment.txSignature }
      } : null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = useCallback(async () => {
    if (!payment?.payment.id) return;

    try {
      const res = await fetch(`${API_BASE}/${payment.payment.id}/status`);
      const data = await res.json();
      if (data.success) {
        setPayment(prev => prev ? {
          ...prev,
          payment: { ...prev.payment, status: data.data.status }
        } : null);
      }
    } catch {}
  }, [payment?.payment.id]);

  // Poll status every 5 seconds
  useEffect(() => {
    if (!polling || !payment) return;
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [polling, payment, checkStatus]);

  const renderPaymentDetails = () => {
    if (!payment) return null;

    return (
      <div className="mt-6 space-y-6">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <h3 className="font-semibold text-[var(--warm-ink)] mb-2">Payment Details</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-[var(--soft-stone)]">Reference:</div>
            <div className="font-mono text-xs">{payment.payment.reference}</div>
            <div className="text-[var(--soft-stone)]">Type:</div>
            <div className="capitalize">{payment.payment.type}</div>
            <div className="text-[var(--soft-stone)]">Amount:</div>
            <div>{payment.payment.amount} {payment.payment.currency}</div>
            <div className="text-[var(--soft-stone)]">Status:</div>
            <div className={`font-semibold ${
              payment.payment.status === 'COMPLETED' ? 'text-green-600' :
              payment.payment.status === 'REFUNDED' ? 'text-[var(--terracotta)]' :
              'text-amber-600'
            }`}>{payment.payment.status}</div>
            {payment.payment.txSignature && (
              <>
                <div className="text-[var(--soft-stone)]">Tx Signature:</div>
                <div className="font-mono text-xs truncate">{payment.payment.txSignature}</div>
              </>
            )}
          </div>
        </div>

        {/* USDC QR Code */}
        {(payment.request?.type === 'solana' || payment.request?.type === 'usdc') && payment.request?.qrData && (
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <h3 className="font-semibold text-[var(--warm-ink)] mb-2">USDC Payment QR</h3>
            <div className="bg-white p-4 border border-slate-300 rounded-lg inline-block">
              <QRCodeDisplay value={payment.request.qrData} size={200} />
            </div>
            <p className="text-xs text-[var(--soft-stone)] mt-2 break-all font-mono">
              {payment.request.qrData}
            </p>
            {payment.request.deepLink && (
              <a
                href={payment.request.deepLink}
                className="inline-block mt-2 text-sm text-blue-600 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                Open in Phantom Wallet →
              </a>
            )}
          </div>
        )}

        {/* BTCPay Invoice */}
        {payment.request?.type === 'btcpay' && payment.request?.url && (
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <h3 className="font-semibold text-[var(--warm-ink)] mb-2">BTCPay Invoice</h3>
            <div className="bg-white p-4 border border-slate-300 rounded-lg inline-block">
              <QRCodeDisplay value={payment.request.qrData || payment.request.url} size={200} />
            </div>
            <a
              href={payment.request.url}
              target="_blank"
              rel="noreferrer"
              className="inline-block mt-4 px-4 py-2 bg-orange-500 text-[var(--warm-ink)] font-medium rounded-lg hover:bg-orange-600"
            >
              Pay with Bitcoin/Lightning →
            </a>
          </div>
        )}

        {/* Manual Payment */}
        {method === 'manual' && payment.request?.instructions && (
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <h3 className="font-semibold text-[var(--warm-ink)] mb-2">Manual Payment Instructions</h3>
            <pre className="text-sm text-[var(--soft-stone)] whitespace-pre-wrap bg-slate-50 p-3 rounded border">
              {payment.request.instructions}
            </pre>
          </div>
        )}

        {/* Escrow Info */}
        {escrowId && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Escrow Active</h3>
            <p className="text-sm text-blue-800">Escrow ID: <span className="font-mono">{escrowId.slice(0, 16)}...</span></p>
            <p className="text-sm text-blue-800">Status: <span className="font-semibold">{escrowStatus}</span></p>
          </div>
        )}

        {/* Verification Input */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <h3 className="font-semibold text-[var(--warm-ink)] mb-2">Verify Payment</h3>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={method === 'usdc' ? 'Transaction Signature...' : 'Invoice ID...'}
              value={txSig}
              onChange={(e) => setTxSig(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            <button
              onClick={verifyPayment}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-[var(--warm-ink)] text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              Verify
            </button>
          </div>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setPolling(!polling)}
              className={`px-3 py-1 text-xs rounded ${
                polling ? 'bg-[var(--dusty-rose)]/20 text-red-700' : 'bg-slate-200 text-[var(--soft-stone)]'
              }`}
            >
              {polling ? '⏸ Stop Polling' : '▶ Start Polling'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-[var(--warm-ink)] mb-2">Payment Rail Test</h1>
      <p className="text-[var(--soft-stone)] mb-6">
        Test crypto payment rails: USDC on Solana, BTCPay (Bitcoin/Lightning), and Manual confirmation.
      </p>

      {/* Payment Method Selection */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {(['usdc', 'btcpay', 'manual'] as PaymentMethod[]).map((m) => (
          <button
            key={m}
            onClick={() => setMethod(m)}
            className={`p-4 border rounded-lg text-center transition ${
              method === m
                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="text-2xl mb-1">
              {m === 'usdc' ? '◎' : m === 'btcpay' ? '₿' : '💵'}
            </div>
            <div className="text-sm font-medium">
              {m === 'usdc' ? 'USDC (Solana)' : m === 'btcpay' ? 'BTCPay' : 'Manual'}
            </div>
            <div className="text-xs text-[var(--soft-stone)] mt-1">
              {m === 'usdc' ? 'Fast, cheap, programmable' : m === 'btcpay' ? 'Bitcoin + Lightning' : 'Cash, bank, etc.'}
            </div>
          </button>
        ))}
      </div>

      {/* Amount Input */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1">
          <label className="block text-sm font-medium text-[var(--soft-stone)] mb-1">Amount</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg"
          />
        </div>
        <div className="w-32">
          <label className="block text-sm font-medium text-[var(--soft-stone)] mb-1">Currency</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg"
          >
            <option value="USDC">USDC</option>
            <option value="USD">USD</option>
            <option value="BTC">BTC</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
      </div>

      {/* Create Payment Button */}
      <button
        onClick={createPayment}
        disabled={loading || !amount}
        className="w-full py-3 bg-blue-600 text-[var(--warm-ink)] font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Creating...' : `Create ${method.toUpperCase()} Payment Request`}
      </button>

      {/* Error */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Payment Details */}
      {renderPaymentDetails()}
    </div>
  );
}

// Simple QR Code component using inline SVG
function QRCodeDisplay({ value, size = 200 }: { value: string; size?: number }) {
  // Generate a simple deterministic pattern based on the value
  const gridSize = 21;
  const cellSize = size / gridSize;
  const pattern = generateQRPattern(value, gridSize);
  
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <rect width={size} height={size} fill="white" />
      {pattern.map((row, y) =>
        row.map((cell, x) =>
          cell ? (
            <rect
              key={`${x}-${y}`}
              x={x * cellSize}
              y={y * cellSize}
              width={cellSize}
              height={cellSize}
              fill="black"
            />
          ) : null
        )
      )}
    </svg>
  );
}

// Generate a deterministic pattern (simplified QR-like visual)
function generateQRPattern(value: string, size: number): boolean[][] {
  const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  
  // Add finder patterns (top-left, top-right, bottom-left)
  const addFinder = (ox: number, oy: number) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const isBorder = y === 0 || y === 6 || x === 0 || x === 6;
        const isCenter = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        if (ox + x < size && oy + y < size) {
          grid[oy + y][ox + x] = isBorder || isCenter;
        }
      }
    }
  };
  
  addFinder(0, 0);
  addFinder(size - 7, 0);
  addFinder(0, size - 7);
  
  // Add data pattern based on value hash
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  
  for (let y = 7; y < size - 7; y++) {
    for (let x = 7; x < size - 7; x++) {
      const bit = (hash >> ((x + y * size) % 31)) & 1;
      grid[y][x] = bit === 1;
    }
  }
  
  return grid;
}
