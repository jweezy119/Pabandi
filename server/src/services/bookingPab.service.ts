import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

const DEPOSIT_RATE = 0.10; // 10% deposit
const REWARD_RATE = 0.01; // 1% reward on check-in

function getConnection(): Connection {
  const url = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  return new Connection(url, 'confirmed');
}

function getPlatformKeypair(): Keypair | null {
  const privateKey = process.env.PLATFORM_PRIVATE_KEY;
  if (!privateKey) {
    logger.error('PLATFORM_PRIVATE_KEY not set');
    return null;
  }
  try {
    const secretKey = bs58.decode(privateKey);
    return Keypair.fromSecretKey(secretKey);
  } catch (err: any) {
    logger.error('Invalid PLATFORM_PRIVATE_KEY:', err.message);
    return null;
  }
}

function getPabMint(): string {
  return process.env.PAB_MINT_ADDRESS || 'G811FHWiZrqY1DZKz6dQySpJFPTDfe21B8LRnDqa1z5Y';
}

export async function createBookingWithPab(params: {
  bookingId: string;
  userId: string;
  bookingValue: number;
  businessId?: string;
}): Promise<any> {
  const { bookingId, userId, bookingValue, businessId } = params;

  const depositAmount = bookingValue * DEPOSIT_RATE;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { success: false, error: 'User not found' };

  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet || wallet.balance < depositAmount) {
    return { success: false, error: `Insufficient PAB balance. Need ${depositAmount} PAB` };
  }

  const connection = getConnection();
  const platformKey = getPlatformKeypair();
  if (!platformKey) return { success: false, error: 'Platform wallet not configured' };

  const mintKey = new PublicKey(getPabMint());
  const fromKey = new PublicKey(wallet.address || '');
  const toKey = platformKey.publicKey;

  const fromTokenAccount = await getAssociatedTokenAddress(mintKey, fromKey);
  const toTokenAccount = await getAssociatedTokenAddress(mintKey, toKey);

  const { Transaction } = await import('@solana/web3.js');
  const transaction = new Transaction();

  const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
  if (!toAccountInfo) {
    transaction.add(createAssociatedTokenAccountInstruction(fromKey, toTokenAccount, toKey, mintKey));
  }

  const amountRaw = Math.round(depositAmount * Math.pow(10, 9));
  transaction.add(
    createTransferInstruction(fromTokenAccount, toTokenAccount, fromKey, amountRaw, [], TOKEN_PROGRAM_ID)
  );

  const { blockhash } = await connection.getRecentBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = fromKey;

  const bookingPab = await prisma.bookingRecord.create({
    data: {
      bookingId,
      userId,
      bookingValue,
      depositPab: depositAmount,
      status: 'PENDING',
      businessId,
    },
  });

  // Deduct deposit from wallet
  await prisma.wallet.update({
    where: { userId },
    data: { balance: { decrement: depositAmount } },
  });

  logger.info(`[BookingPab] Created booking ${bookingId} with ${depositAmount} PAB deposit`);

  return {
    success: true,
    bookingPab,
    depositAmount,
    rewardAmount: bookingValue * REWARD_RATE,
  };
}

export async function checkinBooking(bookingId: string): Promise<any> {
  const bookingPab = await prisma.bookingRecord.findUnique({
    where: { bookingId },
    include: { user: true, business: true },
  });

  if (!bookingPab) return { success: false, error: 'Booking PAB record not found' };
  if (bookingPab.status !== 'PENDING') {
    return { success: false, error: `Cannot check in: status is ${bookingPab.status}` };
  }

  const rewardAmount = bookingPab.bookingValue * REWARD_RATE;
  const totalReturn = bookingPab.depositPab + rewardAmount;

  const connection = getConnection();
  const platformKey = getPlatformKeypair();
  if (!platformKey) return { success: false, error: 'Platform wallet not configured' };

  const wallet = await prisma.wallet.findUnique({ where: { userId: bookingPab.userId } });
  const mintKey = new PublicKey(getPabMint());
  const fromKey = platformKey.publicKey;
  const toKey = new PublicKey(wallet?.address || bookingPab.user.walletAddress || '');

  const fromTokenAccount = await getAssociatedTokenAddress(mintKey, fromKey);
  const toTokenAccount = await getAssociatedTokenAddress(mintKey, toKey);

  const { Transaction } = await import('@solana/web3.js');
  const transaction = new Transaction();

  const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
  if (!toAccountInfo) {
    transaction.add(createAssociatedTokenAccountInstruction(fromKey, toTokenAccount, toKey, mintKey));
  }

  const amountRaw = Math.round(totalReturn * Math.pow(10, 9));
  transaction.add(
    createTransferInstruction(fromTokenAccount, toTokenAccount, fromKey, amountRaw, [], TOKEN_PROGRAM_ID)
  );

  const { blockhash } = await connection.getRecentBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = fromKey;
  transaction.sign(platformKey);

  // Update booking record
  await prisma.bookingRecord.update({
    where: { bookingId },
    data: {
      status: 'CHECKED_IN',
      rewardPab: rewardAmount,
      checkinAt: new Date(),
    },
  });

  // Return deposit + reward to user
  await prisma.wallet.update({
    where: { userId: bookingPab.userId },
    data: { balance: { increment: totalReturn } },
  });

  await prisma.user.update({
    where: { id: bookingPab.userId },
    data: { pabEarned: { increment: rewardAmount } },
  });

  logger.info(`[BookingPab] Check-in for booking ${bookingId}, returned ${totalReturn} PAB (deposit + reward)`);

  return {
    success: true,
    depositReturned: bookingPab.depositPab,
    rewardAmount: rewardAmount,
    totalReturned: totalReturn,
  };
}

export async function handleNoShow(bookingId: string): Promise<any> {
  const bookingPab = await prisma.bookingRecord.findUnique({
    where: { bookingId },
    include: { business: true },
  });

  if (!bookingPab) return { success: false, error: 'Booking PAB record not found' };
  if (bookingPab.status !== 'PENDING') {
    return { success: false, error: `Cannot process no-show: status is ${bookingPab.status}` };
  }

  // 50% to business, 50% burned
  const toBusiness = bookingPab.depositPab * 0.5;
  const burned = bookingPab.depositPab * 0.5;

  await prisma.bookingRecord.update({
    where: { bookingId },
    data: { status: 'NO_SHOW' },
  });

  // If business exists, credit them
  if (bookingPab.businessId && bookingPab.business) {
    const businessOwnerWallet = await prisma.wallet.findUnique({
      where: { userId: bookingPab.business.ownerId || '' },
    });
    if (businessOwnerWallet) {
      await prisma.wallet.update({
        where: { userId: bookingPab.business.ownerId || '' },
        data: { balance: { increment: toBusiness } },
      });
    }
  }

  // Burn is implicit (sent to platform, not returned)
  logger.info(`[BookingPab] No-show for booking ${bookingId}: ${toBusiness} to business, ${burned} burned`);

  return {
    success: true,
    toBusiness,
    burned,
  };
}

export async function cancelBooking(bookingId: string): Promise<any> {
  const bookingPab = await prisma.bookingRecord.findUnique({
    where: { bookingId },
  });

  if (!bookingPab) return { success: false, error: 'Booking PAB record not found' };
  if (bookingPab.status !== 'PENDING') {
    return { success: false, error: `Cannot cancel: status is ${bookingPab.status}` };
  }

  // Full refund
  await prisma.bookingRecord.update({
    where: { bookingId },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
  });

  await prisma.wallet.update({
    where: { userId: bookingPab.userId },
    data: { balance: { increment: bookingPab.depositPab } },
  });

  logger.info(`[BookingPab] Cancelled booking ${bookingId}, refunded ${bookingPab.depositPab} PAB`);

  return {
    success: true,
    refunded: bookingPab.depositPab,
  };
}

export const bookingPabService = {
  createBookingWithPab,
  checkinBooking,
  handleNoShow,
  cancelBooking,
  DEPOSIT_RATE,
  REWARD_RATE,
};
