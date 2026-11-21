import { describe, expect, it } from 'vitest';
import { selectAudience, type OutreachClient } from '../src/services/outreachAudience.service';
import { renderTemplate, getSegment, OUTREACH_TEMPLATES } from '../src/config/outreachTemplates';

/**
 * Audience selection decides who gets emailed, so the assertions here are about
 * the properties that must not regress:
 *
 *  - nobody without an email address is ever selected;
 *  - nobody who unsubscribed is ever selected — no segment overrides that;
 *  - "lapsed" means a real customer who has not been back, not a lead who never
 *    booked in the first place.
 */

const NOW = new Date('2026-11-20T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

function client(overrides: Partial<OutreachClient> = {}): OutreachClient {
  return { id: 'c1', name: 'Ada', email: 'ada@example.com', ...overrides };
}

describe('selectAudience', () => {
  it('selects everyone with an email address for the "all" segment', () => {
    const result = selectAudience([client(), client({ id: 'c2', name: 'Bo' })], 'all', NOW);
    expect(result.map((c) => c.id)).toEqual(['c1', 'c2']);
  });

  it('never selects a client with no email address', () => {
    const result = selectAudience(
      [client(), client({ id: 'c2', email: null })],
      'all',
      NOW,
    );
    expect(result.map((c) => c.id)).toEqual(['c1']);
  });

  it('never selects a client who unsubscribed', () => {
    const result = selectAudience(
      [client(), client({ id: 'c2', marketingOptIn: false })],
      'all',
      NOW,
    );
    expect(result.map((c) => c.id)).toEqual(['c1']);
  });

  it('treats a missing opt-in flag as opted in', () => {
    // The column defaults to true, but rows written before it existed are null.
    const result = selectAudience([client({ marketingOptIn: undefined })], 'all', NOW);
    expect(result).toHaveLength(1);
  });

  it('applies the opt-in rule to every segment, not just "all"', () => {
    const optedOut = client({ id: 'c2', marketingOptIn: false, lastJobAt: daysAgo(200) });
    const result = selectAudience([optedOut], 'lapsed', NOW);
    expect(result).toHaveLength(0);
  });

  it('lapsed means last job more than 90 days ago', () => {
    const result = selectAudience(
      [
        client({ id: 'recent', lastJobAt: daysAgo(30) }),
        client({ id: 'lapsed', lastJobAt: daysAgo(120) }),
      ],
      'lapsed',
      NOW,
    );
    expect(result.map((c) => c.id)).toEqual(['lapsed']);
  });

  it('lapsed excludes a client who never booked', () => {
    // A lead is not a lapsed customer; emailing them "we miss you" is a lie.
    const result = selectAudience([client({ lastJobAt: null })], 'lapsed', NOW);
    expect(result).toHaveLength(0);
  });

  it('filters by stage for leads and active', () => {
    const clients = [
      client({ id: 'lead', stage: 'LEAD' }),
      client({ id: 'active', stage: 'ACTIVE' }),
    ];
    expect(selectAudience(clients, 'leads', NOW).map((c) => c.id)).toEqual(['lead']);
    expect(selectAudience(clients, 'active', NOW).map((c) => c.id)).toEqual(['active']);
  });

  it('high_value is strictly more than $500', () => {
    const clients = [
      client({ id: 'exactly', totalSpent: 500 }),
      client({ id: 'over', totalSpent: 500.01 }),
      client({ id: 'none', totalSpent: 0 }),
    ];
    expect(selectAudience(clients, 'high_value', NOW).map((c) => c.id)).toEqual(['over']);
  });

  it('throws on an unknown segment rather than emailing everyone', () => {
    expect(() => selectAudience([client()], 'everyone-on-earth', NOW)).toThrow(/Unknown segment/);
  });
});

describe('outreach templates', () => {
  it('substitutes the placeholders it is given', () => {
    expect(renderTemplate('Hi {clientName} at {businessName}', { clientName: 'Ada', businessName: 'DMG' })).toBe(
      'Hi Ada at DMG',
    );
  });

  it('leaves an unknown placeholder intact instead of blanking it', () => {
    expect(renderTemplate('Hi {unknown}', {})).toBe('Hi {unknown}');
  });

  it('every template carries a subject and a body', () => {
    for (const t of OUTREACH_TEMPLATES) {
      expect(t.subject.trim().length).toBeGreaterThan(0);
      expect(t.body.trim().length).toBeGreaterThan(0);
    }
  });

  it('every template has a known id and label', () => {
    const ids = OUTREACH_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of OUTREACH_TEMPLATES) {
      expect(t.label.trim().length).toBeGreaterThan(0);
      expect(getSegment('all')).toBeDefined();
    }
  });
});
