import React, { useState } from 'react';
import { CheckoutOptions, CheckoutSuccessEvent } from '../types';
import { PabandiCheckout } from '../core/PabandiCheckout';

export interface PabandiCheckoutButtonProps extends CheckoutOptions {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const PabandiCheckoutButton: React.FC<PabandiCheckoutButtonProps> = ({
  children,
  className,
  style,
  ...options
}) => {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    try {
      setLoading(true);
      const checkoutOptions: CheckoutOptions = {
        publishableKey: options.publishableKey,
        amount: options.amount,
        referenceId: options.referenceId,
        currency: options.currency,
        title: options.title,
        subtitle: options.subtitle,
        apiHost: options.apiHost,
        recipientWallet: options.recipientWallet,
        merchantRaastId: options.merchantRaastId,
        merchantIban: options.merchantIban,
        squareNote: options.squareNote,
        counterparty: options.counterparty,
        verifyCounterpartyZK: options.verifyCounterpartyZK,
        theme: options.theme,
        onSuccess: options.onSuccess,
        onCancel: options.onCancel,
        onError: options.onError,
      };
      const checkout = new PabandiCheckout(checkoutOptions);
      await checkout.open();
    } catch (err: any) {
      options.onError?.(err);
    } finally {
      setLoading(false);
    }
  };

  const defaultStyle: React.CSSProperties = {
    background: '#4fd1c5',
    color: '#0a1118',
    border: 'none',
    borderRadius: '0.5rem',
    padding: '0.75rem 1.25rem',
    fontWeight: 700,
    fontSize: '0.9375rem',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontFamily: 'system-ui, sans-serif',
    ...style,
  };

  return (
    <button
      type="button"
      className={className || 'pbn-checkout-trigger'}
      style={defaultStyle}
      onClick={handleClick}
      disabled={loading}
    >
      {children || `Deposit $${options.amount} via Pabandi Escrow`}
    </button>
  );
};
