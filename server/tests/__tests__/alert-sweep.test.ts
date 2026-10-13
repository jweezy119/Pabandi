import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Alerts that only existed if you went and looked.
 *
 * `alerts.service` evaluates ten real rules. `getActiveAlerts` computed them and
 * persisted them — but only ever as a side effect of somebody opening the dashboard.
 *
 * So a business that never opened the CRM had no alerts at all: an overdue invoice or
 * a defaulted escrow generated nothing and told nobody. And a condition that had been
 * true for three weeks appeared all at once, indistinguishable from one that started
 * this morning. The `createdAt` on those rows is the moment of observation, not the
 * moment the condition began.
 *
 * The sweep produces them on a schedule instead, and notifies only for the rows it
 * newly inserted. "New" has to mean new, or a persistent condition would re-notify
 * every fifteen minutes forever.
 */

vi.mock('../../src/utils/database', () => ({
  prisma: {
    crmAlert: { findMany: vi.fn(), createMany: vi.fn(), updateMany: vi.fn() },
    crmServiceBusiness: { findUnique: vi.fn(), findMany: vi.fn() },
  },
}));
vi.mock('../../src/services/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../../src/services/notification.service', () => ({ createNotification: vi.fn() }));
vi.mock('../../src/services/alerts.service', () => ({ getActiveAlerts: vi.fn() }));

import { prisma } from '../../src/utils/database';
import { createNotification } from '../../src/services/notification.service';
import { getActiveAlerts } from '../../src/services/alerts.service';
import { sweepAlertsForBusiness } from '../../src/services/alertSweep.service';

const SVC = 'svc_1';
const OWNER = 'user_owner';

function existing(keys: string[]) {
  (prisma.crmAlert.findMany as any).mockResolvedValue(
    keys.map((k) => {
      const [entityId, title] = k.split('|');
      return { entityId, title };
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  existing([]);
  (prisma.crmServiceBusiness.findUnique as any).mockResolvedValue({ ownerId: OWNER });
  (getActiveAlerts as any).mockResolvedValue([]);
  (createNotification as any).mockResolvedValue({});
});

describe('the alert sweep', () => {
  it('notifies the owner about a newly raised critical alert', async () => {
    (getActiveAlerts as any).mockResolvedValue([
      { id: 'a1', type: 'critical', title: 'Invoice #12 overdue', message: '11 days past due', entityType: 'payment', entityId: 'inv_1' },
    ]);

    const result = await sweepAlertsForBusiness(SVC);

    expect(result).toEqual({ raised: 1, notified: 1 });
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: OWNER, title: 'Invoice #12 overdue', actionUrl: '/contact/invoices' }),
    );
  });

  it('does not re-notify for an alert that already existed', async () => {
    // The condition persists from yesterday. Re-announcing it every fifteen minutes
    // would train the owner to ignore notifications, which is worse than silence.
    existing(['inv_1|Invoice #12 overdue']);
    (getActiveAlerts as any).mockResolvedValue([
      { id: 'a1', type: 'critical', title: 'Invoice #12 overdue', message: '11 days past due', entityType: 'payment', entityId: 'inv_1' },
    ]);

    const result = await sweepAlertsForBusiness(SVC);

    expect(result).toEqual({ raised: 0, notified: 0 });
    expect(createNotification).not.toHaveBeenCalled();
  });

  it('deep-links a client alert at the client record', async () => {
    (getActiveAlerts as any).mockResolvedValue([
      { id: 'a2', type: 'warning', title: 'Trust score dropped', message: 'below 40', entityType: 'client', entityId: 'cli_9' },
    ]);

    await sweepAlertsForBusiness(SVC);

    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ actionUrl: '/contact/clients/cli_9' }),
    );
  });

  it('does not interrupt anyone about an informational alert', async () => {
    (getActiveAlerts as any).mockResolvedValue([
      { id: 'a3', type: 'info', title: 'New module available', message: 'x', entityType: 'module', entityId: 'm1' },
    ]);

    const result = await sweepAlertsForBusiness(SVC);

    // It is still raised and still recorded — the dashboard shows it — it just does not
    // become a notification. Not everything worth knowing is worth a popup.
    expect(result.raised).toBe(1);
    expect(result.notified).toBe(0);
    expect(createNotification).not.toHaveBeenCalled();
  });

  it('keeps going when one notification fails', async () => {
    (getActiveAlerts as any).mockResolvedValue([
      { id: 'a1', type: 'critical', title: 'One', message: 'm', entityType: 'client', entityId: 'c1' },
      { id: 'a2', type: 'critical', title: 'Two', message: 'm', entityType: 'client', entityId: 'c2' },
    ]);
    (createNotification as any)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({});

    const result = await sweepAlertsForBusiness(SVC);

    // A single failure must not abandon the rest of the sweep, and must not remove the
    // alert rows themselves.
    expect(result).toEqual({ raised: 2, notified: 1 });
  });

  it('records the alerts even when there is no owner to notify', async () => {
    (prisma.crmServiceBusiness.findUnique as any).mockResolvedValue(null);
    (getActiveAlerts as any).mockResolvedValue([
      { id: 'a1', type: 'critical', title: 'X', message: 'm', entityType: 'client', entityId: 'c1' },
    ]);

    const result = await sweepAlertsForBusiness(SVC);
    expect(result).toEqual({ raised: 1, notified: 0 });
  });
});