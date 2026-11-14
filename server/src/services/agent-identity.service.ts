import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  zeroHash,
  type PublicClient,
  type WalletClient,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import crypto from 'crypto';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

// ERC-8004 Identity Registry ABI (standard interface)
const IDENTITY_REGISTRY_ABI = parseAbi([
  'function register(string calldata agentURI) external returns (uint256 agentId)',
  'function getAgent(uint256 agentId) external view returns (string memory agentURI, address owner)',
  'event Registered(uint256 indexed agentId, string agentURI, address indexed owner)',
]);

const REPUTATION_REGISTRY_ABI = parseAbi([
  'function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string calldata tag1, string calldata tag2, string calldata endpoint, string calldata feedbackURI, bytes32 feedbackHash) external',
  'function getSummary(uint256 agentId, address[] calldata clientAddresses, string calldata tag1, string calldata tag2) external view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)',
]);

export class AgentIdentityService {
  private publicClient: PublicClient | null = null;
  private walletClient: any = null;
  private account: any = null;
  private identityRegistryAddress?: Address;
  private reputationRegistryAddress?: Address;

  constructor() {
    this.initialize();
  }

  private initialize() {
    try {
      const rpcUrl = process.env.ETH_RPC_URL || process.env.BASE_RPC_URL;
      const privateKey = process.env.PABANDI_RELAYER_PRIVATE_KEY;
      this.identityRegistryAddress = process.env.ERC8004_IDENTITY_REGISTRY as Address;
      this.reputationRegistryAddress = process.env.ERC8004_REPUTATION_REGISTRY as Address;

      if (rpcUrl && privateKey) {
        const formattedKey = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`;
        const account = privateKeyToAccount(formattedKey);
        this.account = account;

        this.publicClient = createPublicClient({
          transport: http(rpcUrl),
        });

        this.walletClient = createWalletClient({
          account,
          transport: http(rpcUrl),
        });
      }
    } catch (error) {
      logger.error('[AgentIdentity] Initialization error:', error);
    }
  }

  async registerAgentOnChain(passportId: string, _walletAddress?: string): Promise<{ agentId: string; txHash: string } | null> {
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

      if (!this.walletClient || !this.publicClient || !this.identityRegistryAddress) {
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

      // Register onchain via viem
      const hash = await this.walletClient.writeContract({
        chain: null,
        address: this.identityRegistryAddress,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'register',
        args: [agentURI],
      });

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      const agentId = receipt.logs[0]?.topics[1] ? BigInt(receipt.logs[0].topics[1] as string).toString() : '1';

      // Update passport
      await prisma.trustPassport.update({
        where: { id: passportId },
        data: {
          onchainAgentId: agentId,
          onchainIdentityRegistered: true,
        },
      });

      logger.info(`[AgentIdentity] Registered agent ${passport.handle} onchain with ID ${agentId}`);
      return { agentId, txHash: hash };
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

      if (!this.walletClient || !this.publicClient || !this.reputationRegistryAddress) {
        logger.warn('[AgentIdentity] Reputation registry not configured');
        return false;
      }

      const score = passport.score || 500;
      const value = BigInt(Math.round((score / 1000) * 100));

      const hash = await this.walletClient.writeContract({
        chain: null,
        address: this.reputationRegistryAddress,
        abi: REPUTATION_REGISTRY_ABI,
        functionName: 'giveFeedback',
        args: [
          BigInt(passport.onchainAgentId),
          value as any,
          0,
          'performance',
          'pabandi',
          'https://pabandi.com',
          `ipfs://Qm${crypto.randomBytes(22).toString('hex')}`,
          zeroHash,
        ],
      });

      await this.publicClient.waitForTransactionReceipt({ hash });
      logger.info(`[AgentIdentity] Synced reputation for ${passport.handle}`);
      return true;
    } catch (error) {
      logger.error('[AgentIdentity] Reputation sync error:', error);
      return false;
    }
  }
}

export const agentIdentityService = new AgentIdentityService();
