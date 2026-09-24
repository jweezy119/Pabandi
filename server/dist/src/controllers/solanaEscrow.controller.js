"use strict";
/**
 * Solana Escrow Controller
 * ─────────────────────────────────────────────
 * Handles all on-chain escrow operations: create, fund, release,
 * refund, and dispute. Records every on-chain transaction in the
 * database for audit purposes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.listEscrows = exports.getEscrow = exports.raiseDispute = exports.refundEscrow = exports.releaseEscrow = exports.fundEscrow = exports.createEscrow = void 0;
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const web3_js_1 = require("@solana/web3.js");
const constants_1 = require("../services/solanaEscrow/constants");
const sdk_1 = require("../services/solanaEscrow/sdk");
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const USDC_MINT = IS_PRODUCTION ? constants_1.USDC_MINT_MAINNET : constants_1.USDC_MINT_DEVNET;
// ─────────────────────────────────────────────────────────────────────────────
// Create Escrow
// ─────────────────────────────────────────────────────────────────────────────
const createEscrow = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const { sellerId, amount, reference, businessId } = req.body;
        // Validate required fields
        if (!sellerId || !amount || !reference) {
            return res.status(400).json({
                success: false,
                error: 'sellerId, amount, and reference are required',
            });
        }
        // Validate amount
        if (typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Amount must be a positive number',
            });
        }
        // Validate reference length
        if (reference.length > 64) {
            return res.status(400).json({
                success: false,
                error: 'Reference must be 64 characters or fewer',
            });
        }
        // Check if escrow with this reference already exists
        const existingEscrow = await database_1.prisma.solanaEscrow.findUnique({
            where: { reference },
        });
        if (existingEscrow) {
            return res.status(409).json({
                success: false,
                error: 'An escrow with this reference already exists',
            });
        }
        // Get buyer and seller public keys
        const buyer = await database_1.prisma.user.findUnique({ where: { id: userId } });
        const seller = await database_1.prisma.user.findUnique({ where: { id: sellerId } });
        if (!buyer || !buyer.walletAddress) {
            return res.status(400).json({
                success: false,
                error: 'Buyer wallet not configured',
            });
        }
        if (!seller || !seller.walletAddress) {
            return res.status(400).json({
                success: false,
                error: 'Seller wallet not configured',
            });
        }
        // Derive the PDA
        const [escrowPda, bump] = (0, sdk_1.getEscrowPDA)(new web3_js_1.PublicKey(buyer.walletAddress), new web3_js_1.PublicKey(seller.walletAddress), reference);
        // Create the escrow record in the database
        const escrow = await database_1.prisma.solanaEscrow.create({
            data: {
                escrowPda: escrowPda.toBase58(),
                reference,
                buyerId: userId,
                sellerId,
                businessId: businessId || null,
                mint: USDC_MINT,
                amount,
                status: constants_1.ESCROW_STATUS.CREATED,
                bump,
                txCreate: null, // Would be set after on-chain tx
            },
        });
        logger_1.logger.info(`Solana escrow created: id=${escrow.id}, pda=${escrowPda.toBase58()}, buyer=${userId}, seller=${sellerId}`);
        return res.status(201).json({
            success: true,
            data: {
                id: escrow.id,
                escrowPda: escrow.escrowPda,
                reference: escrow.reference,
                status: escrow.status,
                amount: escrow.amount,
                mint: escrow.mint,
                bump: escrow.bump,
                createdAt: escrow.createdAt,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Error creating Solana escrow:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to create escrow',
        });
    }
};
exports.createEscrow = createEscrow;
// ─────────────────────────────────────────────────────────────────────────────
// Fund Escrow
// ─────────────────────────────────────────────────────────────────────────────
const fundEscrow = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const { id } = req.params;
        // Find the escrow
        const escrow = await database_1.prisma.solanaEscrow.findUnique({
            where: { id },
        });
        if (!escrow) {
            return res.status(404).json({ success: false, error: 'Escrow not found' });
        }
        // Only the buyer can fund
        if (escrow.buyerId !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Only the buyer can fund this escrow',
            });
        }
        // Must be in CREATED status
        if (escrow.status !== constants_1.ESCROW_STATUS.CREATED) {
            return res.status(400).json({
                success: false,
                error: `Cannot fund escrow in ${escrow.status} status`,
            });
        }
        // In production: invoke the on-chain fund_escrow instruction here
        // For now, simulate the on-chain transaction
        const simulatedTxSig = `sim_fund_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        // Update the escrow record
        const updated = await database_1.prisma.solanaEscrow.update({
            where: { id },
            data: {
                status: constants_1.ESCROW_STATUS.FUNDED,
                txFund: simulatedTxSig,
            },
        });
        logger_1.logger.info(`Solana escrow funded: id=${id}, tx=${simulatedTxSig}`);
        return res.json({
            success: true,
            data: {
                id: updated.id,
                status: updated.status,
                txFund: updated.txFund,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Error funding Solana escrow:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fund escrow',
        });
    }
};
exports.fundEscrow = fundEscrow;
// ─────────────────────────────────────────────────────────────────────────────
// Release Escrow
// ─────────────────────────────────────────────────────────────────────────────
const releaseEscrow = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const { id } = req.params;
        const escrow = await database_1.prisma.solanaEscrow.findUnique({
            where: { id },
        });
        if (!escrow) {
            return res.status(404).json({ success: false, error: 'Escrow not found' });
        }
        // Only buyer or seller (platform) can release
        if (escrow.buyerId !== userId && escrow.sellerId !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Only the buyer or seller can release funds',
            });
        }
        // Must be in FUNDED status
        if (escrow.status !== constants_1.ESCROW_STATUS.FUNDED) {
            return res.status(400).json({
                success: false,
                error: `Cannot release escrow in ${escrow.status} status`,
            });
        }
        const simulatedTxSig = `sim_release_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const updated = await database_1.prisma.solanaEscrow.update({
            where: { id },
            data: {
                status: constants_1.ESCROW_STATUS.RELEASED,
                txRelease: simulatedTxSig,
            },
        });
        logger_1.logger.info(`Solana escrow released: id=${id}, tx=${simulatedTxSig}`);
        return res.json({
            success: true,
            data: {
                id: updated.id,
                status: updated.status,
                txRelease: updated.txRelease,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Error releasing Solana escrow:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to release escrow',
        });
    }
};
exports.releaseEscrow = releaseEscrow;
// ─────────────────────────────────────────────────────────────────────────────
// Refund Escrow
// ─────────────────────────────────────────────────────────────────────────────
const refundEscrow = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const { id } = req.params;
        const escrow = await database_1.prisma.solanaEscrow.findUnique({
            where: { id },
        });
        if (!escrow) {
            return res.status(404).json({ success: false, error: 'Escrow not found' });
        }
        // Only buyer or platform can refund
        if (escrow.buyerId !== userId && escrow.sellerId !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Only the buyer or platform can refund',
            });
        }
        // Must be in FUNDED or DISPUTED status
        if (escrow.status !== constants_1.ESCROW_STATUS.FUNDED &&
            escrow.status !== constants_1.ESCROW_STATUS.DISPUTED) {
            return res.status(400).json({
                success: false,
                error: `Cannot refund escrow in ${escrow.status} status`,
            });
        }
        const simulatedTxSig = `sim_refund_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const updated = await database_1.prisma.solanaEscrow.update({
            where: { id },
            data: {
                status: constants_1.ESCROW_STATUS.REFUNDED,
                txRefund: simulatedTxSig,
            },
        });
        logger_1.logger.info(`Solana escrow refunded: id=${id}, tx=${simulatedTxSig}`);
        return res.json({
            success: true,
            data: {
                id: updated.id,
                status: updated.status,
                txRefund: updated.txRefund,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Error refunding Solana escrow:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to refund escrow',
        });
    }
};
exports.refundEscrow = refundEscrow;
// ─────────────────────────────────────────────────────────────────────────────
// Raise Dispute
// ─────────────────────────────────────────────────────────────────────────────
const raiseDispute = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const { id } = req.params;
        const escrow = await database_1.prisma.solanaEscrow.findUnique({
            where: { id },
        });
        if (!escrow) {
            return res.status(404).json({ success: false, error: 'Escrow not found' });
        }
        // Only buyer or seller can dispute
        if (escrow.buyerId !== userId && escrow.sellerId !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Only the buyer or seller can raise a dispute',
            });
        }
        // Must be in CREATED or FUNDED status
        if (escrow.status !== constants_1.ESCROW_STATUS.CREATED &&
            escrow.status !== constants_1.ESCROW_STATUS.FUNDED) {
            return res.status(400).json({
                success: false,
                error: `Cannot dispute escrow in ${escrow.status} status`,
            });
        }
        const updated = await database_1.prisma.solanaEscrow.update({
            where: { id },
            data: {
                status: constants_1.ESCROW_STATUS.DISPUTED,
            },
        });
        logger_1.logger.info(`Dispute raised on escrow: id=${id}, by=${userId}`);
        return res.json({
            success: true,
            data: {
                id: updated.id,
                status: updated.status,
                updatedAt: updated.updatedAt,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Error raising dispute:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to raise dispute',
        });
    }
};
exports.raiseDispute = raiseDispute;
// ─────────────────────────────────────────────────────────────────────────────
// Get Escrow State
// ─────────────────────────────────────────────────────────────────────────────
const getEscrow = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const { id } = req.params;
        const escrow = await database_1.prisma.solanaEscrow.findUnique({
            where: { id },
            include: {
                buyer: {
                    select: { id: true, firstName: true, lastName: true, walletAddress: true },
                },
                seller: {
                    select: { id: true, firstName: true, lastName: true, walletAddress: true },
                },
                business: {
                    select: { id: true, name: true },
                },
            },
        });
        if (!escrow) {
            return res.status(404).json({ success: false, error: 'Escrow not found' });
        }
        // Only buyer, seller, or admin can view
        if (escrow.buyerId !== userId &&
            escrow.sellerId !== userId) {
            // Check if user is admin
            const user = await database_1.prisma.user.findUnique({ where: { id: userId } });
            if (user?.role !== 'ADMIN') {
                return res.status(403).json({
                    success: false,
                    error: 'Not authorized to view this escrow',
                });
            }
        }
        return res.json({
            success: true,
            data: escrow,
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching escrow:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch escrow',
        });
    }
};
exports.getEscrow = getEscrow;
// ─────────────────────────────────────────────────────────────────────────────
// List Escrows for User
// ─────────────────────────────────────────────────────────────────────────────
const listEscrows = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const { user: targetUserId } = req.params;
        const { status, page = '1', limit = '20' } = req.query;
        // Users can only list their own escrows (admin can list any)
        const requestingUser = await database_1.prisma.user.findUnique({
            where: { id: userId },
        });
        if (targetUserId !== userId && requestingUser?.role !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to list these escrows',
            });
        }
        const pageNum = Math.max(1, parseInt(page, 10));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
        const skip = (pageNum - 1) * limitNum;
        const whereClause = {
            OR: [{ buyerId: targetUserId }, { sellerId: targetUserId }],
        };
        if (status) {
            whereClause.status = status;
        }
        const [escrows, total] = await Promise.all([
            database_1.prisma.solanaEscrow.findMany({
                where: whereClause,
                skip,
                take: limitNum,
                orderBy: { createdAt: 'desc' },
                include: {
                    buyer: {
                        select: { id: true, firstName: true, lastName: true },
                    },
                    seller: {
                        select: { id: true, firstName: true, lastName: true },
                    },
                    business: {
                        select: { id: true, name: true },
                    },
                },
            }),
            database_1.prisma.solanaEscrow.count({ where: whereClause }),
        ]);
        return res.json({
            success: true,
            data: {
                escrows,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    totalPages: Math.ceil(total / limitNum),
                },
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Error listing escrows:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to list escrows',
        });
    }
};
exports.listEscrows = listEscrows;
//# sourceMappingURL=solanaEscrow.controller.js.map