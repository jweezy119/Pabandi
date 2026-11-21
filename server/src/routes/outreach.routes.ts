import { Router, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/database';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { resolveCrmBusiness, requireCrmContext } from '../middleware/crmContext.middleware';
import { CustomError } from '../middleware/errorHandler';
import { writeLimiter } from '../middleware/rateLimit.middleware';
import { sendEmail } from '../services/email.service';
import {
  OUTREACH_TEMPLATES,
  OUTREACH_SEGMENTS,
  getSegment,
  renderTemplate,
} from '../config/outreachTemplates';
import { selectAudience } from '../services/outreachAudience.service';

/**
 * Outreach: a business reaching its own customers.
 *
 * The audience is always derived from the caller's CRM clients — never from a
 * list supplied by the client. `businessId` comes from the session via
 * resolveCrmBusiness, so one business cannot read or message another's clients.
 */

const router = Router();

const ok = (res: Response, data: unknown, extra: Record<string, unknown> = {}) =>
  res.json({ success: true, data, ...extra });

/** A single send is capped until the sending domain has a reputation. */
const MAX_RECIPIENTS = 200;

const JWT_SECRET = process.env.JWT_SECRET || '';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function signUnsubscribe(clientId: string): string {
  return jwt.sign({ cid: clientId, purpose: 'outreach-unsubscribe' }, JWT_SECRET, {
    expiresIn: '365d',
  });
}

function appOrigin(): string {
  return process.env.APP_URL || process.env.FRONTEND_URL || 'https://pabandi.com';
}

// ── Public unsubscribe ───────────────────────────────────────────────────────
// A customer clicking this is not a Pabandi user, so it must be reachable
// without a session. Returns a real page: the link is opened in a browser from
// an email, and a JSON body there reads as an error.
router.get('/unsubscribe', async (req, res, next) => {
  try {
    const token = String(req.query.token ?? '');
    if (!token) throw new CustomError('Missing unsubscribe link.', 400);

    let clientId: string | undefined;
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { cid?: string; purpose?: string };
      if (payload?.purpose !== undefined && payload.purpose !== 'outreach-unsubscribe') {
        throw new Error('wrong purpose');
      }
      clientId = payload?.cid;
    } catch {
      // Same wording for a bad signature and an expired token: no need to tell
      // anyone which.
      throw new CustomError('This unsubscribe link is not valid.', 400);
    }
    if (!clientId) throw new CustomError('This unsubscribe link is not valid.', 400);

    const updated = await prisma.crmClient.updateMany({
      where: { id: clientId },
      data: { marketingOptIn: false, marketingOptInAt: new Date() },
    });

    res
      .status(200)
      .type('html')
      .send(
        `<!doctype html><html><head><meta charset="utf-8"><title>Unsubscribed</title>` +
          `<meta name="viewport" content="width=device-width,initial-scale=1"></head>` +
          `<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;line-height:1.5">` +
          `<h1>You have been unsubscribed</h1>` +
          `<p>${
            updated.count > 0
              ? 'You will no longer receive messages from this business.'
              : 'This email address was already unsubscribed.'
          }</p>` +
          `<p style="color:#666;font-size:.875rem">Changed your mind? Reply to any email from the business and ask to be added back.</p>` +
          `</body></html>`,
      );
  } catch (e) {
    next(e);
  }
});

router.use(authenticate, resolveCrmBusiness);

// ── Templates and segments ──────────────────────────────────────────────────

router.get('/templates', async (_req, res) => {
  ok(res, { templates: OUTREACH_TEMPLATES, segments: OUTREACH_SEGMENTS });
});

// ── Audience ────────────────────────────────────────────────────────────────

// ── Campaigns ───────────────────────────────────────────────────────────────

router.get('/campaigns', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const campaigns = await prisma.outreachCampaign.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { recipients: true } } },
    });
    ok(res, campaigns);
  } catch (e) {
    next(e);
  }
});

router.post('/campaigns', writeLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const { name, subject, body, segment } = req.body ?? {};

    if (typeof name !== 'string' || !name.trim()) {
      throw new CustomError('Give the campaign a name so you can recognise it later.', 400);
    }
    if (typeof body !== 'string' || !body.trim()) {
      throw new CustomError('The message cannot be empty.', 400);
    }
    if (subject !== undefined && typeof subject !== 'string') {
      throw new CustomError('The subject must be text.', 400);
    }
    if (segment !== undefined && segment !== null && !getSegment(String(segment))) {
      throw new CustomError(`Unknown segment: ${segment}`, 400);
    }

    const campaign = await prisma.outreachCampaign.create({
      data: {
        businessId,
        name: name.trim(),
        subject: subject?.trim() || null,
        body,
        segment: segment ? String(segment) : null,
        createdById: req.user!.id,
      },
    });
    ok(res, campaign, {});
  } catch (e) {
    next(e);
  }
});

// Registered before /campaigns/:id on purpose: Express matches in order, and
// a literal segment must win over the parameter.
router.get('/campaigns/preview-recipients', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const segmentId = String(req.query.segment ?? 'all');

    const rows = await prisma.crmClient.findMany({
      where: {
        AND: [
          { OR: [{ businessId }, { serviceBusinessId: businessId }] },
          { email: { not: null } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        stage: true,
        lastJobAt: true,
        totalSpent: true,
        marketingOptIn: true,
      },
      orderBy: { name: 'asc' },
    });

    const audience = selectAudience(rows, segmentId).slice(0, MAX_RECIPIENTS);

    ok(res, {
      segment: segmentId,
      total: audience.length,
      capped: audience.length >= MAX_RECIPIENTS,
      recipients: audience,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/campaigns/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const campaign = await prisma.outreachCampaign.findFirst({
      where: { id: req.params.id, businessId },
      include: { recipients: true },
    });
    if (!campaign) throw new CustomError('Campaign not found', 404);
    ok(res, campaign);
  } catch (e) {
    next(e);
  }
});

/** Preview the audience before anything is sent. */
router.get('/campaigns/:id/recipients', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const campaign = await prisma.outreachCampaign.findFirst({
      where: { id: req.params.id, businessId },
    });
    if (!campaign) throw new CustomError('Campaign not found', 404);

    // Falls back to "all" rather than failing: a campaign created without a
    // segment should still show who would be emailed.
    const segmentId = campaign.segment || 'all';
    const clients = await prisma.crmClient.findMany({
      where: {
        AND: [
          { OR: [{ businessId }, { serviceBusinessId: businessId }] },
          { email: { not: null } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        stage: true,
        lastJobAt: true,
        totalSpent: true,
        marketingOptIn: true,
      },
      orderBy: { name: 'asc' },
    });

    // Opt-in and segment rules live in selectAudience, so there is exactly one
    // place that decides who gets emailed.
    const audience = selectAudience(clients, segmentId).slice(0, MAX_RECIPIENTS);

    ok(res, {
      segment: segmentId,
      total: audience.length,
      capped: audience.length >= MAX_RECIPIENTS,
      recipients: audience,
    });
  } catch (e) {
    next(e);
  }
});

router.post(
  '/campaigns/:id/send',
  writeLimiter,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const crm = requireCrmContext(req);
      const businessId = crm.businessId!;
      const idempotencyKey = String(req.headers['idempotency-key'] ?? '').trim();
      if (!idempotencyKey) {
        throw new CustomError(
          'An Idempotency-Key header is required so a retried send cannot email customers twice.',
          400,
        );
      }

      const existing = await prisma.outreachCampaign.findFirst({
        where: { id: req.params.id, businessId },
      });
      if (!existing) throw new CustomError('Campaign not found', 404);

      // Idempotent: the same key returns the same outcome instead of sending again.
      if (existing.idempotencyKey === idempotencyKey && existing.status !== 'DRAFT') {
        const done = await prisma.outreachCampaign.findUnique({ where: { id: existing.id } });
        return ok(res, done, { idempotentReplay: true });
      }
      if (existing.status === 'SENDING') {
        throw new CustomError('This campaign is already sending. Wait for it to finish.', 409);
      }
      if (existing.status === 'SENT') {
        throw new CustomError('This campaign has already been sent.', 409);
      }

      const business = await prisma.business.findUnique({ where: { id: businessId } });
      const segmentId = existing.segment || 'all';
      const rows = await prisma.crmClient.findMany({
        where: {
          AND: [
            { OR: [{ businessId }, { serviceBusinessId: businessId }] },
            { email: { not: null } },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          stage: true,
          lastJobAt: true,
          totalSpent: true,
          marketingOptIn: true,
        },
        orderBy: { name: 'asc' },
      });
      const clients = selectAudience(rows, segmentId).slice(0, MAX_RECIPIENTS);

      if (clients.length === 0) {
        throw new CustomError(
          'Nobody in this audience has an email address, so there is nobody to send to.',
          400,
        );
      }

      const campaign = await prisma.outreachCampaign.update({
        where: { id: existing.id },
        data: {
          status: 'SENDING',
          idempotencyKey,
          totalCount: clients.length,
          sentCount: 0,
          failedCount: 0,
        },
      });

      let sent = 0;
      let failed = 0;

      for (const client of clients) {
        if (!client.email) continue;
        const unsub = `${appOrigin()}/api/v1/outreach/unsubscribe?token=${signUnsubscribe(client.id)}`;
        const vars = { businessName: business?.name || 'Your provider', clientName: client.name };
        const text = renderTemplate(existing.body, vars);
        const html =
          `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap;margin:0 0 1rem">${escapeHtml(text)}</pre>` +
          `<p style="font-size:12px;color:#666">You are receiving this because you are a customer of ${escapeHtml(
            business?.name || 'this business',
          )}. <a href="${unsub}">Unsubscribe</a>.</p>`;

        const result = await sendEmail({
          to: client.email,
          subject: renderTemplate(existing.subject || existing.name, vars),
          html,
          text,
        });

        const okSend = (result as any)?.success || (result as any)?.skipped;
        if (okSend) sent += 1;
        else failed += 1;

        await prisma.outreachRecipient.create({
          data: {
            campaignId: campaign.id,
            clientId: client.id,
            to: client.email,
            status: okSend ? 'SENT' : 'FAILED',
            error: okSend ? null : String((result as any)?.error || 'send failed'),
            sentAt: okSend ? new Date() : null,
          },
        });
      }

      const finished = await prisma.outreachCampaign.update({
        where: { id: campaign.id },
        data: {
          status: failed === clients.length ? 'FAILED' : 'SENT',
          sentCount: sent,
          failedCount: failed,
          sentAt: new Date(),
        },
      });

      ok(res, finished);
    } catch (e) {
      next(e);
    }
  },
);

export default router;
