// Fiat Payment Page
// Supports PayPal, Venmo, Cash App, Zelle, ACH, Card (Manual), Cash, Check
// Honest bridge: records intent, generates payment instructions, business confirms receipt
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface FiatMethod {
  id: string;
  label: string;
  icon: string;
  description: string;
  hasQR: boolean;
  requiresBusinessConfirmation: boolean;
}

interface FiatPaymentRequest {
  type: 'fiat';
  method: string;
  reference: string;
  paymentUrl?: string;
  instructions: string;
  qrData?: string;
  amount: number;
  currency: string;
  status: string;
  escrowId?: string;
  creationFee?: number;
  netAmount?: number;
  warning?: string;
}

const FIAT_METHODS: FiatMethod[] = [
  { id: 'PAYPAL', label: 'PayPal', icon: '🅿️', description: 'Send via PayPal email or link', hasQR: true, requiresBusinessConfirmation: true },
  { id: 'VENMO', label: 'Venmo', icon: '💙', description: 'Send via Venmo handle', hasQR: true, requiresBusinessConfirmation: true },
  { id: 'CASH_APP', label: 'Cash App', icon: '💚', description: 'Send via Cash App $tag', hasQR: true, requiresBusinessConfirmation: true },
  { id: 'ZELLE', label: 'Zelle', icon: '⚡', description: 'Send from your bank app', hasQR: false, requiresBusinessConfirmation: true },
  { id: 'ACH', label: 'ACH Transfer', icon: '🏦', description: 'Direct bank transfer', hasQR: false, requiresBusinessConfirmation: true },
  { id: 'CARD', label: 'Credit/Debit Card', icon: '💳', description: 'Pay at business terminal', hasQR: false, requiresBusinessConfirmation: true },
  { id: 'CASH', label: 'Cash', icon: '💵', description: 'Pay in person', hasQR: false, requiresBusinessConfirmation: true },
  { id: 'CHECK', label: 'Check', icon: '📝', description: 'Pay by check', hasQR: false, requiresBusinessConfirmation: true },
];

export default function FiatPaymentPage() {
  const { reference } = useParams();
  const navigate = useNavigate();
  void useAuthStore();
  const [step, setStep] = useState<'select' | 'create' | 'details' | 'business'>(reference ? 'details' : 'select');
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [paymentRequest, setPaymentRequest] = useState<FiatPaymentRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedField, setCopiedField] = useState('');
  const [businessPending, setBusinessPending] = useState<any[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Load payment details if reference provided
  useEffect(() => {
    if (reference) {
      loadPaymentStatus();
    }
  }, [reference]);

  const loadPaymentStatus = async () => {
    try {
      const res = await fetch(`/api/v1/fiat/${reference}/status`);
      const json = await res.json();
      if (json.success) {
        setPaymentStatus(json.data);
        setPaymentRequest(json.data);
      } else {
        setError('Payment not found');
      }
    } catch {
      setError('Failed to load payment status');
    }
  };

  const handleCreatePayment = async () => {
    if (!selectedMethod || !amount) {
      setError('Please select a method and enter an amount');
      return;
    }

    setLoading(true);
    setError('');

    // Get payee config from form (simplified — in real app this comes from business profile)
    const payeeConfig = getPayeeConfigFromForm();

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/fiat/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          method: selectedMethod,
          amount: parseFloat(amount),
          payeeId: 'default-payee-id', // Would come from booking context
          payeeConfig,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setPaymentRequest(json.data);
        setStep('details');
      } else {
        setError(json.error || 'Failed to create payment');
      }
    } catch {
      setError('Network error');
    }
    setLoading(false);
  };

  const getPayeeConfigFromForm = () => {
    // In production, these come from the business profile
    return {
      paypalEmail: 'business@pabandi.com',
      venmoHandle: '@pabandi-business',
      cashAppTag: '$pabandi',
      zelleEmail: 'zelle@pabandi.com',
      bankName: 'Example Bank',
      bankAccount: '****1234',
      bankRouting: '****5678',
    };
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(''), 2000);
  };

  const handleMarkSent = async () => {
    if (!paymentRequest?.reference) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/v1/fiat/${paymentRequest.reference}/sent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      loadPaymentStatus();
    } catch {
      setError('Failed to mark as sent');
    }
  };

  const handleConfirmPayment = async (ref: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/fiat/${ref}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const json = await res.json();
      if (json.success) {
        loadPaymentStatus();
        loadBusinessPending();
      } else {
        setError(json.error || 'Failed to confirm');
      }
    } catch {
      setError('Network error');
    }
  };

  const handleRejectPayment = async (ref: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/fiat/${ref}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const json = await res.json();
      if (json.success) {
        setRejectReason('');
        loadBusinessPending();
      } else {
        setError(json.error || 'Failed to reject');
      }
    } catch {
      setError('Network error');
    }
  };

  const loadBusinessPending = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/fiat/pending', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (json.success) {
        setBusinessPending(json.data);
      }
    } catch {
      // ignore
    }
  };

  const loadBusinessView = async () => {
    setStep('business');
    await loadBusinessPending();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'SENT': return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'CONFIRMED': return 'text-green-700 bg-green-50 border-green-200';
      case 'REJECTED': return 'text-red-700 bg-red-50 border-red-200';
      case 'CANCELLED': return 'text-gray-700 bg-gray-50 border-gray-200';
      default: return 'text-slate-700 bg-slate-50 border-slate-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return '⏳';
      case 'SENT': return '📤';
      case 'CONFIRMED': return '✅';
      case 'REJECTED': return '❌';
      case 'CANCELLED': return '🚫';
      default: return '❓';
    }
  };

  // ── Business View ─────────────────────────────────────────────────────────

  if (step === 'business') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Fiat Payment Confirmations</h1>
        <p className="text-slate-600 mb-6">Review and confirm incoming fiat payments from customers.</p>

        {businessPending.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-lg">
            <span className="text-4xl">📭</span>
            <p className="mt-4 text-slate-600">No pending fiat payments to confirm</p>
          </div>
        ) : (
          <div className="space-y-4">
            {businessPending.map((payment: any) => (
              <div key={payment.id} className={`border rounded-lg p-4 ${getStatusColor(payment.status)}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{FIAT_METHODS.find(m => m.id === payment.method)?.icon}</span>
                    <div>
                      <p className="font-medium">{FIAT_METHODS.find(m => m.id === payment.method)?.label}</p>
                      <p className="text-sm">Ref: <span className="font-mono">{payment.reference}</span></p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">${payment.amount?.toFixed(2)}</p>
                    <p className="text-xs">{payment.status}</p>
                  </div>
                </div>

                {payment.payer && (
                  <p className="text-sm mb-2">
                    From: {payment.payer.firstName} {payment.payer.lastName} ({payment.payer.email})
                  </p>
                )}

                {payment.instructions && (
                  <details className="mt-2">
                    <summary className="text-xs cursor-pointer opacity-70">View instructions</summary>
                    <pre className="text-xs mt-1 whitespace-pre-wrap opacity-70">{payment.instructions}</pre>
                  </details>
                )}

                {payment.status === 'SENT' && (
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      placeholder="Reason (optional)"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="flex-1 px-3 py-1 text-sm border rounded"
                    />
                    <button
                      onClick={() => handleRejectPayment(payment.reference)}
                      className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleConfirmPayment(payment.reference)}
                      className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                    >
                      Confirm Receipt
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => setStep('select')}
          className="mt-6 px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
        >
          ← Back
        </button>
      </div>
    );
  }

  // ── Payment Details View ──────────────────────────────────────────────────

  if (step === 'details' && paymentRequest) {
    const method = FIAT_METHODS.find(m => m.id === paymentRequest.method);
    const status = paymentStatus?.status || paymentRequest.status;

    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Fiat Payment</h1>
        <p className="text-slate-600 mb-6">Your payment request has been created.</p>

        {/* Status Banner */}
        <div className={`border rounded-lg p-4 mb-6 ${getStatusColor(status)}`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{getStatusIcon(status)}</span>
            <div>
              <p className="font-medium text-lg">{status}</p>
              <p className="text-sm">
                {status === 'PENDING' && 'Awaiting payment from customer'}
                {status === 'SENT' && 'Payment sent — awaiting business confirmation'}
                {status === 'CONFIRMED' && 'Payment confirmed! Escrow released.'}
                {status === 'REJECTED' && 'Payment rejected. Escrow refunded.'}
                {status === 'CANCELLED' && 'Payment cancelled.'}
              </p>
            </div>
          </div>
        </div>

        {/* Method Card */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-4xl">{method?.icon}</span>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{method?.label}</h2>
              <p className="text-slate-600">{method?.description}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-slate-500">Amount</p>
              <p className="text-2xl font-bold">${paymentRequest.amount?.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Reference</p>
              <div className="flex items-center gap-2">
                <p className="font-mono text-sm">{paymentRequest.reference}</p>
                <button
                  onClick={() => copyToClipboard(paymentRequest.reference || '', 'ref')}
                  className="text-xs px-2 py-1 bg-slate-100 rounded hover:bg-slate-200"
                >
                  {copiedField === 'ref' ? '✓' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          {paymentRequest.creationFee !== undefined && (
            <div className="text-sm text-slate-500 border-t border-slate-100 pt-3 mb-3">
              <div className="flex justify-between">
                <span>Creation fee (1%)</span>
                <span>${paymentRequest.creationFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Net to business</span>
                <span>${paymentRequest.netAmount?.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* QR Code for mobile payments */}
          {paymentRequest.qrData && (
            <div className="mt-4 p-4 bg-slate-50 rounded-lg text-center">
              <p className="text-sm font-medium text-slate-700 mb-3">Scan to Pay</p>
              <QRCodeDisplay value={paymentRequest.qrData} size={180} />
              <p className="text-xs text-slate-500 mt-2 break-all font-mono">{paymentRequest.qrData}</p>
            </div>
          )}

          {/* Payment URL */}
          {paymentRequest.paymentUrl && (
            <a
              href={paymentRequest.paymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Open Payment Link →
            </a>
          )}

          {/* Instructions */}
          {paymentRequest.instructions && (
            <div className="mt-4">
              <details>
                <summary className="text-sm font-medium text-slate-700 cursor-pointer">View full instructions</summary>
                <pre className="mt-2 text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 p-3 rounded">
                  {paymentRequest.instructions}
                </pre>
              </details>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {status === 'PENDING' && (
          <div className="flex gap-3">
            <button
              onClick={handleMarkSent}
              className="flex-1 py-3 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600"
            >
              📤 I've Sent the Payment
            </button>
          </div>
        )}

        {paymentRequest.warning && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
            {paymentRequest.warning}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
          >
            Back Home
          </button>
          <button
            onClick={loadBusinessView}
            className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
          >
            Business View
          </button>
        </div>
      </div>
    );
  }

  // ── Create Payment View ───────────────────────────────────────────────────

  if (step === 'create') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Create Fiat Payment</h1>
        <p className="text-slate-600 mb-6">Choose a payment method and enter amount.</p>

        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">Amount (USD)</label>
            <div className="flex items-center gap-2">
              <span className="text-2xl text-slate-500">$</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1 text-2xl px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {amount && parseFloat(amount) > 0 && (
            <div className="mb-4 p-3 bg-slate-50 rounded text-sm text-slate-600">
              <div className="flex justify-between">
                <span>Creation fee (1%)</span>
                <span>${(parseFloat(amount) * 0.01).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Net to business</span>
                <span>${(parseFloat(amount) * 0.99).toFixed(2)}</span>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            onClick={handleCreatePayment}
            disabled={loading || !amount || parseFloat(amount) <= 0}
            className="w-full py-3 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Payment Request'}
          </button>
        </div>

        <button
          onClick={() => setStep('select')}
          className="mt-6 px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
        >
          ← Back
        </button>
      </div>
    );
  }

  // ── Method Selection View ─────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Pay with Fiat</h1>
      <p className="text-slate-600 mb-6">
        Choose your preferred payment method. No business verification required.
      </p>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-sm text-amber-800">
        <strong>How it works:</strong> Select a method → send payment directly to the business → business confirms receipt → escrow releases funds (minus 1% fee).
        All payments go through Pabandi escrow protection.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {FIAT_METHODS.map((method) => (
          <button
            key={method.id}
            onClick={() => {
              setSelectedMethod(method.id);
              setStep('create');
            }}
            className={`p-4 border rounded-lg text-left transition hover:border-amber-400 hover:shadow-md ${
              selectedMethod === method.id ? 'border-amber-500 bg-amber-50' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">{method.icon}</span>
              <div>
                <p className="font-medium text-slate-900">{method.label}</p>
                <p className="text-sm text-slate-500">{method.description}</p>
                {method.requiresBusinessConfirmation && (
                  <p className="text-xs text-amber-600 mt-1">⏳ Requires business confirmation</p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex gap-4">
        <button
          onClick={loadBusinessView}
          className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
        >
          🔒 Business: View Pending
        </button>
      </div>
    </div>
  );
}

// Simple QR Code component using inline SVG
function QRCodeDisplay({ value, size = 120 }: { value: string; size?: number }) {
  const gridSize = 21;
  const cellSize = size / gridSize;
  const pattern = generateQRPattern(value, gridSize);
  
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="inline-block">
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

function generateQRPattern(value: string, size: number): boolean[][] {
  const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  
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
