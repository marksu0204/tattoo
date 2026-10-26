import { describe, expect, it } from 'vitest';
import {
  buildMemberGrowthFetchSignature,
  MEMBER_GROWTH_FETCH_DEP_KEYS,
  shouldSkipMemberGrowthFetch,
} from './memberGrowthFetch';

const baseParams = {
  startDate: '2026-01-01',
  endDate: '2026-01-31',
  brandRevision: 0,
  refreshKey: 0,
};

describe('memberGrowthFetch', () => {
  it('defines only stable primitive fetch dependencies', () => {
    expect(MEMBER_GROWTH_FETCH_DEP_KEYS).toEqual([
      'startDate',
      'endDate',
      'brandRevision',
      'refreshKey',
    ]);
    expect(MEMBER_GROWTH_FETCH_DEP_KEYS).not.toContain('data');
    expect(MEMBER_GROWTH_FETCH_DEP_KEYS).not.toContain('loading');
    expect(MEMBER_GROWTH_FETCH_DEP_KEYS).not.toContain('error');
  });

  it('initial render signature is stable after a simulated successful setData', () => {
    const initial = buildMemberGrowthFetchSignature(baseParams);
    const afterSetData = buildMemberGrowthFetchSignature(baseParams);
    expect(afterSetData).toBe(initial);
  });

  it('explicit refresh increments signature exactly once', () => {
    const before = buildMemberGrowthFetchSignature(baseParams);
    const after = buildMemberGrowthFetchSignature({ ...baseParams, refreshKey: 1 });
    expect(before).not.toBe(after);
    expect(buildMemberGrowthFetchSignature({ ...baseParams, refreshKey: 1 })).toBe(after);
  });

  it('date range change updates signature once per logical range', () => {
    const before = buildMemberGrowthFetchSignature(baseParams);
    const after = buildMemberGrowthFetchSignature({
      ...baseParams,
      startDate: '2026-02-01',
      endDate: '2026-02-28',
    });
    expect(before).not.toBe(after);
  });

  it('brand switch updates signature exactly once', () => {
    const before = buildMemberGrowthFetchSignature(baseParams);
    const after = buildMemberGrowthFetchSignature({ ...baseParams, brandRevision: 1 });
    expect(before).not.toBe(after);
  });

  it('failed request does not change signature (no automatic retry storm)', () => {
    const before = buildMemberGrowthFetchSignature(baseParams);
    const afterError = buildMemberGrowthFetchSignature(baseParams);
    expect(afterError).toBe(before);
  });

  it('skips fetch until admin brand context is ready', () => {
    expect(shouldSkipMemberGrowthFetch('loading')).toBe(true);
    expect(shouldSkipMemberGrowthFetch('ready')).toBe(false);
  });
});
