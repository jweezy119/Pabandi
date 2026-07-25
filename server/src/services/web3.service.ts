import { prisma } from '../utils/database';
import { isDemoMode, web3RequiredEnv, web3ContractAddress, web3ExplorerBase } from '../utils/env';

const chainLabel = web3RequiredEnv().chain;
const explorerBase = web3ExplorerBase();
const escrowContract = web3ContractAddress();
const explorerUrl = (txHash: string) => `${explorerBase}/tx/${txHash}`;

const parseOnChainDeposit = (body: any) => {
  if (!body) return null;
  if (body.transactionHash || body.txHash) return String(body.transactionHash || body.txHash);
  if (body.cryptoDepositTxHash) return String(body.cryptoDepositTxHash);
  return null;
};

export const createReservationEscrow = async (reservationId: string, options?: { businessAddress?: string; amount?: number; onChainTxHash?: string }) => {
  const reservation = await prisma.reservation.findUnique({ where: { id: reservationId } });
  if (!reservation) {
    return { success: false as const, error: 'Reservation not found' };
  }


  if (isDemoMode()) {
    const mockTxHash = `escrow_init_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    await prisma.reservation.update({
      where: { id: reservationId },
      data: { cryptoDepositTxHash: mockTxHash, depositStatus: 'PENDING_WEB3' },
    });
    return { success: true as const, txHash: mockTxHash, status: 'pending_deposit', simulated: true, chain: chainLabel, explorerUrl: explorerUrl(mockTxHash), contract: escrowContract || null };
  }

  const txHash = options?.onChainTxHash || parseOnChainDeposit({ transactionHash: reservation.cryptoDepositTxHash });
  if (txHash) {
    await prisma.reservation.update({
      where: { id: reservationId },
      data: { cryptoDepositTxHash: txHash, depositStatus: 'PENDING_WEB3' },
    });
    return { success: true as const, txHash, status: 'pending_deposit', simulated: false, chain: chainLabel, explorerUrl: explorerUrl(txHash), contract: escrowContract || null };
  }

  const missing = [
    !process.env.WEB3_RPC_URL && !process.env.BSC_RPC_TESTNET_URL && !process.env.BSC_RPC_URL && 'WEB3_RPC_URL/BSC_RPC_URL',
    !process.env.ESCROW_ORACLE_PRIVATE_KEY && 'ESCROW_ORACLE_PRIVATE_KEY',
    !process.env.ESCROW_CONTRACT_ADDRESS && 'ESCROW_CONTRACT_ADDRESS',
  ].filter(Boolean);

  if (missing.length) {
    return { success: false as const, error: `On-chain escrow requires ${missing.join(', ')}` };
  }

  await prisma.reservation.update({
    where: { id: reservationId },
    data: { depositStatus: 'PENDING_WEB3' },
  });

  return { success: true as const, reservationId, status: 'pending_deposit', simulated: false, chain: chainLabel, explorerBase, contract: escrowContract || null };
};
