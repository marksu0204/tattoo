import type {
  ArtworkTaxonomyTag,
  LineAudienceFilter,
  LineAudienceLastLoginMode,
  LineAudienceSummary,
  MemberTag,
} from '../types';

export function buildLineAudienceSummary(
  filter: LineAudienceFilter,
  subjectTags: ArtworkTaxonomyTag[],
  styleTags: ArtworkTaxonomyTag[],
  manualTags: MemberTag[],
): LineAudienceSummary {
  const lines: LineAudienceSummary['lines'] = [];

  if (filter.mode === 'all') {
    lines.push({ key: 'all', label: '全部可推播會員' });
    return { mode: 'all', lines, filter: filterToStorage(filter) };
  }

  if (filter.behavior.requireFavorites) {
    const min = filter.behavior.minFavorites > 0 ? filter.behavior.minFavorites : 1;
    lines.push({
      key: 'favorites',
      label: min > 1 ? `有收藏作品（至少 ${min} 件）` : '有收藏作品',
    });
  }

  const loginLabel = lastLoginLabel(filter.behavior.lastLoginMode);
  if (loginLabel) {
    lines.push({ key: 'lastLogin', label: loginLabel });
  }

  const subjectNames = filter.interests.subjectTagIds
    .map((id) => subjectTags.find((t) => t.id === id)?.displayName)
    .filter(Boolean) as string[];
  if (subjectNames.length > 0) {
    lines.push({ key: 'subject', label: `題材：${subjectNames.join(' OR ')}` });
  }

  const styleNames = filter.interests.styleTagIds
    .map((id) => styleTags.find((t) => t.id === id)?.displayName)
    .filter(Boolean) as string[];
  if (styleNames.length > 0) {
    lines.push({ key: 'style', label: `風格：${styleNames.join(' OR ')}` });
  }

  if (filter.manualTagIds.length > 0) {
    const manualNames = filter.manualTagIds
      .map((id) => manualTags.find((t) => t.id === id)?.name)
      .filter(Boolean) as string[];
    if (manualNames.length > 0) {
      lines.push({ key: 'manual', label: `手動標籤：${manualNames.join(' OR ')}` });
    }
  }

  if (filter.exclude?.userIds?.length) {
    lines.push({ key: 'excludeUsers', label: `指定排除會員：${filter.exclude.userIds.length} 人` });
  }
  if (filter.exclude?.tagIds?.length) {
    const excludeTagNames = filter.exclude.tagIds
      .map((id) => manualTags.find((t) => t.id === id)?.name)
      .filter(Boolean) as string[];
    if (excludeTagNames.length > 0) {
      lines.push({ key: 'excludeTags', label: `排除標籤：${excludeTagNames.join('、')}` });
    }
  }

  if (lines.length === 0) {
    lines.push({ key: 'filtered', label: '條件篩選（未指定細項）' });
  }

  return { mode: 'filtered', lines, filter: filterToStorage(filter) };
}

function filterToStorage(filter: LineAudienceFilter): LineAudienceFilter {
  const stored: LineAudienceFilter = {
    mode: filter.mode,
    behavior: { ...filter.behavior },
    interests: {
      subjectTagIds: [...filter.interests.subjectTagIds],
      styleTagIds: [...filter.interests.styleTagIds],
    },
    manualTagIds: [...filter.manualTagIds],
  };
  if (filter.exclude && (filter.exclude.userIds.length > 0 || filter.exclude.tagIds.length > 0)) {
    stored.exclude = {
      userIds: [...filter.exclude.userIds],
      tagIds: [...filter.exclude.tagIds],
    };
  }
  return stored;
}

function lastLoginLabel(mode: LineAudienceLastLoginMode): string | null {
  switch (mode) {
    case 'within_30_days':
      return '最近 30 天登入';
    case 'within_90_days':
      return '最近 90 天登入';
    case 'inactive_90_days':
      return '90 天以上未登入';
    default:
      return null;
  }
}

/** 從 API 紀錄或舊版 filter 推斷顯示文字 */
export function resolveBroadcastAudienceDisplay(
  bc: {
    audienceSummary?: LineAudienceSummary | null;
    filterType?: 'all' | 'tags';
    filterTags?: number[];
  },
  manualTags: MemberTag[] = [],
): string[] {
  if (bc.audienceSummary?.lines?.length) {
    return bc.audienceSummary.lines.map((l) => l.label);
  }
  if (bc.filterType === 'tags' && bc.filterTags?.length) {
    const names = bc.filterTags
      .map((id) => manualTags.find((t) => t.id === id)?.name ?? `#${id}`)
      .join(' OR ');
    return [`手動標籤：${names}`];
  }
  if (bc.filterType === 'all') {
    return ['舊版推播：全部會員'];
  }
  return ['舊版推播'];
}

import type { LineBroadcastImageEntry } from '../types';

const LINE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const LINE_IMAGE_ACCEPT = ['image/jpeg', 'image/png'];

export function validateBroadcastImageFile(file: File): string | null {
  if (!LINE_IMAGE_ACCEPT.includes(file.type)) {
    return 'LINE 圖片請使用 JPG 或 PNG';
  }
  if (file.size > LINE_IMAGE_MAX_BYTES) {
    return '圖片大小不可超過 10MB';
  }
  if (file.size <= 0) {
    return '無效的圖片檔案';
  }
  return null;
}

export function validateClickLinkUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '請輸入有效網址';
    }
  } catch {
    return '請輸入有效網址';
  }
  return null;
}

export type { LineBroadcastImageEntry } from '../types';

export const LINE_TEST_RECIPIENT_KEY = 'inkflow_line_test_recipient';

export type LineTestRecipient = {
  userId: string;
  displayName: string;
  lineIdMasked: string;
  pictureUrl?: string | null;
};

export function loadTestRecipient(): LineTestRecipient | null {
  try {
    const raw = localStorage.getItem(LINE_TEST_RECIPIENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.userId && parsed?.displayName) return parsed as LineTestRecipient;
  } catch {
    /* ignore */
  }
  return null;
}

export function saveTestRecipient(recipient: LineTestRecipient): void {
  localStorage.setItem(LINE_TEST_RECIPIENT_KEY, JSON.stringify(recipient));
}
