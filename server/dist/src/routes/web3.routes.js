"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cryptoService_1 = require("../services/cryptoService");
const database_1 = require("../utils/database");
const env_1 = require("../utils/env");
const router = (0, express_1.Router)();
const chainLabel = (0, env_1.web3RequiredEnv)().chain;
const explorerBase = (0, env_1.web3ExplorerBase)();
const escrowContract = (0, env_1.web3ContractAddress)();
const explorerUrl = (txHash) => `${explorerBase}/tx/${txHash}`;
router.get('/status', (_req, res) => {
    const env = (0, env_1.web3RequiredEnv)();
    res.json({
        success: true,
        service: 'web3',
        mode: env.depositDefaultWeb3 ? 'default-web3' : 'optional',
        chain: env.chain,
        depositDefaultWeb3: env.depositDefaultWeb3,
        network: env.chain,
        explorerBase,
        contract: escrowContract || null,
        endpoints: [
            '/api/v1/web3/status',
            '/api/v1/web3/escrow/create',
            '/api/v1/web3/escrow/release',
            '/api/v1/web3/reputation/:address',
            '/api/v1/web3/escrow/receipts/:reservationId',
        ],
        demoMode: (0, env_1.isDemoMode)(),
        requiredEnv: [
            env.privateKey ? 'ESCROW_ORACLE_PRIVATE_KEY' : null,
            env.contract ? 'ESCROW_CONTRACT_ADDRESS' : null,
            env.rpc ? 'WEB3_RPC_URL/BSC_RPC_URL' : null,
        ].filter(Boolean),
    });
});
const parseOnChainDeposit = (body) => {
    if (!body)
        return null;
    if (body.transactionHash || body.txHash)
        return String(body.transactionHash || body.txHash);
    if (body.cryptoDepositTxHash)
        return String(body.cryptoDepositTxHash);
    return null;
};
// POST /api/v1/web3/escrow/create
router.post('/escrow/create', async (req, res, next) => {
    try {
        const { reservationId, businessAddress, amount, currency } = req.body;
        if (!reservationId || !businessAddress || !amount) {
            res.status(400).json({ success: false, error: 'reservationId, businessAddress, and amount are required' });
            return;
        }
        const reservation = await database_1.prisma.reservation.findUnique({ where: { id: reservationId } });
        if (!reservation) {
            res.status(404).json({ success: false, error: 'Reservation not found' });
            return;
        }
        if ((0, env_1.isDemoMode)()) {
            const mockTxHash = `escrow_init_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            await database_1.prisma.reservation.update({
                where: { id: reservationId },
                data: { cryptoDepositTxHash: mockTxHash, depositStatus: 'PENDING_WEB3' },
            });
            res.json({
                success: true,
                data: {
                    txHash: mockTxHash,
                    status: 'pending_deposit',
                    simulated: true,
                    chain: chainLabel,
                    explorerUrl: explorerUrl(mockTxHash),
                },
            });
            return;
        }
        const txHash = parseOnChainDeposit(req.body);
        if (txHash) {
            await database_1.prisma.reservation.update({
                where: { id: reservationId },
                data: { cryptoDepositTxHash: txHash, depositStatus: 'PENDING_WEB3' },
            });
            res.json({
                success: true,
                data: {
                    reservationId,
                    status: 'pending_deposit',
                    txHash,
                    chain: chainLabel,
                    explorerUrl: explorerUrl(txHash),
                    simulated: false,
                },
            });
            return;
        }
        const missing = [
            !process.env.WEB3_RPC_URL && !process.env.BSC_RPC_TESTNET_URL && !process.env.BSC_RPC_URL && 'WEB3_RPC_URL/BSC_RPC_URL',
            !process.env.ESCROW_ORACLE_PRIVATE_KEY && 'ESCROW_ORACLE_PRIVATE_KEY',
            !process.env.ESCROW_CONTRACT_ADDRESS && 'ESCROW_CONTRACT_ADDRESS',
        ].filter(Boolean);
        if (missing.length) {
            res.status(501).json({ success: false, error: `On-chain escrow requires ${missing.join(', ')}` });
            return;
        }
        await database_1.prisma.reservation.update({
            where: { id: reservationId },
            data: { depositStatus: 'PENDING_WEB3' },
        });
        res.json({
            success: true,
            data: {
                reservationId,
                status: 'pending_deposit',
                simulated: false,
                chain: chainLabel,
                explorerBase,
                contract: escrowContract,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
router.post('/escrow/release', async (req, res, next) => {
    try {
        const { reservationId, resolution } = req.body;
        if (!reservationId || !resolution) {
            res.status(400).json({ success: false, error: 'reservationId and resolution are required' });
            return;
        }
        const reservation = await database_1.prisma.reservation.findUnique({ where: { id: reservationId } });
        if (!reservation) {
            res.status(404).json({ success: false, error: 'Reservation not found' });
            return;
        }
        let resultHash;
        if (resolution === 'completed') {
            resultHash = await cryptoService_1.cryptoService.releaseEscrowToBusiness(reservationId);
            await database_1.prisma.reservation.update({
                where: { id: reservationId },
                data: { depositStatus: 'REIMBURSED_TO_BUSINESS' },
            });
        }
        else if (resolution === 'cancelled') {
            await cryptoService_1.cryptoService.refundEscrowToCustomer(reservationId);
            const afterRefund = await database_1.prisma.reservation.findUnique({ where: { id: reservationId }, select: { cryptoDepositTxHash: true } });
            resultHash = afterRefund?.cryptoDepositTxHash || null;
            await database_1.prisma.reservation.update({
                where: { id: reservationId },
                data: { depositStatus: resultHash ? 'PENDING_WEB3' : 'PENDING' },
            });
        }
        else {
            res.status(400).json({ success: false, error: 'invalid resolution type' });
            return;
        }
        const payload = { success: true, data: { txHash: resultHash, resolution } };
        if (resultHash) {
            payload.data.txLink = explorerUrl(resultHash);
            payload.data.chain = chainLabel;
        }
        res.json(payload);
    }
    catch (error) {
        next(error);
    }
});
router.get('/escrow/receipts/:reservationId', async (req, res, next) => {
    try {
        const { reservationId } = req.params;
        const reservation = await database_1.prisma.reservation.findUnique({ where: { id: reservationId } });
        if (!reservation || !reservation.depositRequired) {
            res.status(404).json({ success: false, error: 'Escrow receipt not found for this reservation' });
            return;
        }
        const business = await database_1.prisma.business.findUnique({ where: { id: reservation.businessId } });
        const txHash = reservation.cryptoDepositTxHash;
        res.json({
            success: true,
            data: {
                reservationId: reservation.id,
                status: reservation.status,
                depositStatus: reservation.depositStatus,
                depositAmount: reservation.depositAmount,
                currency: 'USD',
                txHash,
                txLink: txHash ? explorerUrl(txHash) : null,
                chain: chainLabel,
                scheduledAt: `${reservation.reservationDate.toISOString().split('T')[0]} ${reservation.reservationTime}`,
                customerId: reservation.customerId,
                businessId: reservation.businessId,
                businessCategory: business?.category || null,
                createdAt: reservation.createdAt,
                updatedAt: reservation.updatedAt,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/reputation/:address', async (req, res, next) => {
    try {
        const { address } = req.params;
        const user = await database_1.prisma.user.findFirst({
            where: { walletAddress: address },
            include: { _count: { select: { reservations: { where: { status: 'COMPLETED' } } } } },
        });
        if (!user) {
            res.status(404).json({ success: false, error: 'No reputation found for this address on Pabandi.' });
            return;
        }
        const noShows = await database_1.prisma.reservation.count({
            where: { customerId: user.id, status: 'NO_SHOW' },
        });
        const scoreAttestation = {
            address,
            userId: user.id,
            pabandiScore: user.trustScore,
            reliabilityScore: user.reliabilityScore,
            completedBookings: user._count.reservations,
            noShows,
            lastUpdated: new Date().toISOString(),
            escrowDefaultMode: (0, env_1.defaultDepositModeWeb3)(),
            chain: chainLabel,
        };
        res.json({ success: true, data: scoreAttestation });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=web3.routes.js.map