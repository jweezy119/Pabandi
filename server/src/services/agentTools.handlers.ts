import { AgentToolUser, agentTools } from './agentTools.service';
import { getPaidProofByPublicId, listPaidProofsForWorker } from './paidProof.service';
import { webacyRiskService } from './webacyRisk.service';
import { autoRepairService } from './autoRepair.service';

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
};
