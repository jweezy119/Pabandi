import { getSegment } from '../config/outreachTemplates';

/**
 * Audience selection, kept pure so it can be tested without a database.
 *
 * The route hands it already-fetched rows and gets back the ones to email. Two
 * rules hold for every segment, and the tests enforce them:
 *
 *  - nobody without an email address is ever selected;
 *  - nobody who has unsubscribed is ever selected.
 *
 * A segment narrows the audience. It is never a way around those two.
 */

export interface OutreachClient {
  id: string;
  name: string;
  email: string | null;
  stage?: string | null;
  lastJobAt?: Date | null;
  totalSpent?: number;
  marketingOptIn?: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function selectAudience(
  clients: OutreachClient[],
  segmentId: string,
  now: Date = new Date(),
): OutreachClient[] {
  const segment = getSegment(segmentId);
  if (!segment) throw new Error(`Unknown segment: ${segmentId}`);

  return clients.filter((client) => {
    if (!client.email) return false;
    // `=== false` rather than falsy: a client created before the column existed
    // is treated as opted in.
    if (client.marketingOptIn === false) return false;

    if (segment.lapsedDays) {
      // A customer who never booked is a lead, not a lapsed customer.
      if (!client.lastJobAt) return false;
      return now.getTime() - new Date(client.lastJobAt).getTime() > segment.lapsedDays * DAY_MS;
    }
    if (segment.id === 'leads') return client.stage === 'LEAD';
    if (segment.id === 'active') return client.stage === 'ACTIVE';
    if (segment.id === 'high_value') return (client.totalSpent ?? 0) > 500;

    return true;
  });
}
