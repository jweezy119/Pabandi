import { describe, expect, it } from 'vitest';
import {
  buildWorkOrderDraft,
  derivePriority,
  type WorkOrderSource,
} from '../src/services/bookingWorkOrder.service';

/**
 * The mapping decides what a business owner reads in the coordinator, so the
 * assertions are about the properties that must not regress:
 *
 *  - a booking on today's date is urgent, never an emergency;
 *  - the description is plain language, never the raw `metadata` JSON;
 *  - a real service name is preferred over the raw service type;
 *  - nothing silently overflows the column.
 */

const NOW = new Date('2026-11-21T09:00:00');

function source(overrides: Partial<WorkOrderSource> = {}): WorkOrderSource {
  return {
    bookingId: 'bk_1',
    businessId: 'biz_1',
    serviceType: 'Roofing',
    address: '221B Baker Street',
    slotStart: new Date('2026-11-25T10:00:00'),
    createdById: 'owner_1',
    ...overrides,
  };
}

describe('derivePriority', () => {
  it('treats a booking later today as urgent', () => {
    expect(derivePriority(new Date('2026-11-21T18:00:00'), NOW)).toBe('URGENT');
  });

  it('treats a future booking as routine', () => {
    expect(derivePriority(new Date('2026-11-25T10:00:00'), NOW)).toBe('ROUTINE');
  });

  it('never returns EMERGENCY — nothing in a booking justifies it', () => {
    for (const d of [NOW, new Date('2026-11-22'), new Date('2027-01-01')]) {
      expect(['URGENT', 'ROUTINE']).toContain(derivePriority(d, NOW));
    }
  });
});

describe('buildWorkOrderDraft', () => {
  it('uses the service name when there is one, and the type otherwise', () => {
    expect(buildWorkOrderDraft(source({ serviceName: 'Full re-roof' })).description).toBe(
      'Full re-roof',
    );
    expect(buildWorkOrderDraft(source({ serviceName: null })).description).toBe('Roofing');
  });

  it('appends the customer notes in plain language', () => {
    const draft = buildWorkOrderDraft(source({ serviceName: 'Leak repair', notes: 'Kitchen sink' }));
    expect(draft.description).toBe('Leak repair — Kitchen sink');
    expect(draft.accessNotes).toBe('Kitchen sink');
  });

  it('never embeds the raw metadata JSON', () => {
    // The old payload was a JSON blob; a work order an owner cannot read is not
    // a work order.
    const draft = buildWorkOrderDraft(source({ notes: 'drpe: 0.2, trustScore: 70' }));
    expect(draft.description).not.toContain('{');
    expect(draft.description).not.toContain('\\"');
  });

  it('keeps the issue type within the column', () => {
    const draft = buildWorkOrderDraft(source({ serviceType: 'x'.repeat(250) }));
    expect(draft.issueType.length).toBeLessThanOrEqual(100);
  });

  it('keeps the description within the column', () => {
    const draft = buildWorkOrderDraft(source({ notes: 'y'.repeat(9000) }));
    expect(draft.description.length).toBeLessThanOrEqual(5000);
  });

  it('carries the booking time as the scheduled time', () => {
    const slot = new Date('2026-11-25T10:00:00');
    expect(buildWorkOrderDraft(source({ slotStart: slot })).scheduledFor).toEqual(slot);
  });

  it('is urgent for a same-day booking', () => {
    const draft = buildWorkOrderDraft(source({ slotStart: new Date() }));
    expect(draft.priority).toBe('URGENT');
  });
});
