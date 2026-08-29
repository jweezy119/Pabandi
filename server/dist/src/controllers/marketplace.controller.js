"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimReward = exports.createAndExecuteCampaign = exports.getAudiencePreview = void 0;
const zk_marketplace_service_1 = require("../services/zk-marketplace.service");
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
/**
 * POST /api/v1/marketplace/audience
 * Brand submits criteria → gets back ONLY a count and a Merkle Root hash.
 * They learn nothing about who is in the set.
 */
const getAudiencePreview = async (req, res) => {
    try {
        const { criteria } = req.body;
        if (!criteria) {
            return res.status(400).json({ error: 'Criteria is required' });
        }
        const preview = await zk_marketplace_service_1.zkMarketplaceService.getAudiencePreview(criteria);
        res.json({
            success: true,
            audienceSize: preview.audienceSize,
            merkleRoot: preview.merkleRoot
        });
    }
    catch (error) {
        logger_1.logger.error(`[Marketplace] Error getting audience: ${error.message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getAudiencePreview = getAudiencePreview;
/**
 * POST /api/v1/marketplace/campaign
 * Brand funds a campaign → we build the Merkle Tree and notify users with their proofs.
 */
const createAndExecuteCampaign = async (req, res) => {
    try {
        const { brandName, criteria, rewardPerUser } = req.body;
        if (!brandName || !criteria || !rewardPerUser) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const campaign = await database_1.prisma.dataCampaign.create({
            data: {
                brandName,
                criteria,
                rewardPerUser: Number(rewardPerUser),
                status: 'PENDING'
            }
        });
        // Execute asynchronously so we don't block the HTTP response
        zk_marketplace_service_1.zkMarketplaceService.executeCampaign(campaign.id).catch(e => {
            logger_1.logger.error(`[Marketplace] Async campaign execution failed: ${e.message}`);
        });
        res.json({
            success: true,
            message: 'Campaign created. Users are being notified with their Merkle Proofs.',
            campaignId: campaign.id
        });
    }
    catch (error) {
        logger_1.logger.error(`[Marketplace] Error creating campaign: ${error.message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createAndExecuteCampaign = createAndExecuteCampaign;
/**
 * POST /api/v1/marketplace/claim
 * User submits walletAddress + Merkle Proof → verified against the root → paid.
 * No database lookup. Pure cryptographic verification.
 */
const claimReward = async (req, res) => {
    try {
        const { campaignId, walletAddress, proof } = req.body;
        if (!campaignId || !walletAddress || !proof) {
            return res.status(400).json({ error: 'Missing campaignId, walletAddress, or proof' });
        }
        const result = await zk_marketplace_service_1.zkMarketplaceService.claimReward(campaignId, walletAddress, proof);
        if (result.success) {
            res.json({ success: true, message: 'Reward claimed successfully' });
        }
        else {
            res.status(403).json({ success: false, reason: result.reason });
        }
    }
    catch (error) {
        logger_1.logger.error(`[Marketplace] Claim error: ${error.message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.claimReward = claimReward;
//# sourceMappingURL=marketplace.controller.js.map