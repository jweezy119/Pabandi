import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { emailService } from './email.service';

const REMINDER_HOUR = 9; // 9am local time

function getTomorrowStart(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function runBookingReminderCron() {
  const tomorrowStart = getTomorrowStart();
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

  const jobs = await prisma.crmJob.findMany({
    where: {
      scheduledDate: {
        gte: tomorrowStart,
        lt: tomorrowEnd,
      },
      status: { not: 'CANCELLED' },
      reminderSentAt: null,
    },
    include: {
      client: true,
      // Was `business`, which resolved to CrmBusiness — a model with no table.
      // The name a customer sees in a reminder should be the platform business's
      // name, and `serviceBusiness` is the relation that exists, so the display
      // name comes from the linked Business row.
      serviceBusiness: { include: { business: true } },
    },
  });

  logger.info(`[reminderCron] Found ${jobs.length} jobs for tomorrow`);

  for (const job of jobs) {
    if (!job.client?.email) continue;

    try {
      await emailService.sendBookingReminder({
        to: job.client.email,
        // `businessName` no longer exists anywhere in the CRM models; the
        // unified business-OS work moved the name onto the platform Business
        // row, which is what `serviceBusiness.business` is.
        businessName: job.serviceBusiness?.business?.name || 'Pabandi',
        date: new Date(job.scheduledDate).toLocaleDateString(),
        time: job.scheduledTime || '',
        guests: 1,
        confirmationCode: job.id,
      });

      await prisma.crmJob.update({
        where: { id: job.id },
        data: { reminderSentAt: new Date() },
      });

      logger.info(`[reminderCron] Sent reminder for job ${job.id}`);
    } catch (err: any) {
      logger.error(`[reminderCron] Failed for job ${job.id}: ${err.message}`);
    }
  }
}

export function startReminderCron() {
  const cron = require('node-cron');
  
  // Every day at 9am
  const task = cron.schedule(`0 ${REMINDER_HOUR} * * *`, async () => {
    logger.info('[reminderCron] Running daily reminder job');
    await runBookingReminderCron().catch((err) => logger.error('[reminderCron] Error:', err));
  }, {
    timezone: 'America/New_York',
  });

  task.start();
  logger.info('[reminderCron] Started daily at 9am ET');
  return task;
}
