"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTrustScoreAttestation = void 0;
const database_1 = require("../utils/database");
const cryptoService_1 = require("../services/cryptoService");
const logger_1 = require("../utils/logger");
/**
 * Get a cryptographically signed attestation of a user's Trust Score.
 * This can be submitted to Solana smart contracts for on-chain verification.
 */
const getTrustScoreAttestation = async (req, res) => {
    try {
        const { walletAddress } = req.params;
        if (!walletAddress) {
            return res.status(400).json({ error: 'walletAddress parameter is required' });
        }
        // Lookup user by wallet address
        const user = await database_1.prisma.user.findUnique({
            where: { walletAddress },
            select: {
                id: true,
                trustScore: true,
            }
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found for this wallet address' });
        }
        // Construct the payload: walletAddress:trustScore:timestamp
        const trustScore = user.trustScore || 0;
        const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
        const messageString = `${walletAddress}:${trustScore}:${timestamp}`;
        const dataBuffer = new TextEncoder().encode(messageString);
        // Sign using the Oracle's Private Key
        const { signature, pubkey } = cryptoService_1.cryptoService.signAttestationData(dataBuffer);
        res.json({
            success: true,
            data: {
                walletAddress,
                trustScore,
                timestamp,
                signature,
                oraclePubkey: pubkey,
                rawMessage: messageString,
            }
        });
    }
    catch (error) {
        logger_1.logger.error(`[Oracle Controller] Error generating trust attestation: ${error.message}`);
        res.status(500).json({ error: 'Internal server error generating trust attestation' });
    }
};
exports.getTrustScoreAttestation = getTrustScoreAttestation;
//# sourceMappingURL=oracle.controller.js.map