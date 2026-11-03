import { ethers } from 'ethers';
import crypto from 'crypto';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

// ERC-8004 Identity Registry ABI (standard interface)
const IDENTITY_REGISTRY_ABI = [
  "function register(string memory agentURI) external returns (uint256 agentId)",
  "function getAgent(uint256 agentId) external view returns (string memory agentURI, address owner)",
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
];

const REPUTATION_REGISTRY_ABI = [
  "function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string memory tag1, string memory tag2, string memory endpoint, string memory feedbackURI, bytes32 feedbackHash) external",
  "function getSummary(uint256 agentId, address[] calldata clientAddresses, string memory tag1, string memory tag2) external view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)",
];

export class AgentIdentityService {
  private provider: ethers.Provider | null = null;
  private signer: ethers.Wallet | null = null;
  private identityRegistry: ethers.Contract | null = null;
  private reputationRegistry: ethers.Contract | null = null;

  constructor() {
    this.initialize();
  }

  private initialize() {
    try {
      const rpcUrl = process.env.ETH_RPC_URL || process.env.BASE_RPC_URL;
      const privateKey = process.env.PABANDI_RELAYER_PRIVATE_KEY;
      const identityRegistryAddress = process.env.ERC8004_IDENTITY_REGISTRY;
      const reputationRegistryAddress = process.env.ERC8004_REPUTATION_REGISTRY;

      if (rpcUrl && privateKey) {
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.signer = new ethers.Wallet(privateKey, this.provider);

        if (identityRegistryAddress) {
          this.identityRegistry = new ethers.Contract(identityRegistryAddress, IDENTITY_REGISTRY_ABI, this.signer);
        }
        if (reputationRegistryAddress) {
          this.reputationRegistry = new ethers.Contract(reputationRegistryAddress, REPUTATION_REGISTRY_ABI, this.signer);
        }
      }
    } catch (error) {
      logger.error('[AgentIdentity] Initialization error:', error);
    }
  }

  async registerAgentOnChain(passportId: string, walletAddress?: string): Promise<{ agentId: string; txHash: string } | null> {
    try {
      const passport = await prisma.trustPassport.findUnique({
        where: { id: passportId },
      });

      if (!passport) {
        throw new Error('Passport not found');
      }

      if (passport.onchainIdentityRegistered && passport.onchainAgentId) {
        return { agentId: passport.onchainAgentId, txHash: 'existing' };
      }

      if (!this.identityRegistry || !this.signer) {
        logger.warn('[AgentIdentity] Registry not configured, skipping onchain registration');
        return null;
      }

      // Create agent URI with metadata
      const agentURI = JSON.stringify({
        name: passport.displayName,
        description: passport.bio || `AI Agent on Pabandi - ${passport.handle}`,
        image: passport.avatarUrl,
        skills: passport.skills,
        handle: passport.handle,
        category: passport.category,
      });

      // Register onchain (gasless for agent - Pabandi pays)
      const tx = await this.identityRegistry.register(agentURI);
      const receipt = await tx.wait();

      // Extract agentId from event
      let agentId = '';
      for (const log of receipt.logs) {
        try {
          const parsed = this.identityRegistry.interface.parseLog(log);
          if (parsed?.name === 'Registered') {
            agentId = parsed.args.agentId.toString();
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!agentId) {
        // Fallback: try to get from transaction
        agentId = receipt.logs[0]?.topics[1] ? BigInt(receipt.logs[0].topics[1]).toString() : '';
      }

      // Update passport
      await prisma.trustPassport.update({
        where: { id: passportId },
        data: {
          onchainAgentId: agentId,
          onchainIdentityRegistered: true,
        },
      });

      logger.info(`[AgentIdentity] Registered agent ${passport.handle} onchain with ID ${agentId}`);
      
      return { agentId, txHash: receipt.hash };
    } catch (error) {
      logger.error('[AgentIdentity] Registration error:', error);
      return null;
    }
  }

  async syncReputation(passportId: string): Promise<boolean> {
    try {
      const passport = await prisma.trustPassport.findUnique({
        where: { id: passportId },
      });

      if (!passport || !passport.onchainAgentId || !passport.onchainIdentityRegistered) {
        return false;
      }

      if (!this.reputationRegistry || !this.signer) {
        logger.warn('[AgentIdentity] Reputation registry not configured');
        return false;
      }

      // Calculate reputation summary
      const completedTasks = (passport as any).claimsCount || 0;
      const score = passport.score || 500;
      const successRate = score >= 700 ? 98 : score >= 500 ? 90 : 80;
      
      const feedbackSummary = `Completed ${completedTasks} tasks with a ${successRate}% success rate. Pabandi Trust Score: ${Math.round(score)}`;

      // Post feedback (gasless for agent - Pabandi pays)
      const value = Math.round((score / 1000) * 100);
      const tx = await this.reputationRegistry.giveFeedback(
        passport.onchainAgentId,
        value,
        0,
        'performance',
        'pabandi',
        'https://pabandi.com',
        `ipfs://Qm${crypto.randomBytes(22).toString('hex')}`,
        ethers.ZeroHash
      );

      await tx.wait();
      logger.info(`[AgentIdentity] Synced reputation for ${passport.handle}`);
      return true;
    } catch (error) {
      logger.error('[AgentIdentity] Reputation sync error:', error);
      return false;
    }
  }
}

export const agentIdentityService = new AgentIdentityService();
