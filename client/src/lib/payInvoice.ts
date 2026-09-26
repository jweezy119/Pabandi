import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { usePrivy } from '@privy-io/react-auth';
import { useEmbeddedSolanaWallet } from '../hooks/useEmbeddedSolanaWallet';

const API_URL = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com/api/v1';

export interface InvoiceData {
  id: string;
  number: string;
  status: string;
  subtotal: number;
  currency: string;
  business: {
    name: string;
    solanaAddress: string;
  };
}

export interface PaymentResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

export async function payInvoice(invoiceId: string): Promise<PaymentResult> {
  try {
    const { authenticated, user } = usePrivy();

    if (!authenticated || !user) {
      return { success: false, error: 'Wallet not connected. Please authenticate first.' };
    }

    // Fetch invoice details
    const response = await fetch(`${API_URL}/public/invoices/${invoiceId}`);
    if (!response.ok) {
      return { success: false, error: 'Invoice not found or expired.' };
    }
    const invoice: InvoiceData = await response.json();

    // Get the embedded wallet
    const { wallet } = useEmbeddedSolanaWallet();
    if (!wallet?.address) {
      return { success: false, error: 'No wallet found. Please connect your wallet.' };
    }

    const fromPubKey = new PublicKey(wallet.address);
    const toPubKey = new PublicKey(invoice.business.solanaAddress);
    const amountLamports = Math.round(invoice.subtotal * 1e9);

    // Build USDC transfer transaction
    const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    const { blockhash } = await connection.getLatestBlockhash();

    const transaction = new Transaction({
      recentBlockhash: blockhash,
      feePayer: fromPubKey,
    }).add(
      SystemProgram.transfer({
        fromPubkey: fromPubKey,
        toPubkey: toPubKey,
        lamports: amountLamports,
      })
    );

    // Sign with embedded wallet
    const signedTx = await (wallet as any).signTransaction?.(transaction) || transaction;
    const rawTx = (signedTx as Transaction).serialize();

    // Send the transaction
    const signature = await connection.sendRawTransaction(rawTx, {
      skipPreflight: false,
      maxRetries: 3,
    });

    // Poll for confirmation (2-minute timeout)
    const startTime = Date.now();
    const timeout = 2 * 60 * 1000;

    while (Date.now() - startTime < timeout) {
      const status = await connection.getSignatureStatus(signature);
      if (status.value?.confirmationStatus === 'confirmed') {
        return { success: true, transactionHash: signature };
      }
      if (status.value?.err) {
        return { success: false, error: 'Transaction failed.' };
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return { success: false, error: 'Transaction timed out after 2 minutes.' };
  } catch (err) {
    return { success: false, error: `Payment failed: ${(err as Error).message}` };
  }
}
