"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
/**
 * POST /api/v1/escrow/checkout
 * Returns a payment/deposit link for a given property + time slot.
 */
router.post('/checkout', async (req, res, next) => {
    try {
        const { propertyId, startDate, endDate, amount, currency } = req.body;
        if (!propertyId || !amount) {
            res.status(400).json({ success: false, error: 'propertyId and amount are required' });
            return;
        }
        // Lookup business based on property
        const { hospitalityService } = await Promise.resolve().then(() => __importStar(require('../services/hospitalityService')));
        const property = await hospitalityService.getPropertyById(propertyId);
        if (!property) {
            res.status(404).json({ success: false, error: 'Property not found' });
            return;
        }
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1); // Escrow links expire quickly
        const session = await database_1.prisma.checkoutSession.create({
            data: {
                businessId: property.businessId,
                amount: parseFloat(amount),
                currency: currency || 'USD',
                escrowTerms: { propertyId, startDate, endDate },
                successUrl: `https://pabandi.com/booking/success`,
                cancelUrl: `https://pabandi.com/booking/cancel`,
                metadata: { source: 'ai_receptionist' },
                expiresAt,
                status: 'PENDING'
            }
        });
        const host = process.env.FRONTEND_URL || 'http://localhost:3000';
        const checkoutUrl = `${host}/checkout/${session.id}`;
        res.status(201).json({
            success: true,
            data: {
                sessionId: session.id,
                checkoutUrl
            }
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/v1/escrow/sign-init-tx
 * Oracle route for signing Solana DRPE Escrow initialization transactions.
 */
router.post('/sign-init-tx', async (req, res, _next) => {
    try {
        const { serializedTxBase64, customerWallet } = req.body;
        if (!serializedTxBase64 || !customerWallet) {
            res.status(400).json({ success: false, error: 'serializedTxBase64 and customerWallet are required' });
            return;
        }
        const { solanaEscrowService } = await Promise.resolve().then(() => __importStar(require('../services/solana_escrow.service')));
        const signedTxBase64 = await solanaEscrowService.signInitializeEscrowTx(serializedTxBase64, customerWallet);
        res.status(200).json({
            success: true,
            data: {
                signedTxBase64
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to sign Solana initialization transaction:', error);
        res.status(500).json({ success: false, error: 'Oracle failed to sign transaction' });
    }
});
/**
 * POST /api/v1/escrow/generate-fee-signature
 * Generates an ECDSA signature for the dynamic escrow fee (EVM).
 */
router.post('/generate-fee-signature', async (req, res, _next) => {
    try {
        const { reservationId } = req.body;
        if (!reservationId) {
            res.status(400).json({ success: false, error: 'reservationId is required' });
            return;
        }
        const reservation = await database_1.prisma.reservation.findUnique({
            where: { id: reservationId },
            include: { business: true }
        });
        if (!reservation) {
            res.status(404).json({ success: false, error: 'Reservation not found' });
            return;
        }
        // Business must have a wallet connected to claim
        const businessWallet = await database_1.prisma.wallet.findUnique({
            where: { userId: reservation.business.ownerId }
        });
        if (!businessWallet?.address) {
            res.status(400).json({ success: false, error: 'Business has no Web3 wallet connected' });
            return;
        }
        const { cryptoService } = await Promise.resolve().then(() => __importStar(require('../services/cryptoService')));
        const { feeBps, signature } = await cryptoService.generateDynamicFeeSignature(reservationId, businessWallet.address, reservation.business.trustScore);
        res.status(200).json({
            success: true,
            data: {
                feeBps,
                signature
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to generate fee signature:', error);
        res.status(500).json({ success: false, error: 'Failed to generate fee signature' });
    }
});
exports.default = router;
//# sourceMappingURL=escrow.routes.js.map