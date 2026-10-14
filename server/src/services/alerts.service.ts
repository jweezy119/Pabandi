import { prisma } from '../utils/database';
import { clampReliabilityScore } from '../config/trust-weights';

export interface Alert {
  id: string;
  type: 'info' | 'warning' | 'critical' | 'opportunity';
  title: string;
  message: string;
  entityType: 'client' | 'job' | 'payment' | 'provider';
  entityId: string;
  createdAt: Date;
  dismissed: boolean;
}

type AlertSeed = Omit<Alert, 'id' | 'createdAt' | 'dismissed'>;

/**
 * Generate alerts for a business based on client, job, and employee data.
 * This is the core rule engine of the trust-aware revenue system.
 *
 * ─── THE PARAMETER IS A CrmServiceBusiness ID ─────────────────────────────────
 *
 * This used to be called `businessId` and was documented as a CrmBusiness id,
 * reached by joining platform `Business.email` to `CrmBusiness.ownerEmail`. That
 * model had no table — `The table public.CrmBusiness does not exist` — so this
 * rule engine could never have run against it, and the email join it depended on
 * was already described in the code as "a weak join".
 *
 * Now that CrmBusiness is gone in favour of CrmServiceBusiness, this takes a
 * CrmServiceBusiness id and scopes by `serviceBusinessId`, which is a real
 * foreign key to a table that exists. The rename is the point: a parameter called
 * `businessId` that actually holds a service-business id is how the wrong scope
 * gets passed to the wrong column, which is a cross-tenant read waiting to
 * happen.
 */
export async function generateAlerts(serviceBusinessId: string): Promise<AlertSeed[]> {
  const alerts: AlertSeed[] = [];
  const now = new Date();

  // ── Client-based alerts ─────────────────────────────────────────────────────
  const clients = await prisma.crmClient.findMany({
    where: { serviceBusinessId },
    include: { jobs: true },
  });

  for (const client of clients) {
    const jobs = client.jobs;
    const completed = jobs.filter(j => j.status === 'COMPLETED');
    const score = clampReliabilityScore(client.reliabilityScore);
    const hasDefaulted = completed.some(j => j.escrowStatus === 'REFUNDED');

    // Client score < 30 → CRITICAL
    if (score < 30) {
      alerts.push({
        type: 'critical',
        title: `Low reliability score: ${score}`,
        message: 'Require 50% deposit or decline',
        entityType: 'client',
        entityId: client.id,
      });
    }
    // Client score < 50 → WARNING
    else if (score < 50) {
      alerts.push({
        type: 'warning',
        title: `Below-average reliability: ${score}`,
        message: 'Recommend deposit for next booking',
        entityType: 'client',
        entityId: client.id,
      });
    }

    // 3+ completed → OPPORTUNITY: net-30 terms
    if (completed.length >= 3 && score >= 50) {
      alerts.push({
        type: 'opportunity',
        title: 'Repeat client eligible',
        message: 'Offer net-30 terms',
        entityType: 'client',
        entityId: client.id,
      });
    }

    // 10+ completed AND score > 80 → VIP
    if (completed.length >= 10 && score > 80) {
      alerts.push({
        type: 'opportunity',
        title: 'VIP client',
        message: 'VIP client — priority matching',
        entityType: 'client',
        entityId: client.id,
      });
    }

    // Cross-module trust history available (client has phone from external module)
    if (client.phone && client.phoneVerified) {
      alerts.push({
        type: 'info',
        title: 'Verified client contact',
        message: 'Cross-module trust history available',
        entityType: 'client',
        entityId: client.id,
      });
    }
  }

  // ── Job-based alerts ────────────────────────────────────────────────────────
  const jobs = await prisma.crmJob.findMany({
    where: { serviceBusinessId },
    select: {
      id: true,
      status: true,
      checkedInAt: true,
      checkedOutAt: true,
      durationMinutes: true,
      clientName: true,
      scheduledDate: true,
      scheduledTime: true,
      // Read by the escrow rule below, which measures how long money has been held.
      escrowStatus: true,
      createdAt: true,
    },
  });

  /**
   * A job somebody checked into and never checked out of.
   *
   * This was `jobCronService.processOverdueJobs`, an empty method with a comment
   * saying a grace policy did not exist. It ran every minute, did nothing, and left
   * the one signal that reliably means money is being mis-recorded — IN_PROGRESS,
   * occupied, no check-out — detected by nobody.
   *
   * It raised here rather than there because this file is where an alert is decided,
   * and it already runs on a schedule through the sweep, persists, and notifies. The
   * old location would have needed all three built from scratch to do less.
   *
   * SURFACES, NEVER MUTATES. Nothing auto-closes a stalled job: whether the worker is
   * still there, the job ran long, or the check-in was never closed out are all
   * different, and a cron guessing between them would be quietly rewriting a
   * financial record. A person decides.
   */
  const STALLED_AFTER_MINUTES = 30;
  for (const job of jobs) {
    if (job.status !== 'IN_PROGRESS' || job.checkedOutAt || !job.checkedInAt) continue;

    /**
     * Measured from the check-in, not the schedule.
     *
     * The first version anchored on `composeJobStart(scheduledDate, scheduledTime)`
     * and took the later of that and the check-in. The schedule is not a reliable
     * reference for this: a job checked into late in the day still has today's 10:00
     * on its row, so the "finish" it computed was in the future and the elapsed time
     * came out negative — the rule then never fired for any job at all.
     *
     * What actually matters is how long the worker has been on site, and that is
     * known exactly: checkedInAt. `durationMinutes` is the planned length and is 0 for
     * jobs booked without one, which is why it is added rather than compared — so a
     * zero-length job still gets the grace window instead of being flagged the
     * instant it starts.
     */
    const elapsedMinutes = (now.getTime() - job.checkedInAt.getTime()) / 60_000;
    const allowedMinutes = (job.durationMinutes || 0) + STALLED_AFTER_MINUTES;

    if (elapsedMinutes >= allowedMinutes) {
      const stalledMinutes = elapsedMinutes;
      alerts.push({
        type: 'warning',
        title: `Stalled job: ${job.clientName || 'unknown client'}`,
        message: `Checked in ${Math.floor(stalledMinutes / 60)}h ago and never checked out. It is still marked in progress, so it is still occupying the slot.`,
        entityType: 'job',
        entityId: job.id,
      });
    }
  }

  for (const job of jobs) {
    // Job escrow held > 30 days → WARNING
    if (job.escrowStatus === 'HELD' && job.createdAt) {
      const daysHeld = Math.floor((now.getTime() - job.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      if (daysHeld > 30) {
        alerts.push({
          type: 'warning',
          title: 'Escrow held over 30 days',
          message: 'Release or dispute',
          entityType: 'job',
          entityId: job.id,
        });
      }
    }
  }

  // ── Employee/Provider alerts ────────────────────────────────────────────────
  const employees = await prisma.crmEmployee.findMany({
    where: { serviceBusinessId, isActive: true },
  });

  for (const emp of employees) {
    // Provider no bookings 14+ days → INFO
    const lastBooking = emp.lastBookingAt;
    const daysSinceBooking = lastBooking
      ? Math.floor((now.getTime() - lastBooking.getTime()) / (1000 * 60 * 60 * 24))
      : 999; // No booking recorded → consider stale

    if (daysSinceBooking >= 14) {
      alerts.push({
        type: 'info',
        title: 'Provider inactive',
        message: 'Consider promotion',
        entityType: 'provider',
        entityId: emp.id,
      });
    }
  }

  return alerts;
}

/**
 * Get active (non-dismissed) alerts for a business.
 * Generates fresh alerts from current data and merges with stored ones.
 */
export async function getActiveAlerts(serviceBusinessId: string): Promise<any[]> {
  // Generate seeds from current data
  const seeds = await generateAlerts(serviceBusinessId);

  // Upsert alerts — avoid duplicates by entityId + title key.
  //
  // Scoped by serviceBusinessId, which is the only alert tenancy that has a
  // backing table. `CrmAlert.businessId` points at the deleted CrmBusiness and
  // is now an unconstrained column nothing writes.
  const existingAlerts = await prisma.crmAlert.findMany({
    where: { serviceBusinessId, dismissed: false },
  });

  const existingKeys = new Set(
    existingAlerts.map(a => `${a.entityId}:${a.title}`)
  );

  // Insert only new alerts that don't already exist
  const newSeeds = seeds.filter(s => !existingKeys.has(`${s.entityId}:${s.title}`));
  if (newSeeds.length > 0) {
    await prisma.crmAlert.createMany({
      data: newSeeds.map(s => ({
        serviceBusinessId,
        ...s,
      })),
    });
  }

  // Return all active alerts
  return prisma.crmAlert.findMany({
    where: { serviceBusinessId, dismissed: false },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Dismiss an alert by ID.
 */
export async function dismissAlert(alertId: string, serviceBusinessId: string): Promise<any> {
  // Scoped by serviceBusinessId as above. The `serviceBusinessId` term is what
  // stops one tenant dismissing another's alert by guessing an id, so it is
  // load-bearing rather than decorative.
  return prisma.crmAlert.updateMany({
    where: { id: alertId, serviceBusinessId },
    data: { dismissed: true, dismissedAt: new Date() },
  });
}
