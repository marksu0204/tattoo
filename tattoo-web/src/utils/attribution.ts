import { getAnalyticsSessionId } from './analyticsSession';

export type AttributionData = {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  metaCampaignId?: string;
  metaAdsetId?: string;
  metaAdId?: string;
};

export type AttributionTouchMeta = {
  touchAt?: string;
  landingPath?: string;
  referrerHost?: string;
};

type StoredAttributionBundle = AttributionData & AttributionTouchMeta;

export const ATTRIBUTION_SESSION_KEY = 'inkflow_utm';

type AttributionField = { key: keyof AttributionData; queryKey: string };

const UTM_FIELDS: AttributionField[] = [
  { key: 'source', queryKey: 'utm_source' },
  { key: 'medium', queryKey: 'utm_medium' },
  { key: 'campaign', queryKey: 'utm_campaign' },
  { key: 'content', queryKey: 'utm_content' },
  { key: 'term', queryKey: 'utm_term' },
];

const META_FIELDS: AttributionField[] = [
  { key: 'metaCampaignId', queryKey: 'meta_campaign_id' },
  { key: 'metaAdsetId', queryKey: 'meta_adset_id' },
  { key: 'metaAdId', queryKey: 'meta_ad_id' },
];

const ATTRIBUTION_FIELDS: AttributionField[] = [...UTM_FIELDS, ...META_FIELDS];

const cleanValue = (value: string | null): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const pickFieldsFromParams = (params: URLSearchParams, fields: AttributionField[]): AttributionData => {
  const result: AttributionData = {};
  for (const field of fields) {
    const value = cleanValue(params.get(field.queryKey));
    if (value) result[field.key] = value;
  }
  return result;
};

const pickFields = (data: AttributionData, fields: AttributionField[]): AttributionData => {
  const result: AttributionData = {};
  for (const field of fields) {
    const value = cleanValue(typeof data[field.key] === 'string' ? data[field.key] : null);
    if (value) result[field.key] = value;
  }
  return result;
};

const readHashSearchParams = (): URLSearchParams => {
  const hash = window.location.hash || '';
  const queryIndex = hash.indexOf('?');
  if (queryIndex < 0) return new URLSearchParams();
  return new URLSearchParams(hash.slice(queryIndex + 1));
};

const mergeFieldGroups = (primary: AttributionData, fallback: AttributionData, fields: AttributionField[]): AttributionData => {
  const merged: AttributionData = { ...fallback, ...primary };
  return pickFields(merged, fields);
};

const hasAnyField = (data: AttributionData, fields: AttributionField[]): boolean => {
  return fields.some((field) => Boolean(data[field.key]));
};

const parseReferrerHost = (referrer: string): string | undefined => {
  if (!referrer.trim()) return undefined;
  try {
    return new URL(referrer).hostname || undefined;
  } catch {
    return undefined;
  }
};

const readStoredBundle = (): StoredAttributionBundle => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.sessionStorage.getItem(ATTRIBUTION_SESSION_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredAttributionBundle;
    if (!parsed || typeof parsed !== 'object') return {};
    return {
      ...pickFields(parsed, ATTRIBUTION_FIELDS),
      touchAt: typeof parsed.touchAt === 'string' ? parsed.touchAt : undefined,
      landingPath: typeof parsed.landingPath === 'string' ? parsed.landingPath : undefined,
      referrerHost: typeof parsed.referrerHost === 'string' ? parsed.referrerHost : undefined,
    };
  } catch {
    return {};
  }
};

const persistStoredBundle = (bundle: StoredAttributionBundle): void => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(ATTRIBUTION_SESSION_KEY, JSON.stringify(bundle));
  } catch {
    // ignore storage failure
  }
};

export const readUtmFromLocation = (): AttributionData => {
  if (typeof window === 'undefined') return {};
  const searchData = pickFieldsFromParams(new URLSearchParams(window.location.search), ATTRIBUTION_FIELDS);
  const hashData = pickFieldsFromParams(readHashSearchParams(), ATTRIBUTION_FIELDS);
  return {
    ...mergeFieldGroups(searchData, hashData, UTM_FIELDS),
    ...mergeFieldGroups(searchData, hashData, META_FIELDS),
  };
};

export const getStoredAttribution = (): AttributionData => {
  return pickFields(readStoredBundle(), ATTRIBUTION_FIELDS);
};

/**
 * Session-level attribution:
 * - UTM: latest URL params merge into stored (existing behavior)
 * - Meta IDs: first-touch within session (stored meta IDs win once set)
 */
export const captureUtmParams = (): AttributionData => {
  if (typeof window === 'undefined') return {};
  const fromLocation = readUtmFromLocation();
  const stored = readStoredBundle();

  const utmMerged = hasAnyField(fromLocation, UTM_FIELDS)
    ? mergeFieldGroups(fromLocation, stored, UTM_FIELDS)
    : pickFields(stored, UTM_FIELDS);

  const storedMeta = pickFields(stored, META_FIELDS);
  const locationMeta = pickFields(fromLocation, META_FIELDS);
  const metaMerged = hasAnyField(storedMeta, META_FIELDS) ? storedMeta : locationMeta;

  const merged: AttributionData = { ...utmMerged, ...metaMerged };
  const hasMarketing = hasAnyField(merged, ATTRIBUTION_FIELDS);
  const bundle: StoredAttributionBundle = {
    ...merged,
    touchAt: stored.touchAt ?? (hasMarketing ? new Date().toISOString() : undefined),
    landingPath: stored.landingPath ?? (hasMarketing ? window.location.pathname : undefined),
    referrerHost: stored.referrerHost ?? (hasMarketing ? parseReferrerHost(document.referrer) : undefined),
  };

  if (hasMarketing || bundle.touchAt) {
    persistStoredBundle(bundle);
  }

  return merged;
};

export const toUtmEventPayload = (data: AttributionData): Record<string, string> => {
  const payload: Record<string, string> = {};
  if (data.source) payload.utm_source = data.source;
  if (data.medium) payload.utm_medium = data.medium;
  if (data.campaign) payload.utm_campaign = data.campaign;
  if (data.content) payload.utm_content = data.content;
  if (data.term) payload.utm_term = data.term;
  if (data.metaCampaignId) payload.meta_campaign_id = data.metaCampaignId;
  if (data.metaAdsetId) payload.meta_adset_id = data.metaAdsetId;
  if (data.metaAdId) payload.meta_ad_id = data.metaAdId;
  return payload;
};

/** Analytics-only context for syncUser acquisition attribution (never auth). */
export const buildAcquisitionContextForSync = (): Record<string, unknown> | null => {
  if (typeof window === 'undefined') return null;

  const bundle = readStoredBundle();
  const attribution = pickFields(bundle, ATTRIBUTION_FIELDS);
  const sessionId = getAnalyticsSessionId();

  return {
    sessionId,
    touchAt: bundle.touchAt,
    landingPath: bundle.landingPath,
    referrerHost: bundle.referrerHost,
    attribution,
  };
};
