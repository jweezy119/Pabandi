import { PabandiCheckout } from './core/PabandiCheckout';
import { ZkVerifier } from './core/zkVerifier';
import { CheckoutOptions } from './types';

export * from './types';
export * from './core/PabandiCheckout';
export * from './core/zkVerifier';
export * from './core/qrCodeGenerator';
export * from './core/styles';

/**
 * Convenient static factory helper for initializing checkout.
 */
export function initCheckout(options: CheckoutOptions): PabandiCheckout {
  return new PabandiCheckout(options);
}

// Global default export for UMD / script tag embedding
const Pabandi = {
  PabandiCheckout,
  ZkVerifier,
  initCheckout,
};

export default Pabandi;

