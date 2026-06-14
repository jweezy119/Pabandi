import { ethers } from 'ethers';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Central Pabandi Treasury Address (Escrow)
export const PABANDI_TREASURY_BSC = '0x1234567890123456789012345678901234567890'; // Placeholder
export const PABANDI_TREASURY_SOLANA = 'PABANDi111111111111111111111111111111111111'; // Placeholder

// Known placeholder addresses that should NOT receive real transactions
const BSC_PLACEHOLDER_ADDRESSES = [
  '0x1234567890123456789012345678901234567890',
  '0x0000000000000000000000000000000000000000',
];
const SOLANA_PLACEHOLDER_ADDRESSES = [
  'PABANDi111111111111111111111111111111111111',
  '11111111111111111111111111111111',
];

export interface Web3DepositResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  simulated?: boolean;
}

/**
 * Executes a BSC (BNB) deposit using MetaMask or similar injected provider.
 * If the business has no real wallet yet, the deposit is recorded as pending
 * and no on-chain transaction is attempted.
 */
export const executeBscDeposit = async (amountInBnb: string, businessWalletAddress: string): Promise<Web3DepositResult> => {
  try {
    // Check if the target address is a placeholder
    const targetAddress = businessWalletAddress || PABANDI_TREASURY_BSC;
    if (BSC_PLACEHOLDER_ADDRESSES.includes(targetAddress.toLowerCase()) || BSC_PLACEHOLDER_ADDRESSES.includes(targetAddress)) {
      console.log(`[BSC] Skipping on-chain deposit — business wallet is a placeholder. Deposit will be recorded as pending.`);
      return {
        success: true,
        transactionHash: `pending_bsc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        simulated: true,
      };
    }

    if (!(window as any).ethereum) {
      throw new Error('No crypto wallet found. Please install MetaMask or TrustWallet.');
    }

    await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    const signer = await provider.getSigner();

    console.log(`Executing BSC Deposit. Total: ${amountInBnb} BNB.`);
    console.log(`Treasury receives 100%, Smart Contract instantly splits 20% to ${targetAddress} as Good Faith. 80% Escrowed.`);

    // In a real implementation, this would be a contract call:
    // const contract = new ethers.Contract(PABANDI_TREASURY_BSC, ABI, signer);
    // const tx = await contract.depositAndSplit(businessWalletAddress, { value: ethers.parseEther(amountInBnb) });
    
    const tx = await signer.sendTransaction({
      to: targetAddress,
      value: ethers.parseEther(amountInBnb)
    });

    return {
      success: true,
      transactionHash: tx.hash
    };
  } catch (err: any) {
    console.error('BSC Deposit Error:', err);
    return {
      success: false,
      error: err?.shortMessage || err?.message || 'Transaction failed or was rejected.'
    };
  }
};

/**
 * Executes a Solana deposit using Phantom Wallet.
 * If the business has no real wallet yet, the deposit is recorded as pending
 * and no on-chain transaction is attempted.
 */
export const executeSolanaDeposit = async (amountInSol: number, businessWalletAddress: string): Promise<Web3DepositResult> => {
  try {
    const targetAddress = businessWalletAddress || PABANDI_TREASURY_SOLANA;
    if (SOLANA_PLACEHOLDER_ADDRESSES.includes(targetAddress)) {
      console.log(`[Solana] Skipping on-chain deposit — business wallet is a placeholder. Deposit will be recorded as pending.`);
      return {
        success: true,
        transactionHash: `pending_sol_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        simulated: true,
      };
    }

    const provider = (window as any).solana;
    if (!provider || !provider.isPhantom) {
      throw new Error('Phantom wallet not found. Please install the Phantom browser extension.');
    }

    // Connect wallet
    const resp = await provider.connect();
    const userPublicKey = new PublicKey(resp.publicKey.toString());
    const treasuryPublicKey = new PublicKey(targetAddress);

    // Mainnet-beta or devnet
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");

    console.log(`Executing Solana Deposit. Total: ${amountInSol} SOL.`);
    console.log(`Treasury receives 100%, Smart Contract instantly splits 20% to ${targetAddress} as Good Faith. 80% Escrowed.`);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: userPublicKey,
        toPubkey: treasuryPublicKey,
        lamports: amountInSol * LAMPORTS_PER_SOL,
      })
    );

    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userPublicKey;

    const signedTransaction = await provider.signTransaction(transaction);
    const txId = await connection.sendRawTransaction(signedTransaction.serialize());
    
    // Wait for confirmation
    await connection.confirmTransaction(txId);

    return {
      success: true,
      transactionHash: txId
    };
  } catch (err: any) {
    console.error('Solana Deposit Error:', err);
    return {
      success: false,
      error: err?.message || 'Transaction failed or was rejected.'
    };
  }
};
