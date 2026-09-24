"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const nightlifeTokenomics_service_1 = require("../services/nightlifeTokenomics.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// ═══════════════════════════════════════════════════════════════════════════
// NIGHTLIFE TOKENOMICS ROUTES
// ═══════════════════════════════════════════════════════════════════════════
// Reward guest attendance
router.post('/reward-attendance', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { guestListId } = req.body;
        const result = await nightlifeTokenomics_service_1.nightlifeTokenomicsService.rewardGuestAttendance(guestListId);
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to reward attendance' });
    }
});
// Reward guest review
router.post('/reward-review', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { reviewId, isFirstReview } = req.body;
        const result = await nightlifeTokenomics_service_1.nightlifeTokenomicsService.rewardGuestReview(userId, reviewId, isFirstReview);
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to reward review' });
    }
});
// Reward referral
router.post('/reward-referral', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { referredUserId } = req.body;
        const result = await nightlifeTokenomics_service_1.nightlifeTokenomicsService.rewardGuestReferral(userId, referredUserId);
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to reward referral' });
    }
});
// Reward bottle purchase
router.post('/reward-bottle', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { amount, bottleReservationId } = req.body;
        const result = await nightlifeTokenomics_service_1.nightlifeTokenomicsService.rewardBottlePurchase(userId, amount, bottleReservationId);
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to reward bottle purchase' });
    }
});
// Stake promoter tier
router.post('/stake-promoter', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { tier } = req.body;
        const result = await nightlifeTokenomics_service_1.nightlifeTokenomicsService.stakePromoterTier(userId, tier);
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'Failed to stake tier' });
    }
});
// Unstake promoter tier
router.post('/unstake-promoter', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const result = await nightlifeTokenomics_service_1.nightlifeTokenomicsService.unstakePromoterTier(userId);
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to unstake tier' });
    }
});
// Pay venue subscription
router.post('/pay-venue', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { venueId, amountUsd } = req.body;
        const result = await nightlifeTokenomics_service_1.nightlifeTokenomicsService.payVenueSubscription(venueId, amountUsd);
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to pay venue subscription' });
    }
});
// Deposit guest list spot
router.post('/deposit-guestlist', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { guestListId, amountPab } = req.body;
        const result = await nightlifeTokenomics_service_1.nightlifeTokenomicsService.depositGuestListSpot(userId, guestListId, amountPab);
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to deposit guest list spot' });
    }
});
// Return guest list deposit
router.post('/return-deposit', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { guestListId, showUp } = req.body;
        const result = await nightlifeTokenomics_service_1.nightlifeTokenomicsService.returnGuestListDeposit(userId, guestListId, showUp);
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to return deposit' });
    }
});
// Get tokenomics stats
router.get('/stats', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { period } = req.query;
        const stats = await nightlifeTokenomics_service_1.nightlifeTokenomicsService.getTokenomicsStats(period || 'week');
        res.json({ success: true, data: stats });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to get stats' });
    }
});
// Get user nightlife balance
router.get('/balance', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const balance = await nightlifeTokenomics_service_1.nightlifeTokenomicsService.getUserNightlifeBalance(userId);
        res.json({ success: true, data: balance });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to get balance' });
    }
});
exports.default = router;
//# sourceMappingURL=nightlifeTokenomics.routes.js.map