"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentService = exports.AgentService = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
class AgentService {
    constructor() {
        this.pythonAgentUrl = process.env.PYTHON_AGENT_URL || 'http://localhost:8000';
    }
    /**
     * Spawns an autonomous AI economic actor via the Python microservice.
     * @param userPhone The user's phone number
     * @param targetPhone The freelancer/business phone number to negotiate with
     * @param budget The budget in USDC
     * @param goal The negotiation goal
     * @param trustScore The user's Trust Score (determines their leverage)
     */
    async spawnAgent(userPhone, targetPhone, budget, goal, trustScore) {
        try {
            logger_1.logger.info(`[Agent Service] Spawning autonomous agent for ${userPhone} targeting ${targetPhone}`);
            const response = await axios_1.default.post(`${this.pythonAgentUrl}/api/spawn`, {
                userPhone,
                targetPhone,
                budget,
                goal,
                trustScore
            });
            return response.data;
        }
        catch (e) {
            logger_1.logger.error(`[Agent Service] Failed to spawn agent: ${e.message}`);
            throw new Error('Failed to spawn autonomous agent');
        }
    }
}
exports.AgentService = AgentService;
exports.agentService = new AgentService();
//# sourceMappingURL=agent.service.js.map