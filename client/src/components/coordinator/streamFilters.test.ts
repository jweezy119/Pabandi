import { describe, expect, it } from 'vitest';
import {
  applyStreamFilter,
  describeFilter,
  isFilterEmpty,
  isWithinRange,
  parseFilterIntent,
} from './streamFilters';
import { WORK_ORDER_FIXTURES } from '../../coordinator-fixtures';

describe('parseFilterIntent', () => {
  it('extracts risk, issue and range', () => {
    expect(parseFilterIntent('high-risk leaks this week')).toEqual({
      risk: 'high',
      issueType: 'leak',
      timeRange: 'week',
    });
  });

  it('treats a bare day word as a range', () => {
    expect(parseFilterIntent('jobs today')).toEqual({ timeRange: 'today' });
  });

  it('returns an empty filter when nothing is recognizable', () => {
    expect(parseFilterIntent('me the money')).toEqual({});
  });
});

describe('applyStreamFilter', () => {
  it('filters by risk band', () => {
    const result = applyStreamFilter(WORK_ORDER_FIXTURES, { risk: 'high' });
    expect(result.map((workOrder) => workOrder.id)).toEqual(['wo-1425']);
  });

  it('excludes unscored jobs when filtering by risk', () => {
    const result = applyStreamFilter(WORK_ORDER_FIXTURES, { risk: 'low' });
    expect(result.map((workOrder) => workOrder.id)).toEqual(['wo-1426']);
  });

  it('filters by issue type', () => {
    const result = applyStreamFilter(WORK_ORDER_FIXTURES, { issueType: 'leak' });
    expect(result.map((workOrder) => workOrder.id)).toEqual(['wo-1425']);
  });

  it('searches across customer, address and description', () => {
    const result = applyStreamFilter(WORK_ORDER_FIXTURES, { search: 'Bensenville' });
    expect(result.map((workOrder) => workOrder.id)).toEqual(['wo-1427']);
  });

  it('returns everything for an empty filter', () => {
    expect(applyStreamFilter(WORK_ORDER_FIXTURES, {})).toHaveLength(WORK_ORDER_FIXTURES.length);
  });

  it('combines qualifiers', () => {
    const result = applyStreamFilter(WORK_ORDER_FIXTURES, { risk: 'high', issueType: 'leak' });
    expect(result.map((workOrder) => workOrder.id)).toEqual(['wo-1425']);
  });
});

describe('filter helpers', () => {
  it('treats an all-undefined filter as empty', () => {
    expect(isFilterEmpty({})).toBe(true);
    expect(isFilterEmpty({ risk: 'low' })).toBe(false);
    expect(isFilterEmpty(undefined)).toBe(true);
  });

  it('describes a filter in plain language', () => {
    expect(describeFilter({ risk: 'high', issueType: 'leak', timeRange: 'week' })).toBe(
      'high risk · leak · this week',
    );
  });

  it('compares a date against a day range', () => {
    // Relative to "now", never a hardcoded date. An earlier version of this
    // test used 2026-11-09 as "today", which made it pass on the day it was
    // written and fail everywhere else — CI caught it the next day.
    const daysFromNow = (days: number, hour = 9) => {
      const date = new Date();
      date.setDate(date.getDate() + days);
      date.setHours(hour, 0, 0, 0);
      return date;
    };

    expect(isWithinRange(daysFromNow(0), 'today')).toBe(true);
    expect(isWithinRange(daysFromNow(1), 'today')).toBe(false);
    expect(isWithinRange(daysFromNow(0), 'tomorrow')).toBe(false);
    expect(isWithinRange(daysFromNow(1), 'tomorrow')).toBe(true);
    expect(isWithinRange(daysFromNow(7), 'week')).toBe(true);
    expect(isWithinRange(daysFromNow(8), 'week')).toBe(false);
    expect(isWithinRange(daysFromNow(-1), 'week')).toBe(false);
  });
});
