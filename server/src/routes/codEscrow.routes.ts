import { Router, Request, Response } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware';
import { codEscrowService } from '../services/codEscrow.service';
import { CustomError } from '../middleware/errorHandler';

const router = Router();

/**
 * Every route here acts on an escrow named by the caller, so a token alone was
 * enough to drive anyone else's: `/:id/release` and `/:id/resolve` moved money
 * to a seller or refunded a buyer on a contract the caller was not party to.
 * Escrow exists precisely to stop a third party deciding who gets the money.
 *
 * `assertParty` requires the caller to be the seller or the buyer. Note the
 * asymmetry per route below — being a party is not always enough, because the
 * two sides have different authority over the same transitions.
 */
async function assertParty(
  escrowId: string,
  userId: string,
): Promise<{ sellerId: string; buyerId: string }> {
  const escrow = await codEscrowService.getEscrowById(escrowId);
  if (!escrow) throw new CustomError('Escrow not found', 404);
  if (escrow.sellerId !== userId && escrow.buyerId !== userId) {
    // 403 rather than 404: the caller authenticated, so hiding existence buys
    // nothing, and a 404 here reads like "deleted" and hides real misuse.
    throw new CustomError('You are not a party to this escrow', 403);
  }
  return { sellerId: escrow.sellerId, buyerId: escrow.buyerId };
}

/** Only the buyer funds the escrow. */
async function assertBuyer(escrowId: string, userId: string) {
  const { buyerId } = await assertParty(escrowId, userId);
  if (buyerId !== userId) throw new CustomError('Only the buyer can pay into this escrow', 403);
}

/** Only the seller ships. */
async function assertSeller(escrowId: string, userId: string) {
  const { sellerId } = await assertParty(escrowId, userId);
  if (sellerId !== userId) throw new CustomError('Only the seller can confirm shipment', 403);
}

/**
 * Wrap an async handler so a thrown error becomes its status rather than a 500.
 * `authenticate` guarantees req.user, so the id is non-null on this path; the
 * throw is a guard against a future route reaching these handlers some other
 * way, not a normal case.
 */
function guarded(fn: (req: AuthRequest, res: Response) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    try {
      await fn(req as AuthRequest, res);
    } catch (e: any) {
      const status = e instanceof CustomError ? e.statusCode : 500;
      if (status !== 500) {
        return res.status(status).json({ error: e.message });
      }
      console.error('[CodEscrow]', e);
      res.status(500).json({ error: e.message });
    }
  };
}

/** The authenticated user id, or a hard 401 if it is somehow absent. */
function callerId(req: AuthRequest): string {
  if (!req.user?.id) throw new CustomError('Authentication required', 401);
  return callerId(req);
}

// POST /api/v1/cod/create
router.post('/create', authenticate, async (req: any, res: Response) => {
  try {
    const sellerId = req.user?.id;
    const { buyerId, amount, description, shippingAddress } = req.body;
    if (!buyerId || !amount || !description) {
      return res.status(400).json({ error: 'buyerId, amount, description are required' });
    }
    const escrow = await codEscrowService.createEscrow(sellerId, buyerId, {
      amount: parseFloat(amount),
      description,
      shippingAddress,
    });
    res.status(201).json({ success: true, data: escrow });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/v1/cod/:id/pay — buyer funds the escrow
router.post('/:id/pay', authenticate, guarded(async (req, res) => {
  await assertBuyer(req.params.id, callerId(req));
  const escrow = await codEscrowService.payIntoEscrow(req.params.id);
  res.json({ success: true, data: escrow });
}));

// POST /api/v1/cod/:id/ship — seller ships
router.post('/:id/ship', authenticate, guarded(async (req, res) => {
  const { trackingNumber } = req.body;
  if (!trackingNumber) return res.status(400).json({ error: 'trackingNumber is required' });
  await assertSeller(req.params.id, callerId(req));
  const escrow = await codEscrowService.confirmShipment(req.params.id, trackingNumber);
  res.json({ success: true, data: escrow });
}));

// POST /api/v1/cod/:id/deliver — buyer confirms receipt
router.post('/:id/deliver', authenticate, guarded(async (req, res) => {
  await assertBuyer(req.params.id, callerId(req));
  const escrow = await codEscrowService.confirmDelivery(req.params.id);
  res.json({ success: true, data: escrow });
}));

// POST /api/v1/cod/:id/release
//
// This is the transition that pays the seller, so the buyer's consent is what
// authorises it — the buyer confirming delivery IS the release. Allowing the
// seller to call it would mean the party holding the money decides when it
// leaves, which removes the entire reason for holding it. A seller that needs
// out of a stuck escrow raises a dispute instead.
router.post('/:id/release', authenticate, guarded(async (req, res) => {
  await assertBuyer(req.params.id, callerId(req));
  const escrow = await codEscrowService.releaseFunds(req.params.id);
  res.json({ success: true, data: escrow });
}));

// POST /api/v1/cod/:id/dispute — either party may dispute
router.post('/:id/dispute', authenticate, guarded(async (req, res) => {
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ error: 'reason is required' });
  await assertParty(req.params.id, callerId(req));
  const escrow = await codEscrowService.raiseDispute(req.params.id, reason);
  res.json({ success: true, data: escrow });
}));

// POST /api/v1/cod/:id/resolve
//
// Admin only, and deliberately not party-gated. Either party resolving is the
// same bug as no gate at all: the buyer picks RELEASE, the seller picks REFUND,
// and whichever they pick is the outcome. There has to be a party that is
// neither — which is also what makes an escrow a third party rather than a
// status string on a row.
router.post('/:id/resolve', authenticate, authorize('ADMIN'), guarded(async (req, res) => {
  const { resolution } = req.body;
  if (!resolution || !['REFUND', 'RELEASE'].includes(resolution)) {
    return res.status(400).json({ error: 'resolution must be REFUND or RELEASE' });
  }
  const escrow = await codEscrowService.resolveDispute(req.params.id, resolution);
  res.json({ success: true, data: escrow });
}));

// GET /api/v1/cod/history
router.get('/history', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const history = await codEscrowService.getEscrowHistory(userId);
    res.json({ success: true, data: history });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/cod/:id — party only, since this exposes both parties' details
router.get('/:id', authenticate, guarded(async (req, res) => {
  await assertParty(req.params.id, callerId(req));
  const escrow = await codEscrowService.getEscrowById(req.params.id);
  res.json({ success: true, data: escrow });
}));

export default router;
