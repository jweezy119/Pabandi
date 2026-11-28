import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { CustomError } from '../middleware/errorHandler';
import { sendEmail } from '../services/email.service';
import { encrypt } from '../utils/encryption';
import { syncMailAccount, syncCalendarAccount } from '../services/channelSync.service';

const router = Router();

/**
 * Provider-agnostic message + calendar layer.
 *
 * Outbound email goes through the existing Resend service; inbound email and
 * calendar events arrive via a signed webhook that any provider (or a small
 * worker using IMAP/CalDAV) can post to. That keeps provider OAuth out of the
 * CRM while giving records a real communication timeline.
 */

async function ownedBusiness(req: AuthRequest, businessId: string) {
  const business = await prisma.business.findFirst({
    where: { id: businessId, OR: [{ ownerId: req.user!.id }, { id: req.user!.businessId || '' }] },
    select: { id: true },
  });
  if (!business) throw new CustomError('Business not found', 404);
  return business;
}

router.get('/:businessId/messages', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const business = await ownedBusiness(req, req.params.businessId);
    const channel = String(req.query.channel || 'EMAIL');
    const customerId = String(req.query.customerId || '');
    const messages = await prisma.channelMessage.findMany({
      where: {
        businessId: business.id,
        channel,
        ...(customerId ? { customerId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ success: true, data: messages });
  } catch (e) {
    next(e);
  }
});

/** Send from a CRM record and mirror the message into the shared inbox. */
router.post('/route', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const business = await ownedBusiness(req, String(req.body?.businessId || ''));
    const channel = String(req.body?.channel || 'EMAIL').toUpperCase();
    const customerId = String(req.body?.customerId || req.body?.clientId || '');
    const to = String(req.body?.to || '').trim();
    const content = String(req.body?.body || '').trim();
    const subject = String(req.body?.subject || 'Message from Pabandi');
    if (!customerId || !content) throw new CustomError('customerId and body are required', 400);
    if (channel === 'EMAIL' && !to) throw new CustomError('to is required for email', 400);

    let status = 'PENDING';
    let error: string | null = null;
    if (channel === 'EMAIL') {
      const result = await sendEmail({ to, subject, html: `<p>${content.replace(/\n/g, '<br>')}</p>`, text: content });
      if ((result as any).error) {
        status = 'FAILED';
        error = String((result as any).error);
      } else if ((result as any).skipped) {
        status = 'UNCONFIGURED';
      } else {
        status = 'SENT';
      }
    }

    const message = await prisma.channelMessage.create({
      data: {
        businessId: business.id,
        customerId,
        channel,
        direction: 'OUTGOING',
        content,
        status,
        error,
        sentAt: status === 'SENT' ? new Date() : null,
      },
    });

    // Keep the CRM activity timeline in step with the inbox.
    if (req.body?.clientId) {
      await prisma.crmActivity.create({
        data: {
          serviceBusinessId: business.id,
          type: channel === 'EMAIL' ? 'EMAIL' : 'NOTE',
          description: `${subject}: ${content}`.slice(0, 2000),
          clientId: String(req.body.clientId),
        },
      }).catch(() => undefined);
    }

    res.status(201).json({ success: true, data: message });
  } catch (e) {
    next(e);
  }
});

/** Signed inbound webhook for email and calendar providers. */
router.post('/ingest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const secret = process.env.CHANNEL_INGEST_SECRET || '';
    if (!secret) throw new CustomError('CHANNEL_INGEST_SECRET is not configured', 503);
    const signature = String(req.headers['x-pabandi-signature'] || '');
    const raw = (req as any).rawBody ? Buffer.from((req as any).rawBody) : Buffer.from(JSON.stringify(req.body || {}));
    const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    const a = Buffer.from(signature, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (!/^[0-9a-f]+$/i.test(signature) || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new CustomError('Invalid webhook signature', 401);
    }

    const body = req.body || {};
    const businessId = String(body.businessId || '');
    const customerId = String(body.customerId || body.clientId || '');
    const channel = String(body.channel || 'EMAIL').toUpperCase();
    const content = String(body.body || body.snippet || '').trim();
    if (!businessId || !customerId || !content) throw new CustomError('businessId, customerId and body are required', 400);

    const message = await prisma.channelMessage.create({
      data: {
        businessId,
        customerId,
        channel,
        direction: 'INCOMING',
        content,
        status: 'RECEIVED',
        externalId: body.externalId ? String(body.externalId) : null,
        sentAt: body.eventAt ? new Date(String(body.eventAt)) : new Date(),
      },
    });

    if (body.clientId) {
      await prisma.crmActivity.create({
        data: {
          serviceBusinessId: businessId,
          type: channel === 'CALENDAR' ? 'MEETING' : 'EMAIL',
          description: `${body.subject || 'Incoming message'}: ${content}`.slice(0, 2000),
          clientId: String(body.clientId),
        },
      }).catch((err) => logger.warn(`[Channels] activity log failed: ${err?.message}`));
    }

    res.status(201).json({ success: true, data: message });
  } catch (e) {
    next(e);
  }
});

// ── Provider account setup (credentials encrypted at rest) ────────────────

function publicMail(account: any) {
  return {
    id: account.id, businessId: account.businessId, email: account.email,
    imapHost: account.imapHost, imapPort: account.imapPort,
    smtpHost: account.smtpHost, smtpPort: account.smtpPort,
    lastSyncAt: account.lastSyncAt, lastError: account.lastError, enabled: account.enabled,
  };
}

function publicCalendar(account: any) {
  return {
    id: account.id, businessId: account.businessId, name: account.name,
    calendarUrl: account.calendarUrl, username: account.username,
    lastSyncAt: account.lastSyncAt, lastError: account.lastError, enabled: account.enabled,
  };
}

router.get('/mail', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const business = await prisma.business.findFirst({ where: { ownerId: req.user!.id }, select: { id: true } });
    if (!business) return res.json({ success: true, data: null });
    const account = await prisma.crmMailAccount.findUnique({ where: { businessId: business.id } });
    res.json({ success: true, data: account ? publicMail(account) : null });
  } catch (e) { next(e); }
});

router.post('/mail', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const business = await ownedBusiness(req, String(req.body?.businessId || ''));
    const { email, imapHost, imapPassword, smtpHost, smtpPassword } = req.body || {};
    if (!email || !imapHost || !imapPassword) throw new CustomError('email, imapHost and imapPassword are required', 400);
    const data = {
      email: String(email),
      imapHost: String(imapHost),
      imapPort: Number(req.body.imapPort || 993),
      imapSecure: req.body.imapSecure === undefined ? true : Boolean(req.body.imapSecure),
      imapUser: String(req.body.imapUser || email),
      imapPassword: encrypt(String(imapPassword)),
      smtpHost: smtpHost ? String(smtpHost) : null,
      smtpPort: Number(req.body.smtpPort || 587),
      smtpUser: req.body.smtpUser ? String(req.body.smtpUser) : null,
      smtpPassword: smtpPassword ? encrypt(String(smtpPassword)) : null,
      enabled: req.body.enabled === undefined ? true : Boolean(req.body.enabled),
    };
    const account = await prisma.crmMailAccount.upsert({
      where: { businessId: business.id },
      create: { businessId: business.id, ...data },
      update: data,
    });
    res.json({ success: true, data: publicMail(account) });
  } catch (e) { next(e); }
});

router.delete('/mail', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const business = await prisma.business.findFirst({ where: { ownerId: req.user!.id }, select: { id: true } });
    if (business) await prisma.crmMailAccount.deleteMany({ where: { businessId: business.id } });
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.get('/calendar', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const business = await prisma.business.findFirst({ where: { ownerId: req.user!.id }, select: { id: true } });
    if (!business) return res.json({ success: true, data: null });
    const account = await prisma.crmCalendarAccount.findUnique({ where: { businessId: business.id } });
    res.json({ success: true, data: account ? publicCalendar(account) : null });
  } catch (e) { next(e); }
});

router.post('/calendar', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const business = await ownedBusiness(req, String(req.body?.businessId || ''));
    const { calendarUrl, username, password } = req.body || {};
    if (!calendarUrl || !username || !password) throw new CustomError('calendarUrl, username and password are required', 400);
    const data = {
      name: String(req.body.name || 'Calendar'),
      calendarUrl: String(calendarUrl),
      username: String(username),
      password: encrypt(String(password)),
      enabled: req.body.enabled === undefined ? true : Boolean(req.body.enabled),
    };
    const account = await prisma.crmCalendarAccount.upsert({
      where: { businessId: business.id },
      create: { businessId: business.id, ...data },
      update: data,
    });
    res.json({ success: true, data: publicCalendar(account) });
  } catch (e) { next(e); }
});

router.delete('/calendar', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const business = await prisma.business.findFirst({ where: { ownerId: req.user!.id }, select: { id: true } });
    if (business) await prisma.crmCalendarAccount.deleteMany({ where: { businessId: business.id } });
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.post('/sync', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const business = await ownedBusiness(req, String(req.body?.businessId || ''));
    const [mail, calendar] = await Promise.all([
      prisma.crmMailAccount.findUnique({ where: { businessId: business.id } }),
      prisma.crmCalendarAccount.findUnique({ where: { businessId: business.id } }),
    ]);
    if (mail?.enabled) await syncMailAccount(mail.id);
    if (calendar?.enabled) await syncCalendarAccount(calendar.id);
    res.json({ success: true, data: { synced: true } });
  } catch (e) { next(e); }
});

export default router;
