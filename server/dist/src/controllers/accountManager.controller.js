"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountManagerController = void 0;
const client_1 = require("@prisma/client");
const crypto_1 = __importDefault(require("crypto"));
const prisma = new client_1.PrismaClient();
function generateRefCode() {
    return crypto_1.default.randomBytes(4).toString('hex').toUpperCase(); // 8 characters
}
exports.accountManagerController = {
    // Admin Endpoints
    async createPartner(req, res) {
        try {
            const { userId } = req.body;
            if (!userId) {
                return res.status(400).json({ error: 'userId is required' });
            }
            const existingProfile = await prisma.accountManagerProfile.findUnique({
                where: { userId }
            });
            if (existingProfile) {
                return res.status(400).json({ error: 'User is already an Account Manager' });
            }
            const referralCode = generateRefCode();
            const profile = await prisma.accountManagerProfile.create({
                data: {
                    userId,
                    referralCode,
                    status: 'ACTIVE'
                }
            });
            res.status(201).json(profile);
        }
        catch (error) {
            console.error('Error creating partner:', error);
            res.status(500).json({ error: 'Failed to create partner' });
        }
    },
    async updateConfig(req, res) {
        try {
            const { active, signupBountyAmount, globalMonthlyCap, merchantMonthlyCap, rateYear1, rateYear2, rateYear3Plus } = req.body;
            let config = await prisma.partnerProgramConfig.findFirst();
            if (!config) {
                config = await prisma.partnerProgramConfig.create({ data: {} });
            }
            const updated = await prisma.partnerProgramConfig.update({
                where: { id: config.id },
                data: {
                    ...(active !== undefined && { active }),
                    ...(signupBountyAmount !== undefined && { signupBountyAmount }),
                    ...(globalMonthlyCap !== undefined && { globalMonthlyCap }),
                    ...(merchantMonthlyCap !== undefined && { merchantMonthlyCap }),
                    ...(rateYear1 !== undefined && { rateYear1 }),
                    ...(rateYear2 !== undefined && { rateYear2 }),
                    ...(rateYear3Plus !== undefined && { rateYear3Plus }),
                }
            });
            res.json(updated);
        }
        catch (error) {
            console.error('Error updating config:', error);
            res.status(500).json({ error: 'Failed to update config' });
        }
    },
    // Dashboard Endpoints
    async getMe(req, res) {
        try {
            const userId = req.user?.id; // Assuming auth middleware attaches user
            if (!userId)
                return res.status(401).json({ error: 'Unauthorized' });
            const profile = await prisma.accountManagerProfile.findUnique({
                where: { userId }
            });
            if (!profile)
                return res.status(404).json({ error: 'Account Manager profile not found' });
            res.json(profile);
        }
        catch (error) {
            res.status(500).json({ error: 'Internal server error' });
        }
    },
    async getReferrals(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId)
                return res.status(401).json({ error: 'Unauthorized' });
            const profile = await prisma.accountManagerProfile.findUnique({
                where: { userId }
            });
            if (!profile)
                return res.status(404).json({ error: 'Account Manager profile not found' });
            const businesses = await prisma.business.findMany({
                where: { referredById: profile.id },
                select: { id: true, name: true, createdAt: true, isVerified: true, bountyPaid: true }
            });
            // Also fetching users referred by this user
            const users = await prisma.user.findMany({
                where: { referredById: userId },
                select: { id: true, firstName: true, lastName: true, createdAt: true }
            });
            res.json({ businesses, users });
        }
        catch (error) {
            res.status(500).json({ error: 'Internal server error' });
        }
    },
    async getLedger(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId)
                return res.status(401).json({ error: 'Unauthorized' });
            const profile = await prisma.accountManagerProfile.findUnique({
                where: { userId }
            });
            if (!profile)
                return res.status(404).json({ error: 'Account Manager profile not found' });
            const ledgers = await prisma.referralLedger.findMany({
                where: { profileId: profile.id },
                orderBy: { createdAt: 'desc' }
            });
            res.json(ledgers);
        }
        catch (error) {
            res.status(500).json({ error: 'Internal server error' });
        }
    },
    async getPayouts(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId)
                return res.status(401).json({ error: 'Unauthorized' });
            const profile = await prisma.accountManagerProfile.findUnique({
                where: { userId }
            });
            if (!profile)
                return res.status(404).json({ error: 'Account Manager profile not found' });
            const payouts = await prisma.referralPayout.findMany({
                where: { profileId: profile.id },
                orderBy: { createdAt: 'desc' }
            });
            res.json(payouts);
        }
        catch (error) {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};
//# sourceMappingURL=accountManager.controller.js.map