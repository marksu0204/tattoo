import type { Artwork } from '../types';
import { ArtworkStatus, ClaimStage } from '../types';

export type BudgetFilter = 'b10k' | 'b10k_15k' | 'b15k_20k' | 'b20k_plus';
export type SizeFilter = 's10' | 's10_15' | 's15_20' | 's20_plus';
export type ClaimFilter = 'available' | 'negotiating' | 'claimed';

export const BUDGET_OPTIONS: Array<{ value: BudgetFilter; label: string }> = [
  { value: 'b10k', label: 'NT$10,000以下' },
  { value: 'b10k_15k', label: 'NT$10,000～15,000' },
  { value: 'b15k_20k', label: 'NT$15,000～20,000' },
  { value: 'b20k_plus', label: 'NT$20,000以上' },
];

export const SIZE_OPTIONS: Array<{ value: SizeFilter; label: string }> = [
  { value: 's10', label: '10cm以下' },
  { value: 's10_15', label: '10～15cm' },
  { value: 's15_20', label: '15～20cm' },
  { value: 's20_plus', label: '20cm以上' },
];

export const CLAIM_OPTIONS: Array<{ value: ClaimFilter; label: string }> = [
  { value: 'available', label: '尚未認領' },
  { value: 'negotiating', label: '洽談中' },
  { value: 'claimed', label: '已認領' },
];

export function resolveArtworkClaimStage(art: Pick<Artwork, 'claimStage' | 'status'>): ClaimStage {
  return art.claimStage ?? (art.status === ArtworkStatus.CLAIMED ? ClaimStage.CLAIMED : ClaimStage.AVAILABLE);
}

export function isArtworkClaimedForAdmin(art: Pick<Artwork, 'claimStage' | 'status'>): boolean {
  const stage = resolveArtworkClaimStage(art);
  return stage === ClaimStage.CLAIMED || stage === ClaimStage.NEGOTIATING;
}

export function getArtworkClaimAdminLabel(art: Pick<Artwork, 'claimStage' | 'status'>): string {
  const stage = resolveArtworkClaimStage(art);
  if (stage === ClaimStage.CLAIMED) return '已認領';
  if (stage === ClaimStage.NEGOTIATING) return '洽談中';
  return '未認領';
}

const parseCsv = (raw: string | null): string[] =>
  (raw ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

const pickAllowed = <T extends string>(items: string[], allowed: readonly T[]): T[] => {
  const allowSet = new Set<string>(allowed);
  const out: T[] = [];
  for (const item of items) {
    if (!allowSet.has(item)) continue;
    out.push(item as T);
  }
  return Array.from(new Set(out));
};

export const parseBudgetFilters = (raw: string | null): BudgetFilter[] =>
  pickAllowed(raw ? parseCsv(raw) : [], BUDGET_OPTIONS.map((o) => o.value));

export const parseSizeFilters = (raw: string | null): SizeFilter[] =>
  pickAllowed(raw ? parseCsv(raw) : [], SIZE_OPTIONS.map((o) => o.value));

export const parseClaimFilters = (raw: string | null): ClaimFilter[] =>
  pickAllowed(raw ? parseCsv(raw) : [], CLAIM_OPTIONS.map((o) => o.value));

export const parsePlacementFilters = (raw: string | null): string[] => {
  if (!raw) return [];
  return Array.from(new Set(parseCsv(raw)));
};

export const toCsvParam = (values: string[]): string | null => {
  if (values.length === 0) return null;
  return values.join(',');
};

export const toggleFilterValue = (values: string[], target: string): string[] => {
  const has = values.includes(target);
  if (has) return values.filter((v) => v !== target);
  return [...values, target];
};

export const buildFilterChips = (params: {
  budgets: BudgetFilter[];
  sizes: SizeFilter[];
  claims: ClaimFilter[];
  placements: string[];
}): Array<{ key: string; label: string }> => {
  const budgetMap = new Map(BUDGET_OPTIONS.map((o) => [o.value, o.label]));
  const sizeMap = new Map(SIZE_OPTIONS.map((o) => [o.value, o.label]));
  const claimMap = new Map(CLAIM_OPTIONS.map((o) => [o.value, o.label]));
  const chips: Array<{ key: string; label: string }> = [];

  params.budgets.forEach((v) => chips.push({ key: `budget:${v}`, label: budgetMap.get(v) ?? v }));
  params.sizes.forEach((v) => chips.push({ key: `size:${v}`, label: sizeMap.get(v) ?? v }));
  params.claims.forEach((v) => chips.push({ key: `claim:${v}`, label: claimMap.get(v) ?? v }));
  params.placements.forEach((v) => chips.push({ key: `placement:${v}`, label: v }));
  return chips;
};

export const applyFilterParams = (
  query: URLSearchParams,
  next: {
    budgets?: string[];
    sizes?: string[];
    claims?: string[];
    placements?: string[];
  }
): URLSearchParams => {
  const cloned = new URLSearchParams(query);

  const budgetCsv = next.budgets ? toCsvParam(next.budgets) : cloned.get('budget');
  const sizeCsv = next.sizes ? toCsvParam(next.sizes) : cloned.get('size');
  const claimCsv = next.claims ? toCsvParam(next.claims) : cloned.get('claim');
  const placementCsv = next.placements ? toCsvParam(next.placements) : cloned.get('placement');

  if (budgetCsv) cloned.set('budget', budgetCsv); else cloned.delete('budget');
  if (sizeCsv) cloned.set('size', sizeCsv); else cloned.delete('size');
  if (claimCsv) cloned.set('claim', claimCsv); else cloned.delete('claim');
  if (placementCsv) cloned.set('placement', placementCsv); else cloned.delete('placement');

  return cloned;
};

export const hasAnyFilter = (filters: {
  budgets: string[];
  sizes: string[];
  claims: string[];
  placements: string[];
}): boolean =>
  filters.budgets.length > 0 ||
  filters.sizes.length > 0 ||
  filters.claims.length > 0 ||
  filters.placements.length > 0;
