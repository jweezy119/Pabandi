"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unstakeYield = exports.stakeYield = exports.getStakingStatus = exports.releaseStake = exports.resolveStake = exports.stakeCollateral = void 0;
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const stakeCollateral = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { reservationId, amount } = req.body;
        const user = await database_1.prisma.user.findUnique({
            where: { id: userId },
            include: { wallet: true }
        });
        if (!user?.wallet || user.wallet.balance < amount) {
            return res.status(400).json({ success: false, error: 'Insufficient PAB balance for earnest deposit.' });
        }
        // Deduct from wallet balance and "lock" it as Hamish Jiddiyyah
        await database_1.prisma.wallet.update({
            where: { userId: userId },
            data: { balance: { decrement: amount } }
        });
        await database_1.prisma.reservation.update({
            where: { id: reservationId },
            data: { cryptoDepositTxHash: `HAMISH_JIDDIYYAH_${amount}_PAB` }
        });
        res.json({
            success: true,
            message: `${amount} PAB successfully locked as Hamish Jiddiyyah (Earnest Deposit).`
        });
    }
    catch (error) {
        logger_1.logger.error('Error locking Hamish Jiddiyyah:', error);
        res.status(500).json({ success: false, error: 'Failed to lock deposit' });
    }
};
exports.stakeCollateral = stakeCollateral;
const resolveStake = async (req, res) => {
    try {
        // Called upon No-Show verification. Business claims actual damages only.
        const { reservationId, actualDamages } = req.body;
        if (actualDamages === undefined || actualDamages < 0) {
            return res.status(400).json({ success: false, error: 'Must specify actual damages incurred (can be 0).' });
        }
        const reservation = await database_1.prisma.reservation.findUnique({
            where: { id: reservationId }
        });
        if (!reservation?.cryptoDepositTxHash?.startsWith('HAMISH_JIDDIYYAH_')) {
            return res.status(400).json({ success: false, error: 'No active earnest deposit found for this reservation.' });
        }
        const stakedAmount = parseFloat(reservation.cryptoDepositTxHash.split('_')[2]);
        const damagesToDeduct = Math.min(actualDamages, stakedAmount);
        const refundAmount = stakedAmount - damagesToDeduct;
        // 1. Give damages to business owner
        if (damagesToDeduct > 0) {
            const business = await database_1.prisma.business.findUnique({ where: { id: reservation.businessId } });
            if (business?.ownerId) {
                await database_1.prisma.wallet.upsert({
                    where: { userId: business.ownerId },
                    update: { balance: { increment: damagesToDeduct } },
                    create: { userId: business.ownerId, balance: damagesToDeduct }
                });
            }
        }
        // 2. Refund excess to customer
        if (refundAmount > 0) {
            await database_1.prisma.wallet.update({
                where: { userId: reservation.customerId },
                data: { balance: { increment: refundAmount } }
            });
        }
        // Clear the deposit status
        await database_1.prisma.reservation.update({
            where: { id: reservationId },
            data: { cryptoDepositTxHash: `RESOLVED_${damagesToDeduct}_DAMAGES_${refundAmount}_REFUNDED` }
        });
        res.json({
            success: true,
            message: `${stakedAmount} PAB deposit resolved. ${damagesToDeduct} transferred to business for actual damages, ${refundAmount} refunded to customer.`
        });
    }
    catch (error) {
        logger_1.logger.error('Error resolving earnest deposit:', error);
        res.status(500).json({ success: false, error: 'Failed to resolve deposit' });
    }
};
exports.resolveStake = resolveStake;
const releaseStake = async (req, res) => {
    try {
        // Called upon successful check-in or valid cancellation. Returns 100% to customer.
        const { reservationId } = req.body;
        const reservation = await database_1.prisma.reservation.findUnique({
            where: { id: reservationId }
        });
        if (!reservation?.cryptoDepositTxHash?.startsWith('HAMISH_JIDDIYYAH_')) {
            return res.status(400).json({ success: false, error: 'No active earnest deposit found for this reservation.' });
        }
        const stakedAmount = parseFloat(reservation.cryptoDepositTxHash.split('_')[2]);
        // Return 100% to customer
        await database_1.prisma.wallet.update({
            where: { userId: reservation.customerId },
            data: { balance: { increment: stakedAmount } }
        });
        // Clear the deposit status
        await database_1.prisma.reservation.update({
            where: { id: reservationId },
            data: { cryptoDepositTxHash: `RELEASED_${stakedAmount}_PAB` }
        });
        res.json({
            success: true,
            message: `100% of Hamish Jiddiyyah (${stakedAmount} PAB) has been released and refunded to the customer.`
        });
    }
    catch (error) {
        logger_1.logger.error('Error releasing earnest deposit:', error);
        res.status(500).json({ success: false, error: 'Failed to release deposit' });
    }
};
exports.releaseStake = releaseStake;
// ==========================================
// YIELD STAKING POOL (MUDARABAH PROFIT-SHARING)
// ==========================================
const getStakingStatus = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        const positions = await database_1.prisma.stakingPosition.findMany({
            where: { userId, status: 'ACTIVE' }
        });
        const totalStakedByUser = positions.reduce((sum, pos) => sum + pos.amount, 0);
        const allPositions = await database_1.prisma.stakingPosition.findMany({
            where: { status: 'ACTIVE' }
        });
        const globalTotalStaked = allPositions.reduce((sum, pos) => sum + pos.amount, 0);
        const estimatedYield = globalTotalStaked > 0 ? 12.5 : 0; // 12.5% placeholder
        res.json({
            success: true,
            totalStaked: totalStakedByUser,
            globalTotalStaked,
            estimatedYield,
            positions
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching staking status:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
exports.getStakingStatus = getStakingStatus;
const stakeYield = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        const { amount } = req.body;
        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, error: 'Invalid staking amount' });
        }
        const wallet = await database_1.prisma.wallet.findUnique({ where: { userId } });
        if (!wallet || wallet.balance < amount) {
            return res.status(400).json({ success: false, error: 'Insufficient PAB balance in Vault' });
        }
        await database_1.prisma.$transaction([
            database_1.prisma.wallet.update({
                where: { userId },
                data: { balance: { decrement: amount } }
            }),
            database_1.prisma.stakingPosition.create({
                data: {
                    userId,
                    amount,
                    status: 'ACTIVE'
                }
            }),
            database_1.prisma.stakeTransaction.create({
                data: {
                    userId,
                    amount,
                    type: 'YIELD_STAKE'
                }
            })
        ]);
        res.json({ success: true, message: `Successfully staked ${amount} PAB` });
    }
    catch (error) {
        logger_1.logger.error('Error staking:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
exports.stakeYield = stakeYield;
const unstakeYield = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        const { positionId } = req.body;
        if (!positionId) {
            return res.status(400).json({ success: false, error: 'Position ID is required' });
        }
        const position = await database_1.prisma.stakingPosition.findFirst({
            where: { id: positionId, userId, status: 'ACTIVE' }
        });
        if (!position) {
            return res.status(404).json({ success: false, error: 'Active staking position not found' });
        }
        await database_1.prisma.$transaction([
            database_1.prisma.stakingPosition.update({
                where: { id: positionId },
                data: { status: 'WITHDRAWN' }
            }),
            database_1.prisma.wallet.update({
                where: { userId },
                data: { balance: { increment: position.amount } }
            }),
            database_1.prisma.stakeTransaction.create({
                data: {
                    userId,
                    amount: position.amount,
                    type: 'YIELD_UNSTAKE'
                }
            })
        ]);
        res.json({ success: true, message: `Successfully unstaked ${position.amount} PAB` });
    }
    catch (error) {
        logger_1.logger.error('Error unstaking:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
exports.unstakeYield = unstakeYield;
//# sourceMappingURL=staking.controller.js.map