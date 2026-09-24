"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAgentProfile = exports.getOpenProjects = exports.getLeaderboard = exports.getMarketplaceStats = exports.returnToBidding = exports.completeProject = exports.acceptBid = exports.placeBid = exports.postProject = exports.registerAgent = void 0;
const database_1 = require("../utils/database");
const agentMarketplace_service_1 = require("../services/agentMarketplace.service");
const registerAgent = async (req, res, next) => {
    try {
        const agent = await agentMarketplace_service_1.agentMarketplace.registerAgent(req.body);
        res.json({ success: true, agent });
    }
    catch (err) {
        next(err);
    }
};
exports.registerAgent = registerAgent;
const postProject = async (req, res, next) => {
    try {
        const project = await agentMarketplace_service_1.agentMarketplace.postProject({
            ...req.body,
            posterId: req.user?.id || req.body.posterId,
            deadline: new Date(req.body.deadline),
        });
        res.json({ success: true, project });
    }
    catch (err) {
        next(err);
    }
};
exports.postProject = postProject;
const placeBid = async (req, res, next) => {
    try {
        const bid = await agentMarketplace_service_1.agentMarketplace.placeBid({
            ...req.body,
            bidderId: req.user?.id || req.body.bidderId,
        });
        res.json({ success: true, bid });
    }
    catch (err) {
        next(err);
    }
};
exports.placeBid = placeBid;
const acceptBid = async (req, res, next) => {
    try {
        const result = await agentMarketplace_service_1.agentMarketplace.acceptBid(req.params.bidId);
        res.json({ success: true, data: result });
    }
    catch (err) {
        next(err);
    }
};
exports.acceptBid = acceptBid;
const completeProject = async (req, res, next) => {
    try {
        const result = await agentMarketplace_service_1.agentMarketplace.completeProject(req.params.projectId, req.body.solverId);
        res.json({ success: true, data: result });
    }
    catch (err) {
        next(err);
    }
};
exports.completeProject = completeProject;
const returnToBidding = async (req, res, next) => {
    try {
        const result = await agentMarketplace_service_1.agentMarketplace.returnToBidding(req.params.projectId, req.body.reason);
        res.json({ success: true, data: result });
    }
    catch (err) {
        next(err);
    }
};
exports.returnToBidding = returnToBidding;
const getMarketplaceStats = async (req, res, next) => {
    try {
        const stats = await agentMarketplace_service_1.agentMarketplace.getStats();
        res.json({ success: true, stats });
    }
    catch (err) {
        next(err);
    }
};
exports.getMarketplaceStats = getMarketplaceStats;
const getLeaderboard = async (req, res, next) => {
    try {
        const leaderboard = await agentMarketplace_service_1.agentMarketplace.getLeaderboard();
        res.json({ success: true, leaderboard });
    }
    catch (err) {
        next(err);
    }
};
exports.getLeaderboard = getLeaderboard;
const getOpenProjects = async (req, res, next) => {
    try {
        const projects = await database_1.prisma.agentProject.findMany({
            where: { status: 'OPEN' },
            include: { poster: true, bids: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ success: true, projects });
    }
    catch (err) {
        next(err);
    }
};
exports.getOpenProjects = getOpenProjects;
const getAgentProfile = async (req, res, next) => {
    try {
        const agent = await database_1.prisma.agentProfile.findUnique({
            where: { slug: req.params.slug },
            include: {
                postedProjects: true,
                bids: true,
            },
        });
        res.json({ success: true, agent });
    }
    catch (err) {
        next(err);
    }
};
exports.getAgentProfile = getAgentProfile;
//# sourceMappingURL=agentMarketplace.controller.js.map