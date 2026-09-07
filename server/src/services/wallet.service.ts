import { PrismaClient } from '@prisma/client';
import { Keypair, PublicKey } from '@solana/web3.js';
import crypto from 'crypto';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;

function getEncKey(): Buffer {
  const key = process.env.WALLET_ENC_KEY;
  if (!key) {
    return crypto.scryptSync(process.env.JWT_SECRET || 'fallback', 'salt', 32);
  }
  return Buffer.from(key, 'hex');
}

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
}

function decrypt(text: string): string {
  const parts = text.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncKey(), iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export const walletService = {
  async createWallet(userId: string) {
    try {
      const existing = await prisma.wallet.findUnique({ where: { userId } });
      if (existing) return { success: true, wallet: existing, created: false };

      const keypair = Keypair.generate();
      const publicKey = keypair.publicKey.toBase58();
      const secretKey = Buffer.from(keypair.secretKey).toString('base64');
      const encryptedSecret = encrypt(secretKey);

      const wallet = await prisma.wallet.create({
        data: {
          userId,
          address: publicKey,
          encryptedSecret,
          balance: 0,
          currency: 'PAB',
        },
      });

      return { 
        success: true, 
        wallet: { id: wallet.id, address: wallet.address, balance: wallet.balance, currency: wallet.currency, createdAt: wallet.createdAt },
        created: true,
      };
    } catch (error: any) {
      logger.error(`Failed to create wallet: ${error.message}`);
      return { success: false, message: 'Failed to create wallet' };
    }
  },

  async getWallet(userId: string) {
    try {
      const wallet = await prisma.wallet.findUnique({
        where: { userId },
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      });
      if (!wallet) return { success: false, message: 'Wallet not found' };
      return { success: true, wallet };
    } catch (error: any) {
      logger.error(`Failed to get wallet: ${error.message}`);
      return { success: false, message: 'Failed to get wallet' };
    }
  },

  async updateBalance(userId: string, amount: number, currency: string = 'PAB') {
    try {
      const wallet = await prisma.wallet.findUnique({ where: { userId } });
      if (!wallet) return { success: false, message: 'Wallet not found' };

      const updateData: any = {};
      if (currency === 'PAB') updateData.balance = wallet.balance + amount;
      else if (currency === 'USDC') updateData.usdcBalance = wallet.usdcBalance + amount;

      const updated = await prisma.wallet.update({ where: { userId }, data: updateData });
      return { success: true, wallet: updated };
    } catch (error: any) {
      logger.error(`Failed to update balance: ${error.message}`);
      return { success: false, message: 'Failed to update balance' };
    }
  },

  async claimAirdrop(userId: string) {
    try {
      const wallet = await prisma.wallet.findUnique({ where: { userId } });
      if (!wallet) return { success: false, message: 'Wallet not found' };
      if (wallet.airdropClaimed) return { success: false, message: 'Airdrop already claimed' };

      const airdropAmount = parseFloat(process.env.BOOTSTRAP_PAB_AMOUNT || '100');
      const updated = await prisma.wallet.update({
        where: { userId },
        data: { airdropClaimed: true, airdropAmount, airdropClaimedAt: new Date(), balance: wallet.balance + airdropAmount },
      });
      return { success: true, message: `Claimed ${airdropAmount} $PAB!`, amount: airdropAmount };
    } catch (error: any) {
      logger.error(`Failed to claim airdrop: ${error.message}`);
      return { success: false, message: 'Failed to claim airdrop' };
    }
  },
};
