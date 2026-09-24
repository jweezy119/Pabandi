"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReservationEscrow = void 0;
const database_1 = require("../utils/database");
const env_1 = require("../utils/env");
const chainLabel = (0, env_1.web3RequiredEnv)().chain;
const explorerBase = (0, env_1.web3ExplorerBase)();
const escrowContract = (0, env_1.web3ContractAddress)();
const explorerUrl = (txHash) => `${explorerBase}/tx/${txHash}`;
const parseOnChainDeposit = (body) => {
    if (!body)
        return null;
    if (body.transactionHash || body.txHash)
        return String(body.transactionHash || body.txHash);
    if (body.cryptoDepositTxHash)
        return String(body.cryptoDepositTxHash);
    return null;
};
const createReservationEscrow = async (reservationId, options) => {
    const reservation = await database_1.prisma.reservation.findUnique({ where: { id: reservationId } });
    if (!reservation) {
        return { success: false, error: 'Reservation not found' };
    }
    if ((0, env_1.isDemoMode)()) {
        const mockTxHash = `escrow_init_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        await database_1.prisma.reservation.update({
            where: { id: reservationId },
            data: { cryptoDepositTxHash: mockTxHash, depositStatus: 'PENDING_WEB3' },
        });
        return { success: true, txHash: mockTxHash, status: 'pending_deposit', simulated: true, chain: chainLabel, explorerUrl: explorerUrl(mockTxHash), contract: escrowContract || null };
    }
    const txHash = options?.onChainTxHash || parseOnChainDeposit({ transactionHash: reservation.cryptoDepositTxHash });
    if (txHash) {
        await database_1.prisma.reservation.update({
            where: { id: reservationId },
            data: { cryptoDepositTxHash: txHash, depositStatus: 'PENDING_WEB3' },
        });
        return { success: true, txHash, status: 'pending_deposit', simulated: false, chain: chainLabel, explorerUrl: explorerUrl(txHash), contract: escrowContract || null };
    }
    const missing = [
        !process.env.WEB3_RPC_URL && !process.env.BSC_RPC_TESTNET_URL && !process.env.BSC_RPC_URL && 'WEB3_RPC_URL/BSC_RPC_URL',
        !process.env.ESCROW_ORACLE_PRIVATE_KEY && 'ESCROW_ORACLE_PRIVATE_KEY',
        !process.env.ESCROW_CONTRACT_ADDRESS && 'ESCROW_CONTRACT_ADDRESS',
    ].filter(Boolean);
    if (missing.length) {
        return { success: false, error: `On-chain escrow requires ${missing.join(', ')}` };
    }
    await database_1.prisma.reservation.update({
        where: { id: reservationId },
        data: { depositStatus: 'PENDING_WEB3' },
    });
    return { success: true, reservationId, status: 'pending_deposit', simulated: false, chain: chainLabel, explorerBase, contract: escrowContract || null };
};
exports.createReservationEscrow = createReservationEscrow;
//# sourceMappingURL=web3.service.js.map