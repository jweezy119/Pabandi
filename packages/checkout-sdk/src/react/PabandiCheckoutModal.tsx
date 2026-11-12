import React, { useEffect, useRef } from 'react';
import { CheckoutOptions } from '../types';
import { PabandiCheckout } from '../core/PabandiCheckout';

export interface PabandiCheckoutModalProps extends CheckoutOptions {
  open: boolean;
  onClose: () => void;
}

export const PabandiCheckoutModal: React.FC<PabandiCheckoutModalProps> = ({
  open,
  onClose,
  ...options
}) => {
  const checkoutRef = useRef<PabandiCheckout | null>(null);

  useEffect(() => {
    if (open) {
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
        onError: options.onError,
        onCancel: () => {
          options.onCancel?.();
          onClose();
        },
        onSuccess: (event) => {
          options.onSuccess?.(event);
          onClose();
        },
      };

      const checkout = new PabandiCheckout(checkoutOptions);
      checkoutRef.current = checkout;
      checkout.open();
    } else if (checkoutRef.current) {
      checkoutRef.current.close();
      checkoutRef.current = null;
    }

    return () => {
      if (checkoutRef.current) {
        checkoutRef.current.close();
        checkoutRef.current = null;
      }
    };
  }, [open]);

  return null;
};
