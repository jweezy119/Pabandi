import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * A slot occupied by nobody, detected by nobody.
 *
 * `jobCronService.processOverdueJobs` ran every minute and did nothing — an empty
 * method with a comment saying a grace policy did not exist. So a job that was
 * checked into and never checked out stayed IN_PROGRESS indefinitely: still occupying
 * the slot, still off the books, and invisible to the business.
 *
 * It now raises an alert through `generateAlerts`, which already runs on a schedule,
 * persists, and notifies.
 *
 * The most important property is the one it does NOT do: it never closes the job.
 * Whether the worker is still there, the job legitimately ran long, or the check-in
 * was never closed out are three different situations, and a cron guessing between
 * them would be quietly rewriting a financial record.
 */

vi.mock('../../src/utils/database', () => ({
  prisma: {
    crmClient: { findMany: vi.fn() },
    crmJob: { findMany: vi.fn() },
    crmEmployee: { findMany: vi.fn() },
  },
}));

import { prisma } from '../../src/utils/database';
import { generateAlerts } from '../../src/services/alerts.service';

const SVC = 'svc_1';

function job(over: Record<string, unknown> = {}) {
  return {
    id: 'job_1',
    status: 'IN_PROGRESS',
    checkedInAt: new Date(),
    checkedOutAt: null,
    durationMinutes: 60,
    clientName: 'Ada',
    scheduledDate: new Date(),
    scheduledTime: '10:00',
    escrowStatus: 'NONE',
    createdAt: new Date(),
    ...over,
  };
}

function alertFor(entityId: string) {
  return generateAlerts(SVC).then((all) => all.find((a) => a.entityId === entityId));
}

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.crmClient.findMany as any).mockResolvedValue([]);
  (prisma.crmEmployee.findMany as any).mockResolvedValue([]);
  (prisma.crmJob.findMany as any).mockResolvedValue([]);
});

describe('a job checked into and never checked out of', () => {
  it('raises a warning naming the job and who it is for', async () => {
    const longAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
    (prisma.crmJob.findMany as any).mockResolvedValue([job({ checkedInAt: longAgo })]);

    const alert = await alertFor('job_1');
    expect(alert).toBeDefined();
    expect(alert!.type).toBe('warning');
    expect(alert!.entityType).toBe('job');
    expect(alert!.title).toContain('Ada');
    // The message has to say why it matters, or it is just noise with a colour.
    expect(alert!.message).toMatch(/still occupying the slot/i);
  });

  it('does not close or alter the job', async () => {
    const longAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
    (prisma.crmJob.findMany as any).mockResolvedValue([job({ checkedInAt: longAgo })]);

    await generateAlerts(SVC);

    // generateAlerts only reads. Anything that wrote here would be a cron deciding a
    // financial fact it cannot know.
    expect((prisma.crmJob as any).update).toBeUndefined();
    expect((prisma.crmJob as any).updateMany).toBeUndefined();
    expect((prisma.crmJob as any).delete).toBeUndefined();
  });

  it('stays quiet for a job that was checked out of on time', async () => {
    const started = new Date(Date.now() - 5 * 60 * 60 * 1000);
    (prisma.crmJob.findMany as any).mockResolvedValue([
      job({ checkedInAt: started, checkedOutAt: new Date(Date.now() - 4 * 60 * 60 * 1000) }),
    ]);
    expect(await alertFor('job_1')).toBeUndefined();
  });

  it('stays quiet inside the grace window', async () => {
    (prisma.crmJob.findMany as any).mockResolvedValue([job({ checkedInAt: new Date() })]);
    expect(await alertFor('job_1')).toBeUndefined();
  });

  it('stays quiet for a job that was never checked into', async () => {
    (prisma.crmJob.findMany as any).mockResolvedValue([job({ checkedInAt: null })]);
    expect(await alertFor('job_1')).toBeUndefined();
  });

  it('still flags a zero-length job that overruns, rather than passing on duration 0', async () => {
    // durationMinutes is 0 for jobs booked without a length. A rule anchored purely
    // on the schedule would consider those finished the moment they start.
    const started = new Date(Date.now() - 3 * 60 * 60 * 1000);
    (prisma.crmJob.findMany as any).mockResolvedValue([
      job({ checkedInAt: started, durationMinutes: 0, scheduledTime: '10:00' }),
    ]);
    expect(await alertFor('job_1')).toBeDefined();
  });

  it('fires regardless of what the schedule says', async () => {
    // The regression that mattered. The first version anchored on
    // composeJobStart(scheduledDate, scheduledTime) and took the later of that and
    // the check-in. A job checked into at 15:00 still carries today's 10:00 on its
    // row, so the computed "finish" was in the future, elapsed came out negative, and
    // the rule never fired for ANY job — silently, with no error and no alert.
    (prisma.crmJob.findMany as any).mockResolvedValue([
      job({
        checkedInAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
        // A time already long past, and a scheduledTime that is not even valid.
        scheduledDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        scheduledTime: '99:99',
      }),
    ]);
    expect(await alertFor('job_1')).toBeDefined();
  });

  it('does not report the same stalled job twice for two different reasons', async () => {
    // Deduplication is on entityId + title downstream, but a duplicate pair with
    // identical keys would be one alert; two with different titles would be two
    // notifications for one stalled job.
    const longAgo = new Date(Date.now() - 9 * 60 * 60 * 1000);
    (prisma.crmJob.findMany as any).mockResolvedValue([job({ checkedInAt: longAgo })]);

    const all = await generateAlerts(SVC);
    const forJob = all.filter((a) => a.entityId === 'job_1');
    expect(forJob).toHaveLength(1);
  });

  it('survives a job with no client name', async () => {
    const longAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
    (prisma.crmJob.findMany as any).mockResolvedValue([job({ checkedInAt: longAgo, clientName: null })]);

    const alert = await alertFor('job_1');
    // `null` interpolated into a title is the classic "Stalled job: null".
    expect(alert!.title).toContain('unknown client');
  });
});