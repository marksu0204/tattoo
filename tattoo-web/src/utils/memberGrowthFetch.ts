export type MemberGrowthFetchParams = {
  startDate: string;
  endDate: string;
  brandRevision: number;
  refreshKey: number;
};

/** Primitive keys that may trigger a Member Growth API refetch. */
export const MEMBER_GROWTH_FETCH_DEP_KEYS = [
  'startDate',
  'endDate',
  'brandRevision',
  'refreshKey',
] as const;

export function buildMemberGrowthFetchSignature(params: MemberGrowthFetchParams): string {
  return `${params.startDate}\0${params.endDate}\0${params.brandRevision}\0${params.refreshKey}`;
}

export function shouldSkipMemberGrowthFetch(adminBrandStatus: string): boolean {
  return adminBrandStatus !== 'ready';
}
