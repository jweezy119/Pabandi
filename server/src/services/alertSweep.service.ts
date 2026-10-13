import cron, { type ScheduledTask } from 'node-cron';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { generateAlerts, getActiveAlerts } from './alerts.service';
import { createNotification } from './notification.service';

/**
 * Alerts that arrive, rather than alerts you have to go and look at.
 *
 * `alerts.service` has always evaluated ten real rules — low trust score, overdue
 * invoice, escrow default, double-booked job, and so on. `getActiveAlerts` computed
 * them and persisted them, but only ever as a side effect of somebody opening the
 * dashboard.
 *
 * That is the wrong trigger for two reasons. A business that never opens the CRM has
 * no alerts at all, so an overdue invoice or a defaulted escrow generates nothing and
 * tells nobody. And the moment someone does open it, every alert appears at once as
 * though it had just happened — a condition that has been true for three weeks is
 * presented as news, indistinguishable from one that started this morning.
 *
 * So the rules now run on a schedule, for every enrolled business, and each newly
 * raised alert becomes a notification for the owner. The dashboard then reads the
 * same persisted rows it always did; this only changes when they are produced.
 *
 * Deduplication is the existing `@@unique([entityId, title])`, so a condition that
 * persists does not re-notify every morning. The notification is written only on the
 * run that first inserts the alert, which is what makes "new" mean new.
 */

const SWEEP_EXPRESSION = '*/15 * * * *';

/** Below this, an alert is not worth interrupting someone for. */
const NOTIFY_TYPES = new Set(['warning', 'critical']);

let task: ScheduledTask | null = null;

/**
 * Run one pass for every enrolled business.
 *
 * Exported so a test can drive it directly rather than waiting on the cron, and so a
 * single tenant can be swept on demand.
 */
export async function sweepAlertsForBusiness(
  serviceBusinessId: string,
): Promise<{ raised: number; notified: number }> {
  // Which keys already existed BEFORE this run. Anything the sweep inserts is new by
  // definition, and only those are worth notifying about.
  const before = new Set(
    (
      await prisma.crmAlert.findMany({
        where: { serviceBusinessId },
        select: { entityId: true, title: true },
      })
    ).map((a) => `${a.entityId}:${a.title}`),
  );

  const after = await getActiveAlerts(serviceBusinessId);
  const fresh = after.filter((a) => !before.has(`${a.entityId}:${a.title}`));

  if (fresh.length === 0) return { raised: 0, notified: 0 };

  const business = await prisma.crmServiceBusiness.findUnique({
    where: { id: serviceBusinessId },
    select: { ownerId: true },
  });
  if (!business) return { raised: fresh.length, notified: 0 };

  let notified = 0;
  for (const alert of fresh) {
    if (!NOTIFY_TYPES.has(alert.type)) continue;
    try {
      await createNotification({
        userId: business.ownerId,
        type: alert.type,
        title: alert.title,
        body: alert.message,
        actionUrl: alertUrl(alert),
      });
      notified += 1;
    } catch (err) {
      // One failed notification must not abandon the rest of the sweep, and must not
      // stop the alert row itself existing.
      logger.error(`[AlertSweep] notification failed for alert ${alert.id}: ${err}`);
    }
  }

  return { raised: fresh.length, notified };
}

/** Deep-link an alert at whatever it is about. */
function alertUrl(alert: { type: string; entityType: string; entityId: string }): string {
  switch (alert.entityType) {
    case 'client': return `/contact/clients/${alert.entityId}`;
    case 'job': return `/contact/jobs/${alert.entityId}`;
    case 'payment': return `/contact/invoices`;
    default: return '/contact';
  }
}

/** Sweep every enrolled business. Sequential on purpose — these are small queries. */
export async function sweepAllBusinesses(): Promise<void> {
  const businesses = await prisma.crmServiceBusiness.findMany({ select: { id: true } });
  for (const b of businesses) {
    try {
      await sweepAlertsForBusiness(b.id);
    } catch (err) {
      // Isolated per business: one tenant's bad data must not stop the others being
      // checked, or the next one runs tomorrow instead of in fifteen minutes.
      logger.error(`[AlertSweep] sweep failed for ${b.id}: ${err}`);
    }
  }
}

export function startAlertSweep(): void {
  if (task) return;
  task = cron.schedule(SWEEP_EXPRESSION, () => {
    void sweepAllBusinesses();
  });
  logger.info('[AlertSweep] alert sweep scheduled every 15 minutes');
}

export function stopAlertSweep(): void {
  task?.stop();
  task = null;
}