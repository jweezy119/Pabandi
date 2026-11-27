import { AgentToolUser, agentTools } from './agentTools.service';
import { getPaidProofByPublicId, listPaidProofsForWorker } from './paidProof.service';
import { webacyRiskService } from './webacyRisk.service';
import { autoRepairService } from './autoRepair.service';
import { aiProviderStatus } from './ai/aiProvider.router';
import { aiNlpService } from './ai.nlp.service';
import { runConcierge } from './concierge.service';
import { jevStatus } from './jev.service';
import { prisma } from '../utils/database';
import { guardOutput, sanitizeUntrusted } from '../security/aiGuard';

type Handler = (args: any, user?: AgentToolUser) => Promise<any>;

export const agentToolHandlers: Record<string, Handler> = {
  pabandi_list_businesses: (args) => agentTools.listBusinesses(args),
  pabandi_get_business: (args) => agentTools.getBusinessById(String(args.businessId)),
  pabandi_create_booking: (args, user) => agentTools.createBookingForAgent(user as AgentToolUser, args),
  pabandi_get_booking: (args) => agentTools.getBookingForAgent(String(args.bookingId)),
  pabandi_mark_checkin: (args, user) =>
    agentTools.markBookingCheckin(user as AgentToolUser, String(args.bookingId), {
      locationVerified: Boolean(args.locationVerified),
      distanceMeters: args.distanceMeters ?? null,
      overrideReason: args.overrideReason ?? null,
    }),
  pabandi_release_escrow: (args, user) =>
    agentTools.releaseBookingEscrow(user as AgentToolUser, String(args.bookingId), {
      reason: args.reason,
      rail: args.rail,
      txHash: args.txHash,
      receiptRef: args.receiptRef,
    }),
  pabandi_refund_booking: (args, user) =>
    agentTools.refundBookingForAgent(user as AgentToolUser, String(args.bookingId), String(args.reason || '')),
  pabandi_verify_passport: (args) =>
    agentTools.verifyPassportProof({
      credential: args.credential,
      payload: args.payload,
      audienceBusinessId: args.audienceBusinessId,
      threshold: args.threshold,
    }),
  pabandi_screen_wallet: (args) => webacyRiskService.screenSolanaWallet(String(args.walletAddress || '')),
  pabandi_request_payout: (args, user) =>
    agentTools.requestPayoutForAgent(user as AgentToolUser, {
      amountUsdc: Number(args.amountUsdc),
      method: args.method,
      destinationRef: args.destinationRef,
    }),
  pabandi_get_payout_history: (_args, user) => agentTools.getPayoutHistoryForAgent(user as AgentToolUser),
  pabandi_get_paid_proof: (args) => getPaidProofByPublicId(String(args.publicId)),
  pabandi_get_my_paid_proofs: (_args, user) => listPaidProofsForWorker((user as AgentToolUser).id),
  pabandi_get_identity: async (_args, user) =>
    user
      ? {
          id: user.id,
          email: user.email,
          role: user.role,
          businessId: user.businessId ?? null,
          firstName: user.firstName ?? null,
          lastName: user.lastName ?? null,
          phone: user.phone ?? null,
        }
      : { error: 'Not authenticated' },
  pabandi_search_auto_repair: (args) =>
    autoRepairService.searchAutoRepair({
      location: args.location ? String(args.location) : undefined,
      serviceType: args.serviceType ? String(args.serviceType) : undefined,
    }),
  pabandi_book_auto_repair: (args) =>
    autoRepairService.bookAutoRepair({
      shopId: String(args.shopId || ''),
      vehicleVin: String(args.vehicleVin || ''),
      serviceType: String(args.serviceType || ''),
      clientPhone: String(args.clientPhone || ''),
      clientName: args.clientName ? String(args.clientName) : undefined,
      licensePlate: args.licensePlate ? String(args.licensePlate) : undefined,
    }),
  pabandi_check_shop_trust: (args) =>
    autoRepairService.checkShopTrust({
      shopId: String(args.shopId || ''),
    }),
  pabandi_ai_status: async () => ({ providers: aiProviderStatus(), jev: jevStatus() }),
  pabandi_ai_classify: async (args) => {
    const message = sanitizeUntrusted(String(args.message || ''), { label: 'agent-message' });
    if (!message) throw new Error('message is required');
    const result = await aiNlpService.classifyIntentAndLanguage(message);
    return JSON.parse(guardOutput(JSON.stringify(result)));
  },
  pabandi_ai_concierge: async (args) => {
    const query = sanitizeUntrusted(String(args.query || ''), { label: 'agent-concierge-query' });
    if (!query) throw new Error('query is required');
    const result = await runConcierge({
      query,
      city: args.city ? String(args.city) : undefined,
      walletAddress: args.walletAddress ? String(args.walletAddress) : undefined,
    });
    return {
      message: guardOutput(result.message),
      intent: result.intent,
      proposal: result.proposal,
      alternatives: result.alternatives,
      provider: result.provider,
    };
  },
  pabandi_get_booking_risk: async (args) => {
    const bookingId = String(args.bookingId || '');
    if (!bookingId) throw new Error('bookingId is required');
    return prisma.bookingRisk.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
  },
};
