import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { emailService } from './email.service';
import { openwaService } from './openwa.service';
import { openwaTemplateService } from './openwa.template.service';

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

  // 1. Process CRM Jobs scheduled for tomorrow
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
      serviceBusiness: { include: { business: true } },
    },
  });

  logger.info(`[reminderCron] Found ${jobs.length} CRM jobs for tomorrow`);

  for (const job of jobs) {
    const businessName = job.serviceBusiness?.business?.name || 'Pabandi Partner';
    const dateStr = new Date(job.scheduledDate).toLocaleDateString();
    const timeStr = job.scheduledTime || '';
    const customerName = job.client?.name || 'Valued Customer';
    let dispatched = false;

    // A. Priority 1: Instant WhatsApp Interactive Reminder via OpenWA
    if (job.client?.phone) {
      try {
        const bodyText = openwaTemplateService.render('booking_reminder', {
          customerName,
          businessName,
          reservationDate: dateStr,
          reservationTime: timeStr,
        });

        await openwaService.sendButtons(
          job.client.phone,
          bodyText,
          [
            { id: `confirm_${job.id}`, text: '✅ I\'ll Be There' },
            { id: `reschedule_${job.id}`, text: '🔄 Reschedule' },
            { id: `cancel_${job.id}`, text: '❌ Cancel' },
          ],
          { title: `${businessName} Reminder` }
        ).catch(() => {
          // Fallback to plain text WhatsApp
          return openwaService.sendText(job.client!.phone!, bodyText);
        });

        dispatched = true;
        logger.info(`[reminderCron] WhatsApp reminder dispatched to ${job.client.phone} for job ${job.id}`);
      } catch (err: any) {
        logger.warn(`[reminderCron] WhatsApp delivery failed for job ${job.id}: ${err.message}`);
      }
    }

    // B. Priority 2: Email Reminder
    if (job.client?.email) {
      try {
        await emailService.sendBookingReminder({
          to: job.client.email,
          businessName,
          date: dateStr,
          time: timeStr,
          guests: 1,
          confirmationCode: job.id,
        });
        dispatched = true;
        logger.info(`[reminderCron] Email reminder sent for job ${job.id}`);
      } catch (err: any) {
        logger.error(`[reminderCron] Email failed for job ${job.id}: ${err.message}`);
      }
    }

    if (dispatched) {
      await prisma.crmJob.update({
        where: { id: job.id },
        data: { reminderSentAt: new Date() },
      });
    }
  }

  // 2. Process Consumer Reservations (Salon, Dining, Hospitality) scheduled for tomorrow
  try {
    const reservations = await prisma.reservation.findMany({
      where: {
        reservationDate: {
          gte: tomorrowStart,
          lt: tomorrowEnd,
        },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        reminderSentAt: null,
      },
      include: {
        business: true,
      },
    });

    logger.info(`[reminderCron] Found ${reservations.length} reservations for tomorrow`);

    for (const res of reservations) {
      const businessName = res.business?.name || 'Pabandi';
      const dateStr = new Date(res.reservationDate).toLocaleDateString();
      const timeStr = res.reservationTime || '';
      const customerName = res.customerName || 'Valued Guest';
      let sent = false;

      // WhatsApp Delivery via OpenWA
      if (res.customerPhone) {
        try {
          const bodyText = openwaTemplateService.render('booking_reminder', {
            customerName,
            businessName,
            reservationDate: dateStr,
            reservationTime: timeStr,
          });

          await openwaService.sendButtons(
            res.customerPhone,
            bodyText,
            [
              { id: `res_confirm_${res.id}`, text: '✅ Confirm Attendance' },
              { id: `res_change_${res.id}`, text: '🔄 Change Time' },
              { id: `res_cancel_${res.id}`, text: '❌ Cancel' },
            ],
            { title: `${businessName} Reminder` }
          ).catch(() => {
            return openwaService.sendText(res.customerPhone, bodyText);
          });

          sent = true;
          logger.info(`[reminderCron] WhatsApp reminder dispatched to ${res.customerPhone} for reservation ${res.id}`);
        } catch (err: any) {
          logger.warn(`[reminderCron] WhatsApp failed for reservation ${res.id}: ${err.message}`);
        }
      }

      // Email Delivery
      if (res.customerEmail) {
        try {
          await emailService.sendBookingReminder({
            to: res.customerEmail,
            businessName,
            date: dateStr,
            time: timeStr,
            guests: res.numberOfGuests || 1,
            confirmationCode: res.id,
          });
          sent = true;
        } catch (err: any) {
          logger.warn(`[reminderCron] Email failed for reservation ${res.id}: ${err.message}`);
        }
      }

      if (sent) {
        await prisma.reservation.update({
          where: { id: res.id },
          data: { reminderSentAt: new Date() },
        });
      }
    }
  } catch (err: any) {
    logger.error(`[reminderCron] Failed to process reservations: ${err.message}`);
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
