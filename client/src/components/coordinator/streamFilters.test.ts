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
    expect(isWithinRange(new Date('2026-11-09T09:00:00'), 'today')).toBe(true);
    expect(isWithinRange(new Date('2026-11-10T09:00:00'), 'today')).toBe(false);
    expect(isWithinRange(new Date('2026-11-10T09:00:00'), 'tomorrow')).toBe(true);
    expect(isWithinRange(new Date('2026-11-14T09:00:00'), 'week')).toBe(true);
    expect(isWithinRange(new Date('2026-11-20T09:00:00'), 'week')).toBe(false);
  });
});
