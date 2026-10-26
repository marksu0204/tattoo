import type { ArtworkTagGroup, ArtworkTaxonomyTag, ArtworkTaxonomyCatalogResponse } from '../types';

export const ARTWORK_TAG_GROUP_LABELS: Record<ArtworkTagGroup, string> = {
  subject: '題材',
  style: '風格',
  format: '作品形式',
  campaign: '企劃',
};

export const ARTWORK_TAG_GROUPS: ArtworkTagGroup[] = ['subject', 'style', 'format', 'campaign'];

export interface ArtworkTaxonomyCatalog {
  groups: Record<ArtworkTagGroup, string>;
  tagsByGroup: Record<ArtworkTagGroup, ArtworkTaxonomyTag[]>;
  tags: ArtworkTaxonomyTag[];
}

export type ArtworkTaxonomyCatalogLike = ArtworkTaxonomyCatalog | ArtworkTaxonomyCatalogResponse;

export const parseTaxonomyTagIds = (raw: string | null): number[] => {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((v) => Number(v.trim()))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  );
};

export const toTaxonomyParam = (tagIds: number[]): string | null => {
  if (tagIds.length === 0) return null;
  return tagIds.join(',');
};

export const toggleTaxonomyTagId = (selected: number[], tagId: number): number[] => {
  if (selected.includes(tagId)) return selected.filter((id) => id !== tagId);
  return [...selected, tagId];
};

export const buildTaxonomyFilterLabel = (
  selectedTagIds: number[],
  catalog: ArtworkTaxonomyCatalogLike | null
): string => {
  if (selectedTagIds.length === 0) return '分類';
  if (!catalog) return `分類 ●${selectedTagIds.length}`;
  const names = selectedTagIds
    .map((id) => catalog.tags.find((tag) => tag.id === id)?.displayName)
    .filter(Boolean) as string[];
  if (names.length === 0) return `分類 ●${selectedTagIds.length}`;
  if (names.length <= 2) return names.join('、');
  return `${names.slice(0, 2).join('、')} +${names.length - 2}`;
};

export const deriveLegacyCategoryFromTags = (
  selectedTagIds: number[],
  catalog: ArtworkTaxonomyCatalogLike | null,
  fallback = '未分類'
): string => {
  if (!catalog || selectedTagIds.length === 0) return fallback;
  const subjectTag = catalog.tags.find(
    (tag) => tag.groupKey === 'subject' && selectedTagIds.includes(tag.id)
  );
  if (subjectTag) return subjectTag.displayName;
  const firstTag = catalog.tags.find((tag) => selectedTagIds.includes(tag.id));
  return firstTag?.displayName || fallback;
};

export const emptyTaxonomyCatalog = (): ArtworkTaxonomyCatalog => ({
  groups: { ...ARTWORK_TAG_GROUP_LABELS },
  tagsByGroup: {
    subject: [],
    style: [],
    format: [],
    campaign: [],
  },
  tags: [],
});

/** 前台 Category Filter：只顯示 active 且有 artwork 使用的 tag */
export const isGalleryVisibleTaxonomyTag = (tag: ArtworkTaxonomyTag): boolean =>
  tag.isActive && (tag.usageCount ?? 0) > 0;

/** 依 usageCount 過濾前台可見 tags；空 group 自動省略；sort_order 維持 API 順序 */
export const filterGalleryVisibleTaxonomy = (
  catalog: ArtworkTaxonomyCatalogLike
): ArtworkTaxonomyCatalog => {
  const tagsByGroup = ARTWORK_TAG_GROUPS.reduce((acc, groupKey) => {
    acc[groupKey] = (catalog.tagsByGroup[groupKey] ?? []).filter(isGalleryVisibleTaxonomyTag);
    return acc;
  }, {} as Record<ArtworkTagGroup, ArtworkTaxonomyTag[]>);

  return {
    groups: catalog.groups,
    tagsByGroup,
    tags: ARTWORK_TAG_GROUPS.flatMap((groupKey) => tagsByGroup[groupKey]),
  };
};
