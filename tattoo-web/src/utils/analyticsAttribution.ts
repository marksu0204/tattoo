import type { AnalyticsLabelFields, AnalyticsV2BookingMetrics, AnalyticsV2ChannelLead, AnalyticsV2ChannelLeads, AnalyticsV2ContentRow, AnalyticsV2Funnel, AnalyticsV2SourceRow } from '../types';

export const ANALYTICS_MIN_SAMPLE_SESSIONS = 5;
export const ANALYTICS_FUNNEL_MIN_SAMPLE_SESSIONS = 10;

export type AttributionSortKey = 'views' | 'inquiry' | 'inquiryRate' | 'favoriteRate' | 'sessions' | 'leadSessions' | 'leadRate' | 'viewToLeadRate' | 'bookingSessions' | 'bookingRate';

export type ArtworkConversionSortKey = 'viewSessions' | 'leadSessions' | 'viewToLeadRate' | 'bookingStartSessions' | 'bookingCompleteSessions' | 'bookingRate';

export type SourcePresentation = {
  label: string;
  isDirect: boolean;
  isKnown: boolean;
};

const KNOWN_SOURCE_DISPLAY: Record<string, string> = {
  direct: 'Direct',
  facebook: 'Facebook',
  instagram: 'Instagram',
  threads: 'Threads',
  google: 'Google',
};

const normalizeNullable = (value: string | null | undefined): string => (value ?? '').trim();

export const normalizeAnalyticsSourceKey = (rawSource: string): string => {
  const trimmed = normalizeNullable(rawSource);
  if (trimmed === '') return 'direct';
  const lower = trimmed.toLowerCase();
  if (lower === 'direct') return 'direct';
  if (lower === 'fb' || lower === 'facebook') return 'facebook';
  if (lower === 'ig' || lower === 'instagram') return 'instagram';
  if (lower === 'th' || lower === 'threads') return 'threads';
  return lower;
};

export const getNormalizedSourceDisplay = (sourceKey: string): string => {
  return KNOWN_SOURCE_DISPLAY[sourceKey] ?? sourceKey;
};

export const sourcesMatchNormalizedFilter = (rawSource: string, normalizedFilter: string): boolean =>
  normalizeAnalyticsSourceKey(rawSource) === normalizedFilter;

export const formatSourceRawSources = (rawSources: string[]): string =>
  rawSources.join(' · ');

export const getSourceLabelRawValue = (row: { rawSources?: string[]; source: string }): string =>
  row.rawSources?.[0] ?? row.source;

export const getSourcePresentation = (source: string): SourcePresentation => {
  const key = normalizeAnalyticsSourceKey(source);
  if (key === 'direct') {
    return {
      label: 'Direct',
      isDirect: true,
      isKnown: true,
    };
  }
  if (KNOWN_SOURCE_DISPLAY[key]) {
    return {
      label: KNOWN_SOURCE_DISPLAY[key],
      isDirect: false,
      isKnown: true,
    };
  }
  return {
    label: source.trim() || source,
    isDirect: false,
    isKnown: false,
  };
};

export const makeSourceKey = (source: string): string => normalizeAnalyticsSourceKey(source);

export const makeCampaignKey = (source: string, campaign: string | null): string => {
  return `${makeSourceKey(source)}::${normalizeNullable(campaign).toLowerCase()}`;
};

export const makeContentKey = (source: string, campaign: string | null, content: string | null): string => {
  return `${makeCampaignKey(source, campaign)}::${normalizeNullable(content).toLowerCase()}`;
};

export type BestPerformerResult<T> = {
  winner: T | null;
  insufficientSample: boolean;
};

type PerformerLike = {
  leadRate?: number;
  sessionContactRate: number;
  leadSessions?: number;
  uniqueContactSessions: number;
  sessions?: number;
  uniqueViewSessions: number;
};

export const findBestPerformer = <T extends PerformerLike>(rows: T[]): BestPerformerResult<T> => {
  const candidates = rows.filter((row) => (row.sessions ?? row.uniqueViewSessions) >= ANALYTICS_FUNNEL_MIN_SAMPLE_SESSIONS);
  if (candidates.length === 0) {
    return { winner: null, insufficientSample: true };
  }
  const winner = [...candidates].sort((a, b) => {
    const rateA = a.leadRate ?? a.sessionContactRate;
    const rateB = b.leadRate ?? b.sessionContactRate;
    if (rateB !== rateA) return rateB - rateA;
    const leadA = a.leadSessions ?? a.uniqueContactSessions;
    const leadB = b.leadSessions ?? b.uniqueContactSessions;
    if (leadB !== leadA) return leadB - leadA;
    return (b.sessions ?? b.uniqueViewSessions) - (a.sessions ?? a.uniqueViewSessions);
  })[0];
  return { winner, insufficientSample: false };
};

export const isFunnelLowSample = (sessions: number): boolean => sessions < ANALYTICS_FUNNEL_MIN_SAMPLE_SESSIONS;

export const normalizeAnalyticsConversionFields = (
  row: {
    sessions?: number;
    viewSessions?: number;
    leadSessions?: number;
    viewRate?: number;
    leadRate?: number;
    viewToLeadRate?: number;
    uniqueViewSessions?: number;
    uniqueContactSessions?: number;
    bookingCompleteSessions?: number;
    bookingRate?: number;
  }
) => {
  const viewSessions = row.viewSessions ?? row.uniqueViewSessions ?? 0;
  const leadSessions = row.leadSessions ?? row.uniqueContactSessions ?? 0;
  const sessions = row.sessions ?? viewSessions;
  const viewRate = row.viewRate ?? (sessions > 0 ? viewSessions / sessions : 0);
  const leadRate = row.leadRate ?? (sessions > 0 ? leadSessions / sessions : 0);
  const viewToLeadRate = row.viewToLeadRate ?? (viewSessions > 0 ? leadSessions / viewSessions : 0);
  const bookingFields = normalizeAnalyticsAttributionBookingFields({ sessions, ...row });
  return { sessions, viewSessions, leadSessions, viewRate, leadRate, viewToLeadRate, ...bookingFields };
};

export const normalizeAnalyticsArtworkConversionFields = (
  row: {
    viewSessions?: number;
    leadSessions?: number;
    viewToLeadRate?: number;
    uniqueViewSessions?: number;
    uniqueContactSessions?: number;
    bookingStartSessions?: number;
    bookingCompleteSessions?: number;
    bookingRate?: number;
  }
) => {
  const viewSessions = row.viewSessions ?? row.uniqueViewSessions ?? 0;
  const leadSessions = row.leadSessions ?? row.uniqueContactSessions ?? 0;
  const viewToLeadRate = row.viewToLeadRate ?? (viewSessions > 0 ? leadSessions / viewSessions : 0);
  const bookingStartSessions = row.bookingStartSessions ?? 0;
  const bookingCompleteSessions = row.bookingCompleteSessions ?? 0;
  const bookingRate = row.bookingRate ?? (viewSessions > 0 ? bookingCompleteSessions / viewSessions : 0);
  return { viewSessions, leadSessions, viewToLeadRate, bookingStartSessions, bookingCompleteSessions, bookingRate };
};

export const normalizeAnalyticsAttributionBookingFields = (
  row: {
    sessions?: number;
    bookingCompleteSessions?: number;
    bookingRate?: number;
  }
) => {
  const bookingCompleteSessions = row.bookingCompleteSessions ?? 0;
  const sessions = row.sessions ?? 0;
  const bookingRate = row.bookingRate ?? (sessions > 0 ? bookingCompleteSessions / sessions : 0);
  return { bookingCompleteSessions, bookingRate };
};

export const normalizeAnalyticsBooking = (
  booking?: Partial<AnalyticsV2BookingMetrics> | null,
  trackedSessionsFallback = 0
): AnalyticsV2BookingMetrics => {
  const trackedSessions = booking?.trackedSessions ?? trackedSessionsFallback;
  const startSessions = booking?.startSessions ?? 0;
  const completeSessions = booking?.completeSessions ?? 0;
  return {
    trackedSessions,
    startSessions,
    dateSelectedSessions: booking?.dateSelectedSessions ?? 0,
    timeSelectedSessions: booking?.timeSelectedSessions ?? 0,
    submitSessions: booking?.submitSessions ?? 0,
    completeSessions,
    lineClickSessions: booking?.lineClickSessions ?? 0,
    startToCompleteRate: booking?.startToCompleteRate ?? (startSessions > 0 ? completeSessions / startSessions : 0),
    bookingConversionRate: booking?.bookingConversionRate ?? (trackedSessions > 0 ? completeSessions / trackedSessions : 0),
  };
};

export const normalizeAnalyticsFunnel = (
  funnel?: Partial<AnalyticsV2Funnel> | null
): AnalyticsV2Funnel => {
  const totalSessions = funnel?.totalSessions ?? 0;
  const viewSessions = funnel?.viewSessions ?? 0;
  const leadSessions = funnel?.leadSessions ?? 0;
  return {
    totalSessions,
    viewSessions,
    leadSessions,
    viewRate: funnel?.viewRate ?? (totalSessions > 0 ? viewSessions / totalSessions : 0),
    leadConversionRate: funnel?.leadConversionRate ?? (totalSessions > 0 ? leadSessions / totalSessions : 0),
    viewToLeadRate: funnel?.viewToLeadRate ?? (viewSessions > 0 ? leadSessions / viewSessions : 0),
  };
};

export const normalizeAnalyticsChannelLeads = (
  channelLeads?: Partial<AnalyticsV2ChannelLeads> | null
): AnalyticsV2ChannelLeads => {
  const totalLeadSessions = channelLeads?.totalLeadSessions ?? 0;
  const defaults: AnalyticsV2ChannelLead[] = [
    { channel: 'line', leadSessions: 0, leadSessionTriggerRate: 0 },
    { channel: 'instagram', leadSessions: 0, leadSessionTriggerRate: 0 },
    { channel: 'other', leadSessions: 0, leadSessionTriggerRate: 0 },
  ];
  const channels = defaults.map((item) => {
    const found = channelLeads?.channels?.find((c) => c.channel === item.channel);
    if (!found) return item;
    const leadSessions = found.leadSessions ?? 0;
    const legacyShare = (found as { share?: number }).share;
    const leadSessionTriggerRate = found.leadSessionTriggerRate
      ?? legacyShare
      ?? (totalLeadSessions > 0 ? leadSessions / totalLeadSessions : 0);
    return {
      channel: found.channel,
      leadSessions,
      leadSessionTriggerRate,
    };
  });
  return { totalLeadSessions, channels };
};

const percentile = (values: number[], p: number): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

export type PerformanceTag = 'high_potential' | 'high_traffic_low_inquiry' | 'low_sample';

export const getContentPerformanceTags = (
  row: AnalyticsV2ContentRow,
  context: {
    overallSessionContactRate: number;
    p75ViewSessions: number;
    p75SessionContactRate: number;
  }
): PerformanceTag[] => {
  const tags: PerformanceTag[] = [];
  if (row.uniqueViewSessions < ANALYTICS_MIN_SAMPLE_SESSIONS) {
    tags.push('low_sample');
    return tags;
  }

  if (
    row.sessionContactRate >= context.p75SessionContactRate &&
    row.uniqueContactSessions > 0
  ) {
    tags.push('high_potential');
  }

  if (
    row.uniqueViewSessions >= context.p75ViewSessions &&
    row.sessionContactRate < context.overallSessionContactRate
  ) {
    tags.push('high_traffic_low_inquiry');
  }

  return tags;
};

export const buildContentTagContext = (rows: AnalyticsV2ContentRow[], overallSessionContactRate: number) => {
  const eligible = rows.filter((row) => row.uniqueViewSessions >= ANALYTICS_MIN_SAMPLE_SESSIONS);
  const viewSessions = eligible.map((row) => row.uniqueViewSessions);
  const sessionRates = eligible.map((row) => row.sessionContactRate);
  return {
    overallSessionContactRate,
    p75ViewSessions: percentile(viewSessions, 0.75),
    p75SessionContactRate: percentile(sessionRates, 0.75),
  };
};

export const sortSourceRows = (
  rows: AnalyticsV2SourceRow[],
  sortBy: AttributionSortKey
) => {
  const next = [...rows];
  next.sort((a, b) => {
    if (sortBy === 'sessions') return b.sessions - a.sessions;
    if (sortBy === 'leadSessions') return b.leadSessions - a.leadSessions;
    if (sortBy === 'leadRate') return b.leadRate - a.leadRate;
    if (sortBy === 'viewToLeadRate') return b.viewToLeadRate - a.viewToLeadRate;
    if (sortBy === 'views') return b.views - a.views;
    if (sortBy === 'inquiry') return b.leadSessions - a.leadSessions;
    if (sortBy === 'inquiryRate') return b.leadRate - a.leadRate;
    if (sortBy === 'bookingSessions') return b.bookingCompleteSessions - a.bookingCompleteSessions;
    if (sortBy === 'bookingRate') return b.bookingRate - a.bookingRate;
    return b.sessionFavoriteRate - a.sessionFavoriteRate;
  });
  return next;
};

export const sortAttributionRows = <T extends {
  views: number;
  sessions: number;
  leadSessions: number;
  leadRate: number;
  viewToLeadRate: number;
  uniqueContactSessions: number;
  sessionContactRate: number;
  sessionFavoriteRate: number;
  bookingCompleteSessions?: number;
  bookingRate?: number;
}>(
  rows: T[],
  sortBy: AttributionSortKey
) => {
  const next = [...rows];
  next.sort((a, b) => {
    if (sortBy === 'sessions') return b.sessions - a.sessions;
    if (sortBy === 'leadSessions') return b.leadSessions - a.leadSessions;
    if (sortBy === 'leadRate') return b.leadRate - a.leadRate;
    if (sortBy === 'viewToLeadRate') return b.viewToLeadRate - a.viewToLeadRate;
    if (sortBy === 'views') return b.views - a.views;
    if (sortBy === 'inquiry') return b.leadSessions - a.leadSessions;
    if (sortBy === 'inquiryRate') return b.leadRate - a.leadRate;
    if (sortBy === 'bookingSessions') return (b.bookingCompleteSessions ?? 0) - (a.bookingCompleteSessions ?? 0);
    if (sortBy === 'bookingRate') return (b.bookingRate ?? 0) - (a.bookingRate ?? 0);
    return b.sessionFavoriteRate - a.sessionFavoriteRate;
  });
  return next;
};

export const toCampaignDisplayName = (campaign: string | null): string => {
  const text = normalizeNullable(campaign);
  return text ? text : '未設定 Campaign';
};

export const toContentDisplayName = (content: string | null): string => {
  const text = normalizeNullable(content);
  return text ? text : '未設定 Content';
};

export type AnalyticsLabelDimension = 'source' | 'campaign' | 'content';

export const toAnalyticsLabelRawValue = (
  dimension: AnalyticsLabelDimension,
  value: string | null | undefined
): string => normalizeNullable(value);

export const getAnalyticsPrimaryName = (
  dimension: AnalyticsLabelDimension,
  row: { displayName: string | null; isLabeled: boolean; source: string; rawSources?: string[]; campaign?: string | null; content?: string | null }
): string => {
  if (row.isLabeled && row.displayName) return row.displayName;
  if (dimension === 'source') return getNormalizedSourceDisplay(normalizeAnalyticsSourceKey(row.source));
  if (dimension === 'campaign') {
    const value = row.campaign ?? '';
    return value.trim() !== '' ? value : '未設定 Campaign';
  }
  const value = row.content ?? '';
  return value.trim() !== '' ? value : '未設定 Content';
};

export const normalizeAnalyticsLabelFields = (
  dimension: AnalyticsLabelDimension,
  row: { source?: string; campaign?: string | null; content?: string | null; displayName?: string | null; note?: string | null; isLabeled?: boolean }
): AnalyticsLabelFields => {
  if (typeof row.isLabeled === 'boolean') {
    return {
      displayName: row.displayName ?? null,
      note: row.note ?? null,
      isLabeled: row.isLabeled,
    };
  }
  const rawValue = dimension === 'source'
    ? (row.source ?? '')
    : dimension === 'campaign'
      ? (row.campaign ?? '')
      : (row.content ?? '');
  return {
    displayName: rawValue === '' ? null : rawValue,
    note: null,
    isLabeled: false,
  };
};

export const formatAnalyticsRawSubtitle = (
  dimension: AnalyticsLabelDimension,
  rawValue: string
): string => {
  if (dimension === 'source') return rawValue;
  return rawValue.trim() !== '' ? rawValue : '(未設定)';
};

