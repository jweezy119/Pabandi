"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getApiKeys = exports.generateApiKey = void 0;
const database_1 = require("../utils/database");
const crypto_1 = __importDefault(require("crypto"));
const generateApiKey = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        const user = await database_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const { name, billingMode, preferredCurrency } = req.body;
        // Generate a secure API Key
        const apiKeyStr = `pab_${crypto_1.default.randomBytes(24).toString('hex')}`;
        const apiClient = await database_1.prisma.apiClient.create({
            data: {
                name: name || 'Default Application',
                email: user.email,
                apiKey: apiKeyStr,
                tier: 'STARTER',
                callsLimit: billingMode === 'PAY_AS_YOU_GO' ? 0 : 500, // 0 means unlimited
                billingMode: billingMode || 'PAY_AS_YOU_GO',
                preferredCurrency: preferredCurrency || 'PAB'
            }
        });
        res.status(201).json({
            message: 'API Key generated successfully',
            apiClient
        });
    }
    catch (error) {
        console.error('Error generating API Key:', error);
        res.status(500).json({ message: 'Error generating API Key', error: error.message });
    }
};
exports.generateApiKey = generateApiKey;
const getApiKeys = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        const user = await database_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const apiClients = await database_1.prisma.apiClient.findMany({
            where: { email: user.email }
        });
        res.json(apiClients);
    }
    catch (error) {
        console.error('Error fetching API Keys:', error);
        res.status(500).json({ message: 'Error fetching API Keys', error: error.message });
    }
};
exports.getApiKeys = getApiKeys;
//# sourceMappingURL=apiKey.controller.js.map