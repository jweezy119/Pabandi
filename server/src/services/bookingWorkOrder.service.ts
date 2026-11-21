import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { recordWorkOrderAudit } from './workOrderAudit.service';

/**
 * Turn a booking into a coordinator work order.
 *
 * Without this the Service Coordinator is empty for exactly the businesses it is
 * for: `WorkOrder` rows were only ever created by hand, so a shop taking bookings
 * through `/book/:id` saw "No work orders yet" forever. See
 * docs/booking-to-work-order-plan.md.
 *
 * The mapping is a pure function so it can be tested without a database; the
 * database work is the claim, the customer resolution and the write.
 */

export interface WorkOrderSource {
  bookingId: string;
  businessId: string;
  serviceType: string;
  /** From booking metadata; a real service name beats the raw type. */
  serviceName?: string | null;
  /** From booking metadata: special requests / project description. */
  notes?: string | null;
  address?: string | null;
  slotStart: Date;
  createdById: string;
}

export interface WorkOrderDraft {
  issueType: string;
  priority: 'EMERGENCY' | 'URGENT' | 'ROUTINE';
  description: string;
  address: string;
  accessNotes: string | null;
  scheduledFor: Date | null;
}

/** Same calendar day counts as urgent. Nothing in a booking is an emergency. */
export function derivePriority(slotStart: Date, now: Date = new Date()): 'URGENT' | 'ROUTINE' {
  const sameDay =
    slotStart.getFullYear() === now.getFullYear() &&
    slotStart.getMonth() === now.getMonth() &&
    slotStart.getDate() === now.getDate();
  return sameDay ? 'URGENT' : 'ROUTINE';
}

/**
 * Plain-language description. Never the raw `metadata` JSON: a business owner
 * should be able to read the work order without a parser.
 */
export function buildWorkOrderDraft(source: WorkOrderSource): WorkOrderDraft {
  const what = (source.serviceName || source.serviceType || 'Job').trim();
  const notes = (source.notes || '').trim();

  const description = notes ? `${what} — ${notes}` : what;

  return {
    issueType: (source.serviceType || 'general').trim().slice(0, 100),
    priority: derivePriority(new Date(source.slotStart)),
    description: description.slice(0, 5000),
    address: (source.address || '').trim().slice(0, 500),
    accessNotes: notes ? notes.slice(0, 1000) : null,
    scheduledFor: source.slotStart,
  };
}

/**
 * Find the coordinator's Customer for a booking's CrmClient.
 *
 * A booking's customer is a `CrmClient`; a work order's is a `Customer`. Matching
 * on email first and name second keeps one person from becoming two rows, and
 * creating when nothing matches is what makes a business with no CRM history
 * usable at all.
 */
export async function resolveCoordinatorCustomer(
  businessId: string,
  client: { id?: string | null; name?: string | null; email?: string | null },
): Promise<string | null> {
  const email = (client.email || '').trim().toLowerCase();
  const name = (client.name || '').trim();

  if (email) {
    const byEmail = await prisma.customer.findFirst({ where: { businessId, email } });
    if (byEmail) return byEmail.id;
  }
  if (name) {
    const byName = await prisma.customer.findFirst({ where: { businessId, name } });
    if (byName) return byName.id;
  }

  if (!name) return null;

  const created = await prisma.customer.create({
    data: { businessId, name, email: email || null },
  });
  return created.id;
}

/**
 * Create the work order for a booking, exactly once.
 *
 * `Booking.workOrderId` is UNIQUE and claimed with `updateMany` before anything
 * else happens, so a concurrent or repeated call cannot produce a second work
 * order. Returns the work order id, or null when there was nothing to do.
 */
export async function createWorkOrderForBooking(
  source: WorkOrderSource,
  client: { name?: string | null; email?: string | null },
): Promise<string | null> {
  // Claim first. `workOrderId: null` in the where makes this atomic: only one
  // caller can win the update.
  const claimed = await prisma.booking.updateMany({
    where: { id: source.bookingId, workOrderId: null },
    data: { workOrderId: 'pending' },
  });
  if (claimed.count === 0) return null;

  try {
    const customerId = await resolveCoordinatorCustomer(source.businessId, client);
    if (!customerId) {
      // Nothing to attach it to. Release the claim rather than leaving a
      // permanent 'pending' that blocks every later attempt.
      await prisma.booking.update({
        where: { id: source.bookingId },
        data: { workOrderId: null },
      });
      return null;
    }

    const draft = buildWorkOrderDraft(source);

    const workOrder = await prisma.workOrder.create({
      data: {
        businessId: source.businessId,
        customerId,
        status: 'PENDING_ASSIGNMENT',
        priority: draft.priority,
        issueType: draft.issueType,
        description: draft.description,
        address: draft.address,
        accessNotes: draft.accessNotes,
        scheduledFor: draft.scheduledFor,
        createdById: source.createdById,
      },
    });

    await prisma.booking.update({
      where: { id: source.bookingId },
      data: { workOrderId: workOrder.id },
    });

    await recordWorkOrderAudit({
      workOrderId: workOrder.id,
      actorId: source.createdById,
      action: 'CREATED',
      after: {
        id: workOrder.id,
        priority: draft.priority,
        issueType: draft.issueType,
        address: draft.address,
        sourceBookingId: source.bookingId,
      },
      requestId: `booking_${source.bookingId}`,
    }).catch((err: unknown) => {
      // The work order exists; a missing audit row should not fail the booking.
      logger.error('[BookingWorkOrder] audit failed:', err);
    });

    return workOrder.id;
  } catch (err) {
    await prisma.booking
      .update({ where: { id: source.bookingId }, data: { workOrderId: null } })
      .catch(() => {});
    throw err;
  }
}

/**
 * A cancelled booking should not stay in the coordinator as live work.
 * Bookings cancelled before this shipped have no work order and are ignored.
 */
export async function cancelWorkOrderForBooking(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { workOrderId: true },
  });
  if (!booking?.workOrderId) return;

  await prisma.workOrder.updateMany({
    where: { id: booking.workOrderId, status: { not: 'COMPLETED' } },
    data: { status: 'CANCELLED' },
  });
}
