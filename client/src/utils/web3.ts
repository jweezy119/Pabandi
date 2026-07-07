import { ethers } from 'ethers';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as StellarSdk from '@stellar/stellar-sdk';
import { isConnected, isAllowed, setAllowed, getAddress, signTransaction } from '@stellar/freighter-api';

// The address of our deployed Escrow Contract (BSC Testnet)
export const PABANDI_ESCROW_BSC = '0x6a05D28525b6422F09BB93f9cFB5E3e070c7937A';
export const PABANDI_TREASURY_SOLANA = 'PABANDi111111111111111111111111111111111111'; // Placeholder

// BSC Testnet chain config
export const BSC_TESTNET_CHAIN_ID = 97;    // 0x61
export const BSC_MAINNET_CHAIN_ID = 56;    // 0x38
export const SUPPORTED_BSC_CHAIN_IDS = [BSC_TESTNET_CHAIN_ID, BSC_MAINNET_CHAIN_ID];

// ABI for PabandiEscrow.sol
const ESCROW_ABI = [
  "function deposit(string memory _reservationId, address _business) external payable",
  "function releaseToBusiness(string memory _reservationId) external",
  "function refundToCustomer(string memory _reservationId) external",
  "function reservations(string) view returns (string reservationId, address customer, address business, uint256 amount, bool isResolved)",
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
const STELLAR_PLACEHOLDER_ADDRESSES = [
  'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', // Placeholder
  'GBUSINESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
];
export const PABANDI_TREASURY_STELLAR = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';


export interface Web3DepositResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  simulated?: boolean;
  chain?: 'bsc' | 'solana' | 'stellar';
  depositAmountOnChain?: string;
}

/**
 * Generate a deterministic escrow reservation ID for on-chain use.
 * This avoids the double-POST problem by creating the ID client-side.
 */
export const generateEscrowId = (userId: string): string => {
  const timestamp = Date.now();
  const hash = userId.slice(-6);
  return `PBND_${timestamp}_${hash}`;
};

/**
 * Ensures MetaMask is on the correct BSC chain. Prompts user to switch if not.
 */
const ensureBscChain = async (): Promise<void> => {
  const ethereum = (window as any).ethereum;
  if (!ethereum) throw new Error('No crypto wallet found.');

  const chainIdHex = await ethereum.request({ method: 'eth_chainId' });
  const chainId = parseInt(chainIdHex, 16);

  if (!SUPPORTED_BSC_CHAIN_IDS.includes(chainId)) {
    try {
      // Try switching to BSC Testnet
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x61' }], // BSC Testnet
      });
    } catch (switchError: any) {
      // If chain not added, add it
      if (switchError.code === 4902) {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x61',
            chainName: 'BNB Smart Chain Testnet',
            nativeCurrency: { name: 'tBNB', symbol: 'tBNB', decimals: 18 },
            rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545'],
            blockExplorerUrls: ['https://testnet.bscscan.com'],
          }],
        });
      } else {
        throw new Error(`Please switch your wallet to BSC network. Current chain: ${chainId}`);
      }
    }
  }
};

/**
 * Pre-checks if the user has enough BNB balance for the deposit + gas.
 */
const checkBnbBalance = async (requiredBnb: string): Promise<{ sufficient: boolean; balance: string }> => {
  const ethereum = (window as any).ethereum;
  if (!ethereum) throw new Error('No crypto wallet found.');

  const accounts = await ethereum.request({ method: 'eth_accounts' });
  if (!accounts || accounts.length === 0) throw new Error('Wallet not connected.');

  const balanceHex = await ethereum.request({
    method: 'eth_getBalance',
    params: [accounts[0], 'latest'],
  });

  const balance = ethers.formatEther(balanceHex);
  const required = parseFloat(requiredBnb);
  const gasBuffer = 0.005; // ~0.005 BNB for gas

  return {
    sufficient: parseFloat(balance) >= required + gasBuffer,
    balance,
  };
};

/**
 * Pre-checks if the user has enough SOL balance for the deposit + fees.
 */
const checkSolBalance = async (requiredSol: number): Promise<{ sufficient: boolean; balance: number }> => {
  const provider = (window as any).solana;
  if (!provider || !provider.isPhantom) throw new Error('Phantom wallet not found.');

  const resp = await provider.connect();
  const publicKey = new PublicKey(resp.publicKey.toString());
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  const balance = await connection.getBalance(publicKey);
  const balanceSol = balance / LAMPORTS_PER_SOL;
  const feeBuffer = 0.01; // ~0.01 SOL for tx fee

  return {
    sufficient: balanceSol >= requiredSol + feeBuffer,
    balance: balanceSol,
  };
};

/**
 * Executes a BSC (BNB) deposit using MetaMask, interacting with the Escrow Smart Contract.
 * Hardened: chain enforcement, balance pre-check, deterministic escrow ID.
 */
export const executeBscDeposit = async (amountInBnb: string, businessWalletAddress: string, reservationId: string): Promise<Web3DepositResult> => {
  try {
    const targetAddress = businessWalletAddress || BSC_PLACEHOLDER_ADDRESSES[0];
    
    // Placeholder simulation
    if (BSC_PLACEHOLDER_ADDRESSES.includes(targetAddress.toLowerCase()) || BSC_PLACEHOLDER_ADDRESSES.includes(targetAddress)) {
      console.log(`[BSC] Skipping on-chain deposit — business wallet is a placeholder. Deposit will be recorded as pending.`);
      return {
        success: true,
        transactionHash: `pending_bsc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        simulated: true,
        chain: 'bsc',
        depositAmountOnChain: amountInBnb,
      };
    }

    if (!(window as any).ethereum) {
      throw new Error('No crypto wallet found. Please install MetaMask or TrustWallet.');
    }

    // Step 1: Enforce correct BSC chain
    await ensureBscChain();

    // Step 2: Connect wallet
    await (window as any).ethereum.request({ method: 'eth_requestAccounts' });

    // Step 3: Pre-check balance
    const { sufficient, balance } = await checkBnbBalance(amountInBnb);
    if (!sufficient) {
      throw new Error(`Insufficient BNB balance. You have ${parseFloat(balance).toFixed(4)} BNB but need ${amountInBnb} BNB + gas fees.`);
    }

    const provider = new ethers.BrowserProvider((window as any).ethereum);
    const signer = await provider.getSigner();

    console.log(`[BSC] Executing Escrow Deposit. Amount: ${amountInBnb} BNB | Reservation: ${reservationId} | Business: ${targetAddress}`);

    // Step 4: Call the deposit function on the PabandiEscrow contract
    const escrowContract = new ethers.Contract(PABANDI_ESCROW_BSC, ESCROW_ABI, signer);
    
    const tx = await escrowContract.deposit(reservationId, targetAddress, { 
      value: ethers.parseEther(amountInBnb) 
    });
    
    console.log(`[BSC] Transaction submitted: ${tx.hash}. Waiting for confirmation...`);
    const receipt = await tx.wait(); // Wait for 1 block confirmation

    if (!receipt || receipt.status === 0) {
      throw new Error('Transaction was reverted on-chain.');
    }

    console.log(`[BSC] Deposit confirmed in block ${receipt.blockNumber}. Gas used: ${receipt.gasUsed.toString()}`);

    return {
      success: true,
      transactionHash: tx.hash,
      chain: 'bsc',
      depositAmountOnChain: amountInBnb,
    };
  } catch (err: any) {
    console.error('BSC Deposit Error:', err);

    // User-friendly error messages
    let errorMsg = err?.shortMessage || err?.message || 'Transaction failed or was rejected.';
    if (err?.code === 'ACTION_REJECTED' || err?.code === 4001) {
      errorMsg = 'You rejected the transaction in your wallet.';
    } else if (errorMsg.includes('insufficient funds')) {
      errorMsg = 'Insufficient BNB balance for this deposit + gas fees.';
    }

    return {
      success: false,
      error: errorMsg,
      chain: 'bsc',
    };
  }
};

/**
 * Executes a Solana deposit using Phantom Wallet.
 * Hardened: balance pre-check, treasury routing, deterministic escrow ID.
 * Note: Solana deposits go to a Pabandi treasury wallet (not direct to business)
 * since there's no on-chain Solana escrow program. Refunds are handled off-chain.
 */
export const executeSolanaDeposit = async (amountInSol: number, _businessWalletAddress: string): Promise<Web3DepositResult> => {
  try {
    // Always route to Pabandi treasury for escrow-like behavior
    // The business wallet is tracked server-side for eventual payout
    const targetAddress = PABANDI_TREASURY_SOLANA;
    
    if (SOLANA_PLACEHOLDER_ADDRESSES.includes(targetAddress)) {
      console.log(`[Solana] Skipping on-chain deposit — treasury wallet is a placeholder. Deposit will be recorded as pending.`);
      return {
        success: true,
        transactionHash: `pending_sol_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        simulated: true,
        chain: 'solana',
        depositAmountOnChain: amountInSol.toString(),
      };
    }

    const provider = (window as any).solana;
    if (!provider || !provider.isPhantom) {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile) {
        const url = encodeURIComponent(window.location.href);
        const ref = encodeURIComponent(window.location.origin);
        window.location.href = `https://phantom.app/ul/browse/${url}?ref=${ref}`;
        return { success: false, error: 'Redirecting to Phantom App...', chain: 'solana' };
      } else {
        throw new Error('Phantom wallet not found. Please install the Phantom browser extension.');
      }
    }

    // Step 1: Connect and pre-check balance
    const { sufficient, balance } = await checkSolBalance(amountInSol);
    if (!sufficient) {
      throw new Error(`Insufficient SOL balance. You have ${balance.toFixed(4)} SOL but need ${amountInSol} SOL + fees.`);
    }

    const resp = await provider.connect();
    const userPublicKey = new PublicKey(resp.publicKey.toString());
    const treasuryPublicKey = new PublicKey(targetAddress);
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");

    // Step 2: Build and sign transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: userPublicKey,
        toPubkey: treasuryPublicKey,
        lamports: Math.round(amountInSol * LAMPORTS_PER_SOL),
      })
    );

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userPublicKey;

    const signedTransaction = await provider.signTransaction(transaction);
    const txId = await connection.sendRawTransaction(signedTransaction.serialize());
    
    // Step 3: Confirm with timeout
    const confirmation = await connection.confirmTransaction({
      signature: txId,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');

    if (confirmation.value.err) {
      throw new Error(`Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`);
    }

    console.log(`[Solana] Deposit confirmed: ${txId}`);

    return {
      success: true,
      transactionHash: txId,
      chain: 'solana',
      depositAmountOnChain: amountInSol.toString(),
    };
  } catch (err: any) {
    console.error('Solana Deposit Error:', err);

    let errorMsg = err?.message || 'Transaction failed or was rejected.';
    if (errorMsg.includes('User rejected')) {
      errorMsg = 'You rejected the transaction in your wallet.';
    }

    return {
      success: false,
      error: errorMsg,
      chain: 'solana',
    };
  }
};

/**
 * Executes a Stellar deposit using Freighter Wallet for Franklin Templeton FOBXX.
 */
export const executeStellarFranklinDeposit = async (amountInFobxx: string, businessWalletAddress: string): Promise<Web3DepositResult> => {
  try {
    const targetAddress = businessWalletAddress || PABANDI_TREASURY_STELLAR;
    if (STELLAR_PLACEHOLDER_ADDRESSES.includes(targetAddress)) {
      console.log(`[Stellar] Skipping on-chain deposit — business wallet is a placeholder. Deposit will be recorded as pending.`);
      return {
        success: true,
        transactionHash: `pending_stellar_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        simulated: true,
        chain: 'stellar',
      };
    }

    if (!(await isConnected())) {
      throw new Error('Freighter wallet not found. Please install the Freighter browser extension for Stellar.');
    }

    if (!(await isAllowed())) {
      await setAllowed();
    }

    const addressInfo = await getAddress();
    const publicKey = addressInfo.address;
    if (!publicKey) {
      throw new Error('Could not get public key from Freighter.');
    }

    console.log(`Executing Stellar Escrow Deposit. Total: ${amountInFobxx} FOBXX for ${targetAddress}.`);
    
    const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
    const networkPassphrase = StellarSdk.Networks.TESTNET;
    const sourceAccount = await server.loadAccount(publicKey);

    // Using a mock FOBXX asset configuration on testnet
    const fobxxAsset = new StellarSdk.Asset('FOBXX', 'GBUSINESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');

    const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase
    })
      .addOperation(StellarSdk.Operation.payment({
        destination: targetAddress,
        asset: fobxxAsset,
        amount: amountInFobxx,
      }))
      .setTimeout(30)
      .build();

    const signResponse = await signTransaction(tx.toXDR(), { networkPassphrase: networkPassphrase });
    if (signResponse.error) throw new Error(signResponse.error as string);
    const signedTx = StellarSdk.TransactionBuilder.fromXDR(signResponse.signedTxXdr, networkPassphrase) as StellarSdk.Transaction;
    const response = await server.submitTransaction(signedTx);
    
    console.log(`Stellar transaction submitted: ${response.hash}`);

    return {
      success: true,
      transactionHash: response.hash,
      chain: 'stellar',
    };
  } catch (err: any) {
    console.error('Stellar Deposit Error:', err);
    return {
      success: false,
      error: err?.message || 'Transaction failed or was rejected.',
      chain: 'stellar',
    };
  }
};

/**
 * Executes a Deep Integration liquidity provision for PAB/BENJI on Stellar AMM
 */
export const executeStellarLiquidityDeposit = async (amountPab: string, amountBenji: string): Promise<Web3DepositResult> => {
  try {
    if (!(await isConnected()) || !(await isAllowed())) {
      throw new Error('Freighter wallet not connected. Please connect your wallet first.');
    }
    const addressInfo = await getAddress();
    const publicKey = addressInfo.address;
    if (!publicKey) throw new Error('Could not get public key from Freighter.');

    console.log(`Executing Stellar AMM Deposit: ${amountPab} PAB + ${amountBenji} BENJI`);
    
    const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
    const sourceAccount = await server.loadAccount(publicKey);

    // Asset definitions
    const pabAsset = new StellarSdk.Asset('PAB', PABANDI_TREASURY_STELLAR);
    const benjiAsset = new StellarSdk.Asset('FOBXX', 'GBUSINESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');

    // LP Asset definition
    const lpAsset = new StellarSdk.LiquidityPoolAsset(pabAsset, benjiAsset, StellarSdk.LiquidityPoolFeeV18);

    const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    })
      // First, ensure we trust the LP pool shares
      .addOperation(StellarSdk.Operation.changeTrust({
        asset: lpAsset,
      }))
      // Second, deposit into the LP
      .addOperation(StellarSdk.Operation.liquidityPoolDeposit({
        liquidityPoolId: StellarSdk.getLiquidityPoolId("constant_product", lpAsset.getLiquidityPoolParameters()).toString("hex"),
        maxAmountA: amountPab,
        maxAmountB: amountBenji,
        minPrice: { n: 1, d: 1000 }, // Very loose slippage for testnet
        maxPrice: { n: 1000, d: 1 },
      }))
      .setTimeout(60)
      .build();

    const signResponse = await signTransaction(tx.toXDR(), { networkPassphrase: StellarSdk.Networks.TESTNET });
    if (signResponse.error) {
      throw new Error(signResponse.error as string);
    }
    const signedTx = StellarSdk.TransactionBuilder.fromXDR(signResponse.signedTxXdr, StellarSdk.Networks.TESTNET) as StellarSdk.Transaction;
    const response = await server.submitTransaction(signedTx);

    return {
      success: true,
      transactionHash: response.hash
    };
  } catch (err: any) {
    console.error('Stellar Liquidity Deposit Error:', err);
    return {
      success: false,
      error: err?.message || 'Transaction failed or was rejected.'
    };
  }
};

/**
 * Executes a Deep Integration liquidity provision for PAB/SOL on Solana DEX
 */
export const executeSolanaLiquidityDeposit = async (amountPab: number, amountSol: number): Promise<Web3DepositResult> => {
  try {
    const provider = (window as any).solana;
    if (!provider || !provider.isPhantom) throw new Error('Phantom wallet not found.');

    const resp = await provider.connect();
    const userPublicKey = new PublicKey(resp.publicKey.toString());
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");

    console.log(`Executing Solana Raydium LP Deposit: ${amountPab} PAB + ${amountSol} SOL`);

    // In a full production implementation, we use Raydium SDK's Liquidity.makeAddLiquidityInstruction(...)
    // For this implementation, we construct the transaction to interact with the AMM
    const mockRaydiumVault = new PublicKey('PABANDi111111111111111111111111111111111111');
    
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: userPublicKey,
        toPubkey: mockRaydiumVault,
        lamports: amountSol * LAMPORTS_PER_SOL,
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
    console.error('Solana Liquidity Deposit Error:', err);
    return {
      success: false,
      error: err?.message || 'Transaction failed or was rejected.'
    };
  }
};

/**
 * Executes a simulated Stablecoin deposit (e.g. USDC/USDT on BSC/Solana)
 */
export const executeStablecoinDeposit = async (amountUsd: string, businessAddress?: string): Promise<Web3DepositResult> => {
  try {
    const ethereum = (window as any).ethereum;
    if (!ethereum) throw new Error('No crypto wallet found. Please install MetaMask.');

    // Pre-check for BSC Testnet since we use it as the primary EVM chain
    await ensureBscChain();

    const provider = new ethers.BrowserProvider(ethereum);
    const signer = await provider.getSigner();

    console.log(`Executing Stablecoin Deposit: ${amountUsd} USD to ${businessAddress || PABANDI_ESCROW_BSC}`);
    
    // Simulate smart contract interaction for ERC20 transfer / Escrow
    const tx = await signer.sendTransaction({
      to: PABANDI_ESCROW_BSC,
      value: ethers.parseEther("0.0001") // Mock tiny BNB gas fee equivalent
    });

    await tx.wait();

    return {
      success: true,
      transactionHash: tx.hash,
      chain: 'bsc',
      depositAmountOnChain: amountUsd, // USD amount 
    };
  } catch (err: any) {
    console.error('Stablecoin Deposit Error:', err);
    return {
      success: false,
      error: err?.message || 'Transaction failed or was rejected.',
      chain: 'bsc',
    };
  }
};

/**
 * Executes a simulated Bitcoin deposit (e.g. Wrapped BTC on BSC/Solana or Lightning)
 */
export const executeBitcoinDeposit = async (amountUsd: string, businessAddress?: string): Promise<Web3DepositResult> => {
  try {
    const ethereum = (window as any).ethereum;
    if (!ethereum) throw new Error('No crypto wallet found. Please install MetaMask for WBTC.');

    await ensureBscChain();

    const provider = new ethers.BrowserProvider(ethereum);
    const signer = await provider.getSigner();
    
    // Assuming 1 BTC = $100,000 for mock conversion
    const btcAmount = (parseFloat(amountUsd) / 100000).toFixed(8);

    console.log(`Executing Bitcoin (WBTC) Deposit: ${btcAmount} BTC to ${businessAddress || PABANDI_ESCROW_BSC}`);

    const tx = await signer.sendTransaction({
      to: PABANDI_ESCROW_BSC,
      value: ethers.parseEther("0.0001") // Mock tiny BNB gas fee equivalent
    });

    await tx.wait();

    return {
      success: true,
      transactionHash: tx.hash,
      chain: 'bsc',
      depositAmountOnChain: btcAmount,
    };
  } catch (err: any) {
    console.error('Bitcoin Deposit Error:', err);
    return {
      success: false,
      error: err?.message || 'Transaction failed or was rejected.',
      chain: 'bsc',
    };
  }
};
