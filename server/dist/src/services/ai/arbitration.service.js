"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: Object.getOwnPropertyDescriptor(all, name).get
    });
}
_export(exports, {
    get ArbitrationService () {
        return ArbitrationService;
    },
    get arbitrationService () {
        return arbitrationService;
    }
});
const _logger = require("../../utils/logger");
const _database = require("../../utils/database");
const _dashscopeservice = require("./dashscope.service");
const _accounts = require("viem/accounts");
const _chains = require("viem/chains");
let ArbitrationService = class ArbitrationService {
    /**
   * Resolves a dispute using Qwen AI, then generates a cryptographic EIP-712 signature 
   * so the decision can be executed on the blockchain without the backend paying gas.
   */ async arbitrateDispute(disputeId) {
        _logger.logger.info(`[Arbitration] Starting AI arbitration for dispute ${disputeId}`);
        // 1. Fetch dispute & relations
        const dispute = await _database.prisma.dispute.findUnique({
            where: {
                id: disputeId
            },
            include: {
                user: true,
                reporter: true
            }
        });
        if (!dispute) throw new Error('Dispute not found');
        if (dispute.outcome !== 'PENDING') throw new Error('Dispute is already resolved');
        if (!dispute.reservationId) throw new Error('Dispute is missing reservationId');
        // 2. Prepare the prompt for DashScope AI
        const systemPrompt = `You are an impartial AI Arbitration Oracle for Pabandi, a Web3 booking ecosystem. 
Your job is to resolve a dispute between a Customer and a Business over a smart contract escrow deposit.
You must evaluate the dispute fairly based on the provided context.
You must output ONLY valid JSON without Markdown formatting in the following exact format:
{
  "decision": "CUSTOMER" | "BUSINESS",
  "reasoning": "A brief explanation of your ruling."
}`;
        const userPrompt = `
Dispute Context:
- Description: ${dispute.description || 'No description provided'}
- Customer ID: ${dispute.userId || 'Unknown'} (Reliability Score: ${dispute.user?.reliabilityScore || 'N/A'}, Trust Score: ${dispute.user?.trustScore || 'N/A'})
- Business ID: ${dispute.reportedById || 'Unknown'} (Trust Score: ${dispute.reporter?.trustScore || 'N/A'})
- Reservation ID: ${dispute.reservationId}

Who should receive the escrowed funds? Output ONLY the JSON object.
`;
        let aiDecision = 'CUSTOMER';
        let aiReasoning = 'Fallback resolution favored customer due to AI downtime.';
        // 3. Invoke DashScope AI
        try {
            const aiResponse = await _dashscopeservice.dashscopeService.generateText(systemPrompt, userPrompt);
            // Clean up markdown block if the AI ignored instructions
            const jsonStr = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(jsonStr);
            if (parsed.decision === 'CUSTOMER' || parsed.decision === 'BUSINESS') {
                aiDecision = parsed.decision;
                aiReasoning = parsed.reasoning || 'AI resolved the dispute.';
            } else {
                _logger.logger.warn(`[Arbitration] AI returned invalid decision enum: ${parsed.decision}`);
            }
        } catch (e) {
            _logger.logger.error(`[Arbitration] AI request failed: ${e.message}. Using fallback.`);
        }
        const releaseToBusiness = aiDecision === 'BUSINESS';
        // 4. Generate EIP-712 Signature
        _logger.logger.info(`[Arbitration] AI decided in favor of ${aiDecision}. Generating signature...`);
        // In production, you would fetch this from a secure KMS.
        const oracleKey = process.env.ORACLE_PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000001';
        const account = (0, _accounts.privateKeyToAccount)(oracleKey);
        const domain = {
            name: 'PabandiEscrow',
            version: '1',
            chainId: _chains.bscTestnet.id,
            verifyingContract: process.env.ESCROW_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000'
        };
        const types = {
            ArbitrationResolution: [
                {
                    name: 'reservationId',
                    type: 'string'
                },
                {
                    name: 'releaseToBusiness',
                    type: 'bool'
                }
            ]
        };
        const signature = await account.signTypedData({
            domain,
            types,
            primaryType: 'ArbitrationResolution',
            message: {
                reservationId: dispute.reservationId,
                releaseToBusiness
            }
        });
        // 5. Update Database
        const updatedDispute = await _database.prisma.dispute.update({
            where: {
                id: disputeId
            },
            data: {
                aiDecision,
                aiReasoning,
                aiSignature: signature,
                outcome: releaseToBusiness ? 'UPHELD' : 'DISMISSED',
                resolvedAt: new Date()
            }
        });
        _logger.logger.info(`[Arbitration] Dispute ${disputeId} fully arbitrated. Signature saved.`);
        return updatedDispute;
    }
};
const arbitrationService = new ArbitrationService();

//# sourceMappingURL=arbitration.service.js.map