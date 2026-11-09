import { describe, expect, it } from 'vitest';
import { parseCommand, parseWhen, resolveCommand } from './commandParser';
import { TECHNICIAN_FIXTURES, WORK_ORDER_FIXTURES } from '../../coordinator-fixtures';

/**
 * The command grammar is deterministic, so every branch is pinned here.
 *
 * The tests that matter most are the ambiguity ones: a command that matches
 * two people must return `ambiguous`, never a silent pick.
 */
const NOW = new Date('2026-11-09T12:00:00.000Z');

describe('parseCommand', () => {
  it('parses an assign command with a two-word work order reference', () => {
    const result = parseCommand('assign 1425 Chase to Marcus tomorrow 9am', NOW);

    expect(result.status).toBe('intent');
    if (result.status !== 'intent') return;
    expect(result.intent.kind).toBe('assign');
    if (result.intent.kind !== 'assign') return;
    expect(result.intent.workOrderQuery).toBe('1425 Chase');
    expect(result.intent.technicianQuery).toBe('Marcus');
    expect(result.intent.whenText).toBe('tomorrow 9am');
  });

  it('parses an assign command with no time', () => {
    const result = parseCommand('assign 1425 to Marcus', NOW);

    expect(result.status).toBe('intent');
    if (result.status !== 'intent') return;
    expect(result.intent.kind).toBe('assign');
    if (result.intent.kind !== 'assign') return;
    expect(result.intent.technicianQuery).toBe('Marcus');
    expect(result.intent.whenText).toBeNull();
    expect(result.intent.when).toBeNull();
  });

  it('keeps a two-word technician name together', () => {
    const result = parseCommand('assign 1425 to Marcus Reed at 9am', NOW);

    expect(result.status).toBe('intent');
    if (result.status !== 'intent') return;
    if (result.intent.kind !== 'assign') return;
    expect(result.intent.technicianQuery).toBe('Marcus Reed');
    expect(result.intent.whenText).toBe('9am');
  });

  it('parses a filter command into risk, issue and range', () => {
    const result = parseCommand('show high-risk leaks this week', NOW);

    expect(result.status).toBe('intent');
    if (result.status !== 'intent') return;
    expect(result.intent.kind).toBe('filter');
    if (result.intent.kind !== 'filter') return;
    expect(result.intent.filter).toEqual({ timeRange: 'week', risk: 'high', issueType: 'leak' });
  });

  it('parses a filter that only narrows by day', () => {
    const result = parseCommand('show jobs today', NOW);

    expect(result.status).toBe('intent');
    if (result.status !== 'intent') return;
    if (result.intent.kind !== 'filter') return;
    expect(result.intent.filter).toEqual({ timeRange: 'today' });
  });

  it('parses an approve command', () => {
    const result = parseCommand('approve all low-risk inspections', NOW);

    expect(result.status).toBe('intent');
    if (result.status !== 'intent') return;
    expect(result.intent.kind).toBe('approve_batch');
  });

  it('does not treat "approve the invoice" as an approve command', () => {
    expect(parseCommand('approve the invoice', NOW).status).toBe('unknown');
  });

  it('does not treat a filter with nothing recognizable as a filter', () => {
    expect(parseCommand('show me the money', NOW).status).toBe('unknown');
  });

  it('returns unknown for ordinary prose so the caller can search instead', () => {
    expect(parseCommand('how many jobs are on today?', NOW).status).toBe('unknown');
  });

  it('returns unknown for an assign command with no technician', () => {
    expect(parseCommand('assign 1425 to', NOW).status).toBe('unknown');
  });

  it('ignores case and surrounding whitespace', () => {
    const result = parseCommand('  ASSIGN 1425 CHASE TO MARCUS  ', NOW);

    expect(result.status).toBe('intent');
    if (result.status !== 'intent') return;
    if (result.intent.kind !== 'assign') return;
    expect(result.intent.technicianQuery).toBe('MARCUS');
  });
});

describe('resolveCommand', () => {
  const context = {
    workOrders: WORK_ORDER_FIXTURES,
    technicians: TECHNICIAN_FIXTURES,
  };

  it('resolves a unique work order and technician', () => {
    const result = resolveCommand(
      {
        kind: 'assign',
        workOrderQuery: '1425',
        technicianQuery: 'Dana',
        whenText: null,
        when: null,
      },
      context,
    );

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.command.kind).toBe('assign');
    if (result.command.kind !== 'assign') return;
    expect(result.command.workOrder.id).toBe('wo-1425');
    expect(result.command.technician.name).toBe('Dana Whitfield');
  });

  it('never silently picks when two technicians match', () => {
    const result = resolveCommand(
      {
        kind: 'assign',
        workOrderQuery: '1425',
        technicianQuery: 'Marcus',
        whenText: null,
        when: null,
      },
      context,
    );

    expect(result.status).toBe('ambiguous');
    if (result.status !== 'ambiguous') return;
    expect(result.slot).toBe('technician');
    expect(result.options.map((option) => option.label)).toEqual(['Marcus Reed', 'Marcus Chen']);
  });

  it('reports a missing technician instead of guessing', () => {
    const result = resolveCommand(
      {
        kind: 'assign',
        workOrderQuery: '1425',
        technicianQuery: 'Nobody',
        whenText: null,
        when: null,
      },
      context,
    );

    expect(result.status).toBe('unresolved');
    if (result.status !== 'unresolved') return;
    expect(result.slot).toBe('technician');
  });

  it('reports a missing work order instead of guessing', () => {
    const result = resolveCommand(
      {
        kind: 'assign',
        workOrderQuery: '9999',
        technicianQuery: 'Dana',
        whenText: null,
        when: null,
      },
      context,
    );

    expect(result.status).toBe('unresolved');
    if (result.status !== 'unresolved') return;
    expect(result.slot).toBe('workOrder');
  });

  it('resolves a filter command immediately', () => {
    const result = resolveCommand(
      {
        kind: 'filter',
        filter: { timeRange: 'today' },
        raw: 'jobs today',
      },
      context,
    );

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.command.kind).toBe('filter');
  });
});

describe('parseWhen', () => {
  // Local-time expectations: the command bar schedules in the user's timezone,
  // so the result is compared against locally-constructed dates.
  it('reads "tomorrow 9am" as 09:00 the next day', () => {
    const result = parseWhen('tomorrow 9am', NOW);
    expect(result).toEqual(new Date(2026, 10, 10, 9, 0, 0));
  });

  it('reads "2pm" in the afternoon', () => {
    const result = parseWhen('2pm', NOW);
    expect(result).toEqual(new Date(2026, 10, 9, 14, 0, 0));
  });

  it('reads a 24-hour clock time', () => {
    const result = parseWhen('14:30', NOW);
    expect(result).toEqual(new Date(2026, 10, 9, 14, 30, 0));
  });

  it('returns null for a bare day word, because no time was given', () => {
    expect(parseWhen('tomorrow', NOW)).toBeNull();
  });

  it('returns null for text with no time at all', () => {
    expect(parseWhen('Marcus Reed', NOW)).toBeNull();
  });
});
