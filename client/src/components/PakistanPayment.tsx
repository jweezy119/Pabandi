import React, { useState, useRef } from 'react';

interface PakistanPaymentProps {
  amount: number;
  description: string;
  onPaymentSubmit: (method: string, screenshot: File | null) => void;
}

const PAYMENT_METHODS = [
  {
    id: 'raast',
    name: 'Raast',
    icon: '🏦',
    description: 'Instant bank transfer (FREE)',
    color: 'emerald',
  },
  {
    id: 'jazzcash',
    name: 'JazzCash',
    icon: '📱',
    description: 'Mobile wallet',
    color: 'red',
  },
  {
    id: 'easypaisa',
    name: 'EasyPaisa',
    icon: '💳',
    description: 'Mobile wallet',
    color: 'green',
  },
];

// Merchant details (user fills these)
const MERCHANT_RAAST = '03123456789'; // JazzCash number works for Raast
const MERCHANT_JAZZCASH = '03123456789';
const MERCHANT_EASYPAISA = '03123456789';

export const PakistanPayment: React.FC<PakistanPaymentProps> = ({
  amount,
  description,
  onPaymentSubmit,
}) => {
  const [selectedMethod, setSelectedMethod] = useState('raast');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setScreenshot(file);
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = () => {
    setSubmitted(true);
    onPaymentSubmit(selectedMethod, screenshot);
  };

  if (submitted) {
    return (
      <div style={{
        padding: '24px',
        borderRadius: 12,
        background: 'linear-gradient(135deg, rgba(20,241,149,0.1), rgba(5,150,105,0.1))',
        border: '1px solid rgba(20,241,149,0.3)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
        <h3 style={{ color: '#14f195', margin: '0 0 8px' }}>Payment Submitted</h3>
        <p style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 16px' }}>
          Your payment is being verified. You'll receive PAB rewards once confirmed.
        </p>
        <div style={{
          padding: '12px',
          borderRadius: 8,
          background: 'rgba(20,241,149,0.05)',
          border: '1px solid rgba(20,241,149,0.1)',
        }}>
          <p style={{ color: '#14f195', fontSize: 12, margin: 0 }}>
            +{Math.round(amount / 10)} PAB reward pending
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '24px',
      borderRadius: 12,
      background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.9))',
      border: '1px solid rgba(148,163,184,0.1)',
    }}>
      {/* Amount */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <p style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 4px' }}>{description}</p>
        <h2 style={{ color: '#fff', margin: 0, fontSize: 28, fontWeight: 700 }}>
          Rs. {amount.toLocaleString()}
        </h2>
      </div>

      {/* Payment Methods */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 8px' }}>Select payment method:</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {PAYMENT_METHODS.map((method) => (
            <button
              key={method.id}
              onClick={() => setSelectedMethod(method.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                borderRadius: 8,
                border: selectedMethod === method.id
                  ? '1px solid rgba(20,241,149,0.5)'
                  : '1px solid rgba(148,163,184,0.1)',
                background: selectedMethod === method.id
                  ? 'rgba(20,241,149,0.05)'
                  : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <span style={{ fontSize: 20 }}>{method.icon}</span>
              <div style={{ textAlign: 'left', flex: 1 }}>
                <p style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 600,
                  color: selectedMethod === method.id ? '#14f195' : '#e2e8f0',
                }}>
                  {method.name}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>
                  {method.description}
                </p>
              </div>
              {selectedMethod === method.id && (
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#14f195',
                  boxShadow: '0 0 8px #14f195',
                }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Payment Details */}
      <div style={{
        padding: '16px',
        borderRadius: 8,
        background: 'rgba(20,241,149,0.05)',
        border: '1px solid rgba(20,241,149,0.1)',
        marginBottom: 20,
      }}>
        <p style={{ color: '#14f195', fontSize: 12, fontWeight: 600, margin: '0 0 8px' }}>
          PAYMENT DETAILS
        </p>
        {selectedMethod === 'raast' && (
          <div>
            <p style={{ color: '#e2e8f0', fontSize: 13, margin: '0 0 4px' }}>
              Raast ID: <span style={{ color: '#14f195', fontWeight: 600 }}>{MERCHANT_RAAST}</span>
            </p>
            <p style={{ color: '#64748b', fontSize: 11, margin: 0 }}>
              Open your bank app → Raast → Send to this number
            </p>
          </div>
        )}
        {selectedMethod === 'jazzcash' && (
          <div>
            <p style={{ color: '#e2e8f0', fontSize: 13, margin: '0 0 4px' }}>
              JazzCash: <span style={{ color: '#14f195', fontWeight: 600 }}>{MERCHANT_JAZZCASH}</span>
            </p>
            <p style={{ color: '#64748b', fontSize: 11, margin: 0 }}>
              JazzCash app → Send Money → Enter number
            </p>
          </div>
        )}
        {selectedMethod === 'easypaisa' && (
          <div>
            <p style={{ color: '#e2e8f0', fontSize: 13, margin: '0 0 4px' }}>
              EasyPaisa: <span style={{ color: '#14f195', fontWeight: 600 }}>{MERCHANT_EASYPAISA}</span>
            </p>
            <p style={{ color: '#64748b', fontSize: 11, margin: 0 }}>
              EasyPaisa app → Send Money → Enter number
            </p>
          </div>
        )}
        <p style={{ color: '#fbbf24', fontSize: 11, margin: '8px 0 0' }}>
          Amount: Rs. {amount.toLocaleString()}
        </p>
      </div>

      {/* Upload Screenshot */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 8px' }}>
          Upload payment screenshot:
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        {preview ? (
          <div style={{ position: 'relative' }}>
            <img
              src={preview}
              alt="Payment proof"
              style={{
                width: '100%',
                borderRadius: 8,
                border: '1px solid rgba(148,163,184,0.2)',
              }}
            />
            <button
              onClick={() => { setScreenshot(null); setPreview(null); }}
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                width: 24,
                height: 24,
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(239,68,68,0.8)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              ×
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: 8,
              border: '2px dashed rgba(148,163,184,0.2)',
              background: 'transparent',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            📷 Tap to upload screenshot
          </button>
        )}
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!screenshot}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: 10,
          border: 'none',
          background: screenshot
            ? 'linear-gradient(135deg, #14f195, #059669)'
            : 'rgba(148,163,184,0.2)',
          color: screenshot ? '#0f172a' : '#64748b',
          fontSize: 15,
          fontWeight: 600,
          cursor: screenshot ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s ease',
        }}
      >
        Submit Payment
      </button>

      {/* Reward */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 12,
      }}>
        <span style={{ color: '#64748b', fontSize: 11 }}>
          +{Math.round(amount / 10)} PAB reward on verification
        </span>
      </div>
    </div>
  );
};

export default PakistanPayment;
