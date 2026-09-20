import React from 'react';

interface RaastQRProps {
  amount: number;
  merchantId: string;
  description?: string;
}

export const RaastQR: React.FC<RaastQRProps> = ({ amount, merchantId }) => {
  return (
    <div style={{
      padding: '16px',
      borderRadius: 8,
      background: 'rgba(20,241,149,0.05)',
      border: '1px solid rgba(20,241,149,0.1)',
      textAlign: 'center',
    }}>
      <p style={{ color: '#14f195', fontSize: 12, fontWeight: 600, margin: '0 0 8px' }}>
        RAAST PAYMENT
      </p>
      <div style={{
        width: 120,
        height: 120,
        margin: '0 auto 8px',
        background: '#fff',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{ fontSize: 40, color: '#000' }}>{'\u{1F4F1}'}</span>
      </div>
      <p style={{ color: '#e2e8f0', fontSize: 13, margin: '0 0 4px' }}>
        Amount: <span style={{ color: '#14f195', fontWeight: 600 }}>Rs. {amount.toLocaleString()}</span>
      </p>
      <p style={{ color: '#64748b', fontSize: 11, margin: '0 auto', maxWidth: 200 }}>
        Merchant: {merchantId}
      </p>
      <p style={{ color: '#64748b', fontSize: 11, margin: '4px 0 0' }}>
        Scan with any bank app or JazzCash
      </p>
    </div>
  );
};

export default RaastQR;
