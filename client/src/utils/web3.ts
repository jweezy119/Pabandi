import { ethers } from 'ethers';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

// The address of our deployed Escrow Contract (BSC Testnet)
export const PABANDI_ESCROW_BSC = '0x6a05D28525b6422F09BB93f9cFB5E3e070c7937A';
export const PABANDI_TREASURY_SOLANA = 'PABANDi111111111111111111111111111111111111'; // Placeholder

// ABI for PabandiEscrow.sol
const ESCROW_ABI = [
  "function deposit(string memory _reservationId, address _business) external payable",
  "function releaseToBusiness(string memory _reservationId) external",
  "function refundToCustomer(string memory _reservationId) external",
  "event DepositCreated(string reservationId, address customer, address business, uint256 amount)"
];

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
 * Executes a BSC (BNB) deposit using MetaMask, interacting with the Escrow Smart Contract.
 */
export const executeBscDeposit = async (amountInBnb: string, businessWalletAddress: string, reservationId: string): Promise<Web3DepositResult> => {
  try {
    const targetAddress = businessWalletAddress || BSC_PLACEHOLDER_ADDRESSES[0];
    
    // In a production environment, you would ensure the targetAddress is valid.
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

    console.log(`Executing BSC Escrow Deposit. Total: ${amountInBnb} BNB for Reservation: ${reservationId}.`);

    // Call the deposit function on the PabandiEscrow contract
    const escrowContract = new ethers.Contract(PABANDI_ESCROW_BSC, ESCROW_ABI, signer);
    
    const tx = await escrowContract.deposit(reservationId, targetAddress, { 
      value: ethers.parseEther(amountInBnb) 
    });
    
    console.log(`Transaction submitted: ${tx.hash}. Waiting for confirmation...`);
    await tx.wait(); // Wait for 1 block confirmation

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
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile) {
        const url = encodeURIComponent(window.location.href);
        const ref = encodeURIComponent(window.location.origin);
        window.location.href = `https://phantom.app/ul/browse/${url}?ref=${ref}`;
        return { success: false, error: 'Redirecting to Phantom App...' };
      } else {
        throw new Error('Phantom wallet not found. Please install the Phantom browser extension.');
      }
    }

    const resp = await provider.connect();
    const userPublicKey = new PublicKey(resp.publicKey.toString());
    const treasuryPublicKey = new PublicKey(targetAddress);
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");

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
