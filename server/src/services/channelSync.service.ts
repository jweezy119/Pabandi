import { ImapFlow } from 'imapflow';
import { createDAVClient } from 'tsdav';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { decrypt } from '../utils/encryption';

/**
 * Provider-backed sync for the CRM channel layer.
 *
 * IMAP reads new mail, matches the sender to a CrmClient by email, and writes
 * both a ChannelMessage and an EMAIL activity. CalDAV reads meetings and turns
 * them into tasks with a due date plus a MEETING activity. All credentials are
 * encrypted at rest with ENCRYPTION_KEY.
 */

function findClientByEmail(businessId: string, email: string) {
  return prisma.crmClient.findFirst({
    where: {
      email: { equals: email, mode: 'insensitive' },
      OR: [{ businessId }, { serviceBusinessId: businessId }],
    },
    select: { id: true },
  });
}

function decodeBody(source: string | undefined): string {
  if (!source) return '';
  // Good enough for timeline context: strip headers, prefer the first plain-text
  // chunk, and cap length so a huge newsletter cannot blow up a record page.
  const separator = source.indexOf('\r\n\r\n');
  const raw = separator >= 0 ? source.slice(separator + 4) : source;
  return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4000);
}

export async function syncMailAccount(accountId: string): Promise<void> {
  const account = await prisma.crmMailAccount.findUnique({ where: { id: accountId } });
  if (!account || !account.enabled) return;
  let client: ImapFlow | null = null;
  try {
    client = new ImapFlow({
      host: account.imapHost,
      port: account.imapPort,
      secure: account.imapSecure,
      auth: { user: account.imapUser, pass: decrypt(account.imapPassword) },
      logger: false,
    });
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    let imported = 0;
    try {
      const since = account.lastSyncAt ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      for await (const message of client.fetch({ since }, { uid: true, envelope: true, source: true })) {
        const from = message.envelope?.from?.[0]?.address || '';
        if (!from || from.toLowerCase() === account.email.toLowerCase()) continue;
        const subject = message.envelope?.subject || '(no subject)';
        const sentAt = message.envelope?.date || new Date();
        const existing = await prisma.channelMessage.findFirst({
          where: { businessId: account.businessId, channel: 'EMAIL', externalId: String(message.uid) },
          select: { id: true },
        });
        if (existing) continue;
        const matched = await findClientByEmail(account.businessId, from);
        await prisma.channelMessage.create({
          data: {
            businessId: account.businessId,
            customerId: matched?.id || from,
            channel: 'EMAIL',
            direction: 'INCOMING',
            content: `${subject}\n${decodeBody(String(message.source || ''))}`.slice(0, 4000),
            status: 'RECEIVED',
            externalId: String(message.uid),
            sentAt,
          },
        });
        if (matched) {
          await prisma.crmActivity.create({
            data: {
              serviceBusinessId: account.businessId,
              type: 'EMAIL',
              description: `${subject}: ${decodeBody(String(message.source || ''))}`.slice(0, 2000),
              clientId: matched.id,
            },
          });
        }
        imported += 1;
      }
    } finally {
      lock.release();
    }
    await prisma.crmMailAccount.update({
      where: { id: account.id },
      data: { lastSyncAt: new Date(), lastError: null },
    });
    logger.info(`[ChannelSync] mail ${account.email}: imported ${imported} messages`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`[ChannelSync] mail ${account.email} failed: ${message}`);
    await prisma.crmMailAccount.update({ where: { id: account.id }, data: { lastError: message } }).catch(() => undefined);
  } finally {
    if (client) await client.logout().catch(() => undefined);
  }
}

function icsValue(block: string, key: string): string {
  const match = block.match(new RegExp(`^${key}[^:]*:?(.+)$`, 'm'));
  return match ? match[1].trim() : '';
}

export async function syncCalendarAccount(accountId: string): Promise<void> {
  const account = await prisma.crmCalendarAccount.findUnique({ where: { id: accountId } });
  if (!account || !account.enabled) return;
  try {
    const dav: any = await createDAVClient({
      serverUrl: account.calendarUrl,
      credentials: { username: account.username, password: decrypt(account.password) },
      authMethod: 'Basic',
    });
    const calendars = await dav.fetchCalendars();
    const now = new Date();
    const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    let imported = 0;
    for (const calendar of calendars) {
      const events = await dav.fetchCalendarObjects({
        calendar,
        timeRange: { start: now.toISOString(), end: end.toISOString() },
      });
      for (const event of events) {
        const ics = String(event.data || '');
        const block = ics.slice(ics.indexOf('BEGIN:VEVENT'), ics.indexOf('END:VEVENT'));
        const summary = icsValue(block, 'SUMMARY') || 'Meeting';
        const startValue = icsValue(block, 'DTSTART') || icsValue(block, 'DTSTART;TZID=[^;]*');
        const dueDate = startValue ? new Date(startValue.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?/, '$1-$2-$3T$4:$5:$6Z')) : null;
        const emailMatch = ics.match(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
        const matched = emailMatch ? await findClientByEmail(account.businessId, emailMatch[1]) : null;
        const externalKey = String(event.url || `${summary}-${startValue}`);
        const exists = await prisma.crmActivity.findFirst({
          where: { serviceBusinessId: account.businessId, type: 'MEETING', description: { contains: externalKey } },
          select: { id: true },
        });
        if (exists) continue;
        await prisma.crmActivity.create({
          data: {
            serviceBusinessId: account.businessId,
            type: 'MEETING',
            description: `${summary} (${externalKey})`,
            clientId: matched?.id || null,
          },
        });
        if (dueDate && !Number.isNaN(dueDate.getTime())) {
          await prisma.crmTask.create({
            data: {
              title: summary,
              serviceBusinessId: account.businessId,
              status: 'TODO',
              priority: 'MEDIUM',
              dueDate,
              clientId: matched?.id || null,
            },
          }).catch(() => undefined);
        }
        imported += 1;
      }
    }
    await prisma.crmCalendarAccount.update({
      where: { id: account.id },
      data: { lastSyncAt: new Date(), lastError: null },
    });
    logger.info(`[ChannelSync] calendar ${account.name}: imported ${imported} events`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`[ChannelSync] calendar ${account.name} failed: ${message}`);
    await prisma.crmCalendarAccount.update({ where: { id: account.id }, data: { lastError: message } }).catch(() => undefined);
  }
}

export async function syncAllChannels(): Promise<void> {
  const [mail, calendars] = await Promise.all([
    prisma.crmMailAccount.findMany({ where: { enabled: true }, select: { id: true } }),
    prisma.crmCalendarAccount.findMany({ where: { enabled: true }, select: { id: true } }),
  ]);
  for (const account of mail) await syncMailAccount(account.id);
  for (const account of calendars) await syncCalendarAccount(account.id);
}
