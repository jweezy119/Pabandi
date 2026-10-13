import { prisma } from '../utils/database';
import { crmScope } from './crm.service';

/**
 * One search across everything the CRM holds.
 *
 * The platform had no cross-entity search anywhere. Every list page carried its own
 * private search box, which meant: you could only search the page you were already
 * on; the clients box searched name, email and company but not phone or notes, so
 * typing a phone number found nothing; and an invoice number was only findable by
 * opening the invoices page first.
 *
 * This is the thing that makes the CRM navigable by keyboard. Results are grouped by
 * type and carry an `href`, so picking one navigates straight to the record rather
 * than to a list that then has to be searched again.
 *
 * Tenant scope is the same `crmScope` used by the lists, so results can only ever
 * contain the caller's own records. Invoices are the exception — they are keyed by the
 * platform `Business` — and when there is no platform business the invoice branch
 * returns an impossible predicate rather than an empty one, because an empty filter
 * on the money table is a match-all and a match-all on revenue is the worst failure
 * direction available.
 */

/** Per-type caps. Ten of each keeps the palette scannable and the query bounded. */
const PER_TYPE = 10;

/** Below this, a search matches nearly everything and returns noise. */
export const MIN_SEARCH_LENGTH = 2;

export interface SearchResult {
  type: 'client' | 'deal' | 'job' | 'invoice' | 'activity';
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  href: string;
}

export interface SearchOptions {
  types?: SearchResult['type'][];
  limit?: number;
}

function money(n: number, currency = 'USD') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export async function searchCrm(
  serviceBusinessId: string,
  businessId: string | null,
  query: string,
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  const term = query.trim();
  if (term.length < MIN_SEARCH_LENGTH) return [];

  const wanted = new Set(options.types ?? ['client', 'deal', 'job', 'invoice', 'activity']);
  const limit = Math.min(options.limit ?? PER_TYPE, PER_TYPE);
  const scope = crmScope(serviceBusinessId, businessId);

  // `mode: 'insensitive'` throughout. `contains` without it is case-sensitive on
  // Postgres, so "smith" would not find "Smith" — the sort of failure that makes a
  // search feel broken without anyone being able to say why.
  const results: SearchResult[] = [];

  const [
    clients,
    deals,
    jobs,
    invoices,
    activities,
  ] = await Promise.all([
    wanted.has('client')
      ? prisma.crmClient.findMany({
          where: {
            AND: [
              scope,
              {
                OR: [
                  { name: { contains: term, mode: 'insensitive' } },
                  { email: { contains: term, mode: 'insensitive' } },
                  // Phone and company are searchable here because a person looking for
                  // someone is as likely to have the number as the name, and the old
                  // per-page box silently ignored both.
                  { phone: { contains: term, mode: 'insensitive' } },
                  { company: { contains: term, mode: 'insensitive' } },
                  { notes: { contains: term, mode: 'insensitive' } },
                ],
              },
            ],
          },
          select: { id: true, name: true, email: true, phone: true, company: true, status: true },
          take: limit,
        })
      : [],
    wanted.has('deal')
      ? prisma.crmDeal.findMany({
          where: {
            AND: [
              scope,
              {
                OR: [
                  { title: { contains: term, mode: 'insensitive' } },
                  { notes: { contains: term, mode: 'insensitive' } },
                  { client: { is: { name: { contains: term, mode: 'insensitive' } } } },
                ],
              },
            ],
          },
          select: { id: true, title: true, stage: true, value: true, currency: true },
          take: limit,
        })
      : [],
    wanted.has('job')
      ? prisma.crmJob.findMany({
          where: {
            AND: [
              scope,
              {
                OR: [
                  { clientName: { contains: term, mode: 'insensitive' } },
                  { serviceType: { contains: term, mode: 'insensitive' } },
                  { address: { contains: term, mode: 'insensitive' } },
                  { client: { is: { name: { contains: term, mode: 'insensitive' } } } },
                ],
              },
            ],
          },
          select: { id: true, clientName: true, serviceType: true, status: true, price: true },
          take: limit,
        })
      : [],
    wanted.has('invoice')
      ? prisma.invoice.findMany({
          where: {
            // An impossible predicate rather than `{}`. Dropping the business filter
            // here would return every tenant's invoices.
            businessId: businessId ?? '__no_platform_business__',
            OR: [
              { number: { contains: term, mode: 'insensitive' } },
              { client: { is: { name: { contains: term, mode: 'insensitive' } } } },
            ],
          },
          select: { id: true, number: true, status: true, subtotal: true, currency: true, client: { select: { name: true } } },
          take: limit,
        })
      : [],
    wanted.has('activity')
      ? prisma.crmActivity.findMany({
          where: {
            AND: [
              scope,
              {
                OR: [
                  { title: { contains: term, mode: 'insensitive' } },
                  { description: { contains: term, mode: 'insensitive' } },
                ],
              },
            ],
          },
          select: { id: true, title: true, type: true, createdAt: true },
          take: limit,
        })
      : [],
  ]);

  for (const c of clients) {
    results.push({
      type: 'client',
      id: c.id,
      title: c.name,
      subtitle: [c.email, c.phone].filter(Boolean).join(' · ') || c.company || undefined,
      meta: c.company ?? undefined,
      href: `/contact/clients/${c.id}`,
    });
  }

  for (const d of deals) {
    results.push({
      type: 'deal',
      id: d.id,
      title: d.title,
      subtitle: d.stage,
      meta: money(d.value, d.currency || 'USD'),
      href: `/contact/deals/${d.id}`,
    });
  }

  for (const j of jobs) {
    results.push({
      type: 'job',
      id: j.id,
      title: `${j.serviceType} — ${j.clientName}`,
      subtitle: j.status,
      meta: j.price ? money(j.price) : undefined,
      href: `/contact/jobs/${j.id}`,
    });
  }

  for (const i of invoices) {
    results.push({
      type: 'invoice',
      id: i.id,
      title: `#${i.number}`,
      subtitle: i.client?.name ?? 'Unknown client',
      meta: `${money(i.subtotal, i.currency || 'USD')} · ${i.status}`,
      href: `/contact/invoices/${i.id}`,
    });
  }

  for (const a of activities) {
    results.push({
      type: 'activity',
      id: a.id,
      title: a.title,
      subtitle: a.type,
      href: '/contact/activities',
    });
  }

  return results;
}