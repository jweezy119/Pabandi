import { BrowserSDK, AddressType } from '@phantom/browser-sdk';

export type PhantomAuthProvider = 'google' | 'apple' | 'injected' | 'deeplink';

let sdkInstance: BrowserSDK | null = null;
let cachedAddress: string | null = null;

function getPhantomAppId(): string | undefined {
  const raw = (import.meta as any).env?.VITE_PHANTOM_APP_ID as string | undefined;
  if (!raw || raw === 'your-app-id-here') return undefined;
  return raw.trim() || undefined;
}

export function isPhantomEmbeddedConfigured(): boolean {
  return Boolean(getPhantomAppId());
}

export function getPhantomSDK(): BrowserSDK {
  if (sdkInstance) return sdkInstance;

  const appId = getPhantomAppId();
  const redirectUrl =
    ((import.meta as any).env?.VITE_PHANTOM_REDIRECT_URL as string | undefined) ||
    (typeof window !== 'undefined' ? `${window.location.origin}/wallet` : undefined);

  if (appId) {
    sdkInstance = new BrowserSDK({
      providers: ['google', 'apple', 'injected', 'deeplink'],
      addressTypes: [AddressType.solana],
      appId,
      authOptions: redirectUrl ? { redirectUrl } : undefined,
    });
  } else {
    // Injected mode works locally without requiring an OAuth App ID
    sdkInstance = new BrowserSDK({
      providers: ['injected'],
      addressTypes: [AddressType.solana],
    });
  }

  return sdkInstance;
}

export async function connectWithPhantom(
  provider: PhantomAuthProvider = 'injected'
): Promise<{ address: string; provider: PhantomAuthProvider }> {
  if ((provider === 'google' || provider === 'apple' || provider === 'deeplink') && !isPhantomEmbeddedConfigured()) {
    throw new Error(
      'Embedded email/social Phantom Connect requires VITE_PHANTOM_APP_ID from https://phantom.com/portal. Use Phantom Extension or configure VITE_PHANTOM_APP_ID.'
    );
  }

  try {
    const sdk = getPhantomSDK();
    const result = await sdk.connect({ provider });
    const solanaEntry = result.addresses?.find(
      (a) => a.addressType === AddressType.solana
    );
    if (solanaEntry?.address) {
      cachedAddress = solanaEntry.address;
      return { address: solanaEntry.address, provider };
    }
    throw new Error('No Solana address returned from Phantom Connect');
  } catch (err) {
    // Fallback to direct injected Phantom extension when user chose injected
    if (provider === 'injected' && typeof window !== 'undefined' && (window as any).solana?.isPhantom) {
      const resp = await (window as any).solana.connect();
      const addr = resp.publicKey.toString();
      cachedAddress = addr;
      return { address: addr, provider: 'injected' };
    }
    throw err;
  }
}

export async function disconnectPhantom(): Promise<void> {
  try {
    if (sdkInstance) {
      await sdkInstance.disconnect();
    }
  } catch {
    // Ignore SDK disconnect error when falling back to window.solana
  }
  try {
    if (typeof window !== 'undefined' && (window as any).solana?.isConnected) {
      await (window as any).solana.disconnect();
    }
  } catch {
    // Ignore
  }
  cachedAddress = null;
}

export function getCachedPhantomAddress(): string | null {
  if (cachedAddress) return cachedAddress;
  if (typeof window !== 'undefined' && (window as any).solana?.isConnected) {
    return (window as any).solana.publicKey?.toString() || null;
  }
  return null;
}
