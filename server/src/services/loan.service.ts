import { PrismaClient, LoanStatus } from '@prisma/client';
import { logger } from '../utils/logger';
import { blockchainService } from './blockchain.service';

const prisma = new PrismaClient();

export class LoanService {
  // PAB to USDC conversion rate for collateral calculations (Simulated)
  private readonly PAB_USD_PRICE = 0.10; 

  /**
   * Calculate maximum borrowing power in USDC based on Trust Score and PAB balance.
   */
  async calculateBorrowingPower(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true }
    });

    if (!user || !user.wallet) {
      throw new Error('User or wallet not found');
    }

    const availablePab = user.wallet.balance;
    const usdValueOfPab = availablePab * this.PAB_USD_PRICE;
    let ltvRatio = 0; // Loan-to-Value

    // Halal / Sharia Compliant logic: Higher trust gets better LTV (more borrowing power per collateral)
    if (user.trustScore >= 90) {
      ltvRatio = 0.8; // 80% LTV
    } else if (user.trustScore >= 70) {
      ltvRatio = 0.6; // 60% LTV
    } else if (user.trustScore >= 50) {
      ltvRatio = 0.4; // 40% LTV
    } else {
      ltvRatio = 0;   // Not eligible for loans if trust is too low
    }

    const maxUsdcBorrow = usdValueOfPab * ltvRatio;

    return {
      availablePab,
      usdValueOfPab,
      trustScore: user.trustScore,
      ltvRatio,
      maxUsdcBorrow,
    };
  }

  /**
   * Request a flat-fee loan backed by PAB
   */
  async requestLoan(userId: string, usdcAmount: number) {
    if (usdcAmount <= 0) throw new Error('Invalid loan amount');

    const power = await this.calculateBorrowingPower(userId);

    if (power.ltvRatio === 0) {
      throw new Error('Trust score too low to qualify for a collateralized loan.');
    }

    if (usdcAmount > power.maxUsdcBorrow) {
      throw new Error(`Requested amount exceeds max borrowing power of $${power.maxUsdcBorrow.toFixed(2)} USDC`);
    }

    // Determine collateral needed based on the fixed LTV ratio
    const collateralNeeded = (usdcAmount / power.ltvRatio) / this.PAB_USD_PRICE;

    if (power.availablePab < collateralNeeded) {
      throw new Error('Insufficient PAB balance for collateral');
    }

    // Flat Fee logic (Sharia compliant, no compounding interest)
    // 5% flat fee for processing the loan
    const flatFeeUsdc = usdcAmount * 0.05; 

    // Execute in a transaction: Lock PAB, mint/transfer USDC to user, create loan record
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update wallet
      const wallet = await tx.wallet.update({
        where: { userId },
        data: {
          balance: { decrement: collateralNeeded },
          lockedPab: { increment: collateralNeeded },
          usdcBalance: { increment: usdcAmount }
        }
      });

      // 2. Create Loan
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30); // 30 day loan term

      const loan = await tx.loan.create({
        data: {
          userId,
          principalUsdc: usdcAmount,
          collateralPab: collateralNeeded,
          flatFeeUsdc,
          dueDate,
          status: LoanStatus.ACTIVE
        }
      });

      return { wallet, loan };
    });

    // 3. Mock On-Chain Execution (Log Attestation)
    const attestation = await blockchainService.logTrustAttestationOnSolana(userId, result.loan.id, 'COMPLETED_BOOKING', {
      event: 'LOAN_ISSUED',
      usdcAmount,
      collateralPab: collateralNeeded
    });

    if (attestation.txHash) {
      await prisma.loan.update({
        where: { id: result.loan.id },
        data: { txHash: attestation.txHash }
      });
    }

    logger.info(`[DeFi] Loan issued to ${userId}. Amount: $${usdcAmount} USDC. Collateral Locked: ${collateralNeeded} PAB.`);
    return result.loan;
  }

  /**
   * Repay the loan + flat fee to unlock PAB
   */
  async repayLoan(userId: string, loanId: string) {
    const loan = await prisma.loan.findUnique({ where: { id: loanId } });
    if (!loan) throw new Error('Loan not found');
    if (loan.userId !== userId) throw new Error('Unauthorized');
    if (loan.status !== LoanStatus.ACTIVE) throw new Error('Loan is not active');

    const totalDue = loan.principalUsdc + loan.flatFeeUsdc;

    const userWallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!userWallet || userWallet.usdcBalance < totalDue) {
      throw new Error(`Insufficient USDC balance to repay loan. Need $${totalDue}`);
    }

    await prisma.$transaction(async (tx) => {
      // 1. Deduct USDC, unlock PAB
      await tx.wallet.update({
        where: { userId },
        data: {
          usdcBalance: { decrement: totalDue },
          lockedPab: { decrement: loan.collateralPab },
          balance: { increment: loan.collateralPab }
        }
      });

      // 2. Mark Loan as REPAID
      await tx.loan.update({
        where: { id: loanId },
        data: { status: LoanStatus.REPAID }
      });
    });

    logger.info(`[DeFi] Loan ${loanId} repaid by ${userId}. Unlocked ${loan.collateralPab} PAB.`);
    return { success: true, message: 'Loan repaid successfully' };
  }
}
