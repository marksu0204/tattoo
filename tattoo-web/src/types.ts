
import type { AttributionData } from './utils/attribution';

// Replace with your actual LINE ID (without @)
export const LINE_ID = '270vwddw';

// Define types using interfaces/types instead of enums to avoid build errors
export const ArtworkStatus = {
  AVAILABLE: 'AVAILABLE',
  CLAIMED: 'CLAIMED',
} as const;
export type ArtworkStatus = typeof ArtworkStatus[keyof typeof ArtworkStatus];

export const ClaimStage = {
  AVAILABLE: 'AVAILABLE',
  NEGOTIATING: 'NEGOTIATING',
  CLAIMED: 'CLAIMED',
} as const;
export type ClaimStage = typeof ClaimStage[keyof typeof ClaimStage];

export type ArtworkTagGroup = 'subject' | 'style' | 'format' | 'campaign';

export interface ArtworkTaxonomyTag {
  id: number;
  groupKey: ArtworkTagGroup;
  tagKey: string;
  displayName: string;
  sortOrder: number;
  isActive: boolean;
  usageCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ArtworkTaxonomyCatalogResponse {
  groups: Record<ArtworkTagGroup, string>;
  tagsByGroup: Record<ArtworkTagGroup, ArtworkTaxonomyTag[]>;
  tags: ArtworkTaxonomyTag[];
}

export interface AdminContextBrand {
  code: string;
  name: string;
  isActive: boolean;
  publicOrigin: string;
  primaryColor: string;
  accentColor: string;
}

export interface AdminContextResponse {
  admin: {
    id: number;
    email: string;
    displayName: string;
    isSuperAdmin: boolean;
  };
  accessibleBrands: AdminContextBrand[];
  currentBrand: AdminContextBrand;
}

/** SUPER_ADMIN brand presentation settings (Phase 4D-A). */
export interface AdminBrandPresentation {
  code: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  instagramUrl: string | null;
  lineUrl: string | null;
  seoSiteName: string;
  seoDefaultDescription: string;
  regionLabel: string | null;
  isActive: boolean;
}

export interface AdminUserBrandSummary {
  code: string;
  name: string;
  isActive: boolean;
}

export interface AdminUserListItem {
  id: number;
  email: string;
  displayName: string;
  isSuperAdmin: boolean;
  isActive: boolean;
  accessibleBrands: AdminUserBrandSummary[];
  createdAt: string;
}

export const UserRole = {
  GUEST: 'GUEST',
  MEMBER: 'MEMBER', // Logged in via LINE
  ADMIN: 'ADMIN',
} as const;
export type UserRole = typeof UserRole[keyof typeof UserRole];

export interface Artwork {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  cardImageUrl?: string;
  imageUrls?: string[]; // 最多3張圖片 URL，第一張同 imageUrl
  pngUrl?: string; // 去背 PNG 檔案，用於刺青預覽功能
  category: string;
  isNew?: boolean;
  status: ArtworkStatus;
  claimStage?: ClaimStage;
  taxonomyTags?: ArtworkTaxonomyTag[];
  tagIds?: number[];
  price?: number; // Original Price
  specialPrice?: number; // Sale Price
  widthCm?: number; // 建議寬度（公分）
  heightCm?: number; // 建議高度（公分）
  sizeNote?: string; // 尺寸補充說明
  recommendedPlacements?: string[]; // 建議施作部位（顯示用標籤）
  recommendedPlacementKeys?: string[]; // 標準化 semantic keys（Admin / API）
  legacyRecommendedPlacements?: string[]; // 無法對應的舊自由文字
  createdAt: string;
  tags: string[];
  viewCount?: number; // 瀏覽次數
}

export interface User {
  id: string;
  name: string;
  avatarUrl?: string;
  role: UserRole;
  email?: string;
  lineUserId?: string;
  favorites?: string[]; // Array of Artwork IDs
}

export interface MemberTag {
  id: number;
  name: string;
  color: string;
  userCount: number;
}

export interface LineBroadcast {
  id: number;
  title: string;
  content: string;
  imageUrl?: string;
  imageUrls?: string[];
  carouselSnapshot?: LineCarouselItem[] | null;
  carouselTrackingAvailable?: boolean;
  filterType: 'all' | 'tags';
  filterTags: number[];
  sentAt: string;
  totalCount: number;
  /** Unique clickers (distinct recipients who clicked at least once) */
  clickCount: number;
  /** Total click events across all recipients */
  totalClicks?: number;
  uniqueClickers?: number;
  openRate: number;
  broadcastType?: 'CAMPAIGN' | 'TEST';
  audienceSummary?: LineAudienceSummary | null;
  audienceFilter?: LineAudienceFilter | null;
  messages?: LineBroadcastMessageBlock[] | null;
  successCount?: number;
  failureCount?: number;
  sendStatus?: 'pending' | 'completed' | 'partial' | 'failed';
}

export interface LineBroadcastDetail extends LineBroadcast {
  recipientTotal?: number;
  recipientOffset?: number;
  recipientLimit?: number;
  carouselAnalytics?: LineCarouselAnalyticsItem[] | null;
  recipients: Array<{
    userId: string;
    userName: string;
    avatarUrl?: string;
    lineIdMasked?: string;
    clicked: boolean;
    clickedAt?: string;
    sendStatus?: 'sent' | 'failed';
  }>;
}

export type LineAudienceMode = 'all' | 'filtered';

export type LineAudienceLastLoginMode =
  | 'any'
  | 'within_30_days'
  | 'within_90_days'
  | 'inactive_90_days';

export interface LineAudiencePreviewRecipient {
  userId: string;
  displayName: string;
  pictureUrl?: string | null;
  lineIdMasked?: string;
  favoriteCount: number;
  lastLogin?: string | null;
  matchedTags: string[];
}

export interface LineAudienceFilter {
  mode: LineAudienceMode;
  behavior: {
    requireFavorites: boolean;
    minFavorites: 0 | 1 | 3 | 5;
    lastLoginMode: LineAudienceLastLoginMode;
  };
  interests: {
    subjectTagIds: number[];
    styleTagIds: number[];
  };
  manualTagIds: number[];
  exclude?: {
    userIds: string[];
    tagIds: number[];
  };
}

export interface LineAudiencePreviewResponse {
  totalEligible: number;
  matchedCount: number;
  excludedCount: number;
  finalCount: number;
  recipients: LineAudiencePreviewRecipient[];
}

export interface LineAudienceSummaryLine {
  key: string;
  label: string;
}

export interface LineAudienceSummary {
  mode: 'all' | 'filtered' | 'test';
  lines: LineAudienceSummaryLine[];
  filter?: LineAudienceFilter;
}

export interface LineBroadcastSendResult {
  success: boolean;
  partial?: boolean;
  duplicate?: boolean;
  broadcastId?: number;
  totalCount?: number;
  successCount?: number;
  failureCount?: number;
  sendStatus?: 'pending' | 'completed' | 'partial' | 'failed';
  sentAt?: string;
  errors?: string[];
  code?: string;
  message?: string;
  lineHttpStatus?: number;
  previousCount?: number;
  currentCount?: number;
  error?: string;
}

export interface LineBroadcastTestSendResult {
  success: boolean;
  broadcastId?: number;
  recipientName?: string;
  recipientMaskedId?: string;
  sentAt?: string;
  errors?: string[];
  code?: string;
  message?: string;
  lineHttpStatus?: number;
}

export interface LineBroadcastImageEntry {
  originalUrl: string;
  previewUrl: string;
}

export type LineBroadcastMessageBlock =
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'image';
      imageUrl: string;
      previewImageUrl?: string;
    }
  | {
      type: 'carousel';
      items: LineCarouselItem[];
    };

export interface LineCarouselItem {
  id: string;
  originalUrl: string;
  previewUrl: string;
  targetUrl?: string;
  label?: string;
  order?: number;
}

export interface LineCarouselAnalyticsItem extends LineCarouselItem {
  totalClicks: number;
  uniqueClickers: number;
}

export interface LineEligibleUserSearchResult {
  userId: string;
  displayName: string;
  pictureUrl?: string | null;
  lineIdMasked: string;
}

export interface Appointment {
  id: string;
  date: string; // YYYY-MM-DD
  timeSlot: string; // e.g., "14:00"
  userId?: string; // If null, it's just an open slot
  customerName?: string;
  phoneNumber?: string; // New: Customer Phone Number
  // Status: OPEN (Green), PENDING (Yellow - 待審核), WAITING_PAYMENT (Orange - 待付款), SIGNING (Blue - 簽屬中), SIGNED (Purple - 簽屬完成), BOOKED (Red - 已確認), COMPLETED (Gray - 已完成)
  status: 'OPEN' | 'PENDING' | 'WAITING_PAYMENT' | 'SIGNING' | 'SIGNED' | 'BOOKED' | 'COMPLETED';
  orderType?: 'CLAIMED' | 'CUSTOM'; // 訂單類型：CLAIMED=認領圖, CUSTOM=客製圖
  notes?: string;
  // New fields for linking artwork
  artworkId?: string;
  artworkTitle?: string;
  artworkImage?: string;
  // Price fields
  totalPrice?: number; // 總價
  depositPaid?: number; // 已付訂金
  // Consent form fields (後台填寫)
  tattooPosition?: string; // 紋身部位
  tattooSize?: string; // 大小
  tattooColor?: string; // 色彩
  consentNotes?: string; // 其他備註
  // Consent signature fields (客人填寫)
  signatureData?: string; // 簽名圖片 Base64
  signedAt?: string; // 簽署時間
  signerName?: string; // 簽署人姓名
  signerPhone?: string; // 簽署人電話
}

export interface PublicAppointment {
  date: string;
  timeSlot: string;
  status: Appointment['status'];
  customerName?: string | null;
  artworkTitle?: string | null;
  artworkImage?: string | null;
  totalPrice?: number | null;
  depositPaid?: number | null;
  tattooPosition?: string | null;
  tattooSize?: string | null;
  tattooColor?: string | null;
  orderType?: 'CLAIMED' | 'CUSTOM' | null;
  signed: boolean;
  signedAt?: string | null;
}

export interface PublicConsent {
  date: string;
  timeSlot: string;
  status: Appointment['status'];
  customerName?: string | null;
  artworkTitle?: string | null;
  tattooPosition?: string | null;
  tattooSize?: string | null;
  tattooColor?: string | null;
  orderType?: 'CLAIMED' | 'CUSTOM' | null;
  signed: boolean;
  signedAt?: string | null;
}

export interface AdminAppointmentPublicLinks {
  appointmentUrl: string;
  consentUrl: string;
}

export interface SaveAppointmentResponse {
  success: boolean;
  publicAppointmentUrl?: string;
  publicConsentUrl?: string;
  appointmentUrl?: string;
  consentUrl?: string;
}

export interface AvailabilityWindow {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  intervalMinutes: 30 | 60;
}

export interface BookedTimeSlot {
  date: string;
  timeSlot: string;
}

export interface BookingCalendarData {
  windows: AvailabilityWindow[];
  legacyOpenSlots: Array<{ id: string; date: string; timeSlot: string }>;
  bookedSlots: BookedTimeSlot[];
}

export const BOOKING_ANALYTICS_ARTWORK_SENTINEL = '__booking__';

export type BookingEventType =
  | 'booking_start'
  | 'booking_date_selected'
  | 'booking_time_selected'
  | 'booking_submit'
  | 'booking_complete'
  | 'booking_line_click';

export interface AnalyticsV2BookingMetrics {
  trackedSessions: number;
  startSessions: number;
  dateSelectedSessions: number;
  timeSelectedSessions: number;
  submitSessions: number;
  completeSessions: number;
  lineClickSessions: number;
  startToCompleteRate: number;
  bookingConversionRate: number;
}

export interface AnalyticsV2ArtworkBooking {
  bookingStartSessions: number;
  bookingCompleteSessions: number;
  bookingRate: number;
}

export interface AnalyticsV2AttributionBooking {
  bookingCompleteSessions: number;
  bookingRate: number;
}

// Analytics 2.0 Phase 1 types
export type ArtworkEventType = 'view' | 'fav_add' | 'fav_remove' | 'contact';
export type ContactChannel = 'line' | 'instagram';
export type AttributionSnapshot = AttributionData;

export interface AnalyticsEvent {
  // 用於冪等去重：同一事件重試必須使用同一 eventId
  eventId?: string;
  eventType: ArtworkEventType;
  artworkId: string;
  userId?: string;
  sessionId?: string;
  channel?: ContactChannel;
  // Contact value/currency 最終應以 server authority 計算後寫入
  value?: number;
  currency?: 'TWD' | string;
  attribution?: AttributionSnapshot;
  createdAt?: string;
}

export interface AnalyticsV2Meta {
  requestedStartDate: string;
  requestedEndDate: string;
  granularity: 'daily' | 'weekly' | 'monthly';
  businessTimezone: 'Asia/Taipei';
  storageTimezone: 'UTC';
  analyticsV2StartAt: string;
  generatedAt: string;
}

export interface AnalyticsV2Coverage {
  status: 'unavailable' | 'partial' | 'complete';
  analyticsV2StartAt: string;
  requestedStartDate: string;
  requestedEndDate: string;
  effectiveStartAt: string | null;
  message: string;
}

export interface AnalyticsV2Quality {
  completeEvents: number;
  incompleteEventsAfterV2Start: number;
  missingSessionEvents: number;
  missingEventIdEvents: number;
  contactMissingChannel: number;
  contactMissingValue: number;
}

export interface AnalyticsV2Metrics {
  views: number;
  favAdds: number;
  favRemoves: number;
  netFavorites: number;
  contacts: number;
  lineContacts: number;
  instagramContacts: number;
  favoriteRate: number;
  contactRate: number;
  uniqueViewSessions: number;
  uniqueFavoriteSessions: number;
  uniqueContactSessions: number;
  sessionFavoriteRate: number;
  sessionContactRate: number;
}

export type AnalyticsV2Summary = AnalyticsV2Metrics;

export interface AnalyticsV2Funnel {
  totalSessions: number;
  viewSessions: number;
  leadSessions: number;
  viewRate: number;
  leadConversionRate: number;
  viewToLeadRate: number;
}

export interface AnalyticsV2ChannelLead {
  channel: 'line' | 'instagram' | 'other';
  leadSessions: number;
  leadSessionTriggerRate: number;
}

export interface AnalyticsV2ChannelLeads {
  totalLeadSessions: number;
  channels: AnalyticsV2ChannelLead[];
}

export interface AnalyticsV2ConversionMetrics {
  sessions: number;
  viewSessions: number;
  leadSessions: number;
  viewRate: number;
  leadRate: number;
  viewToLeadRate: number;
}

export interface AnalyticsV2ArtworkConversion {
  viewSessions: number;
  leadSessions: number;
  viewToLeadRate: number;
}

export interface AnalyticsLabelFields {
  displayName: string | null;
  note: string | null;
  isLabeled: boolean;
}

export type AnalyticsLabelDimension = 'source' | 'campaign' | 'content';

export interface AnalyticsLabel {
  id: number;
  dimension: AnalyticsLabelDimension;
  rawValue: string;
  displayName: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AnalyticsV2TrendPoint =
  | ({ date: string } & AnalyticsV2Metrics)
  | ({ weekStartDate: string } & AnalyticsV2Metrics)
  | ({ month: string } & AnalyticsV2Metrics);

export interface AnalyticsV2ArtworkRow extends AnalyticsV2Metrics, AnalyticsV2ArtworkConversion, AnalyticsV2ArtworkBooking {
  artworkId: string;
  title: string;
  imageUrl: string;
}

export interface AnalyticsV2SourceRow extends AnalyticsV2Metrics, AnalyticsV2ConversionMetrics, AnalyticsV2AttributionBooking, AnalyticsLabelFields {
  source: string;
  rawSources: string[];
}

export interface AnalyticsV2CampaignRow extends AnalyticsV2Metrics, AnalyticsV2ConversionMetrics, AnalyticsV2AttributionBooking, AnalyticsLabelFields {
  source: string;
  campaign: string | null;
}

export interface AnalyticsV2ContentRow extends AnalyticsV2Metrics, AnalyticsV2ConversionMetrics, AnalyticsV2AttributionBooking, AnalyticsLabelFields {
  source: string;
  campaign: string | null;
  content: string | null;
}

export interface AnalyticsV2Response {
  success: boolean;
  meta: AnalyticsV2Meta;
  coverage: AnalyticsV2Coverage;
  quality: AnalyticsV2Quality;
  summary: AnalyticsV2Summary;
  funnel: AnalyticsV2Funnel;
  channelLeads: AnalyticsV2ChannelLeads;
  trend: AnalyticsV2TrendPoint[];
  byArtwork: AnalyticsV2ArtworkRow[];
  bySource: AnalyticsV2SourceRow[];
  byCampaign: AnalyticsV2CampaignRow[];
  byContent: AnalyticsV2ContentRow[];
  booking?: AnalyticsV2BookingMetrics;
  comparisonMeta?: AnalyticsV2ComparisonMeta;
  comparison?: AnalyticsV2PeriodData;
}

export interface AnalyticsV2ComparisonMeta {
  currentStart: string;
  currentEnd: string;
  comparisonStart: string;
  comparisonEnd: string;
  compareMode?: AnalyticsCompareMode;
}

export type AnalyticsCompareMode = 'none' | 'previous' | 'custom';

export interface AnalyticsV2PeriodData {
  coverage: AnalyticsV2Coverage;
  quality: AnalyticsV2Quality;
  summary: AnalyticsV2Summary;
  funnel: AnalyticsV2Funnel;
  channelLeads: AnalyticsV2ChannelLeads;
  trend: AnalyticsV2TrendPoint[];
  byArtwork: AnalyticsV2ArtworkRow[];
  bySource: AnalyticsV2SourceRow[];
  byCampaign: AnalyticsV2CampaignRow[];
  byContent: AnalyticsV2ContentRow[];
  booking?: AnalyticsV2BookingMetrics;
}

export interface MemberGrowthComparisonMetric {
  current: number;
  previous: number;
  delta: number;
  percent: number | null;
}

export interface MemberGrowthDailyPoint {
  date: string;
  newUsers: number;
  followEvents: number;
  unfollowEvents: number;
  netFollowEvents: number;
}

export interface MemberGrowthAnalyticsResponse {
  success: boolean;
  summary: {
    totalUsers: number;
    legacyUsers: number;
    trackedUsers: number;
    newUsers: number;
    followEvents: number;
    unfollowEvents: number;
    netFollowEvents: number;
  };
  comparison: {
    newUsers: MemberGrowthComparisonMetric;
    followEvents: MemberGrowthComparisonMetric;
    unfollowEvents: MemberGrowthComparisonMetric;
    netFollowEvents: MemberGrowthComparisonMetric;
  };
  daily: MemberGrowthDailyPoint[];
  tracking: {
    legacyUsers: number;
    hasLegacyUsers: boolean;
  };
  meta?: {
    startDate: string;
    endDate: string;
    timezone: string;
    previousStartDate: string;
    previousEndDate: string;
  };
}

export interface MetaAdsDataCompletenessMetric {
  filled: number;
  total: number;
}

export interface MetaAdsDataCompleteness {
  total: number;
  spend: MetaAdsDataCompletenessMetric;
  currency: MetaAdsDataCompletenessMetric;
  accountId: MetaAdsDataCompletenessMetric;
  creativeId: MetaAdsDataCompletenessMetric;
  urlParameters: MetaAdsDataCompletenessMetric;
}

export interface MetaAdsImportOverview {
  dateFrom: string | null;
  dateTo: string | null;
  dailyRecords: number;
  adCount: number;
  campaignCount: number;
  lastImportAt: string | null;
  dataCompleteness?: MetaAdsDataCompleteness;
}

export interface MetaAdsCsvFileResult {
  fileName: string;
  status: 'ok' | 'error';
  error?: string;
  totalRows?: number;
  validRows?: number;
  ignoredSummaryRows?: number;
  invalidRows?: number;
  invalidSamples?: string[];
}

export interface MetaAdsCsvPreviewResult {
  importMode?: 'STANDARD_META_DAILY' | 'DEMOGRAPHIC_META_DAILY' | 'MIXED';
  uniqueDemographicRows?: number;
  uniqueAdDayRows?: number;
  uniqueCampaigns?: number;
  ageGroups?: string[];
  genderGroups?: string[];
  demographicWarning?: string;
  dailyRecordMissing?: boolean;
  dailyRecordsMissing?: number;
  demographicQuality?: {
    hasMissingMetrics: boolean;
    detailVsSummaryMismatch: boolean;
    incompleteBreakdown: boolean;
    byFile: Record<string, {
      hasMissingMetrics: boolean;
      detailVsSummaryMismatch: boolean;
      incompleteBreakdown: boolean;
      missingMetricCells: Record<string, number>;
      detailKnownSums: Record<string, number>;
      summaryTotals: Record<string, number>;
      mismatchedMetrics: string[];
    }>;
  };
  success: boolean;
  fileCount: number;
  fileNames: string[];
  dateFrom: string | null;
  dateTo: string | null;
  totalRows: number;
  validRows: number;
  ignoredSummaryRows: number;
  invalidRows: number;
  uniqueAds: number;
  existingRows: number;
  newRows: number;
  fileResults: MetaAdsCsvFileResult[];
  errors: Array<{ fileName: string; error: string }>;
  invalidRowDetails?: Array<{ fileName: string; adId: string; reason: string }>;
}

export interface MetaAdsCsvImportResult {
  success: boolean;
  importId?: number;
  fileCount: number;
  validRows: number;
  insertedRows: number;
  updatedRows: number;
  ignoredSummaryRows: number;
  invalidRows: number;
  dateFrom: string | null;
  dateTo: string | null;
  uniqueAds: number;
  errors: Array<{ fileName: string; error: string }>;
  fileResults: MetaAdsCsvFileResult[];
  demographicRows?: number;
  demographicInserted?: number;
  demographicUpdated?: number;
  dailyRecordMissing?: boolean;
  dailyRecordsMissing?: number;
  demographicQuality?: MetaAdsCsvPreviewResult['demographicQuality'];
}

export interface MetaAdsImportHistoryItem {
  id: number;
  importedAt: string;
  fileCount: number;
  fileNames: string[];
  dateFrom: string | null;
  dateTo: string | null;
  totalRows: number;
  validRows: number;
  ignoredSummaryRows: number;
  invalidRows: number;
  insertedRows: number;
  updatedRows: number;
  uniqueAds: number;
  status: 'success' | 'partial' | 'failed';
  errorSummary?: string | null;
}

export interface MetaInkflowAttributionRate {
  numerator: number;
  denominator: number;
  rate: number | null;
  notApplicable?: boolean;
  reason?: string;
}

export interface MetaInkflowAttributionDailyRow {
  date: string;
  adId: string;
  matched: boolean;
  meta: {
    campaignId: string | null;
    campaignName: string | null;
    adsetId: string | null;
    adsetName: string | null;
    adId: string;
    adName: string | null;
    spend: number | null;
    impressions: number | null;
    reach: number | null;
    frequency: number | null;
    cpm: number | null;
    linkClicks: number | null;
    outboundClicks: number | null;
    landingPageViews: number | null;
    linkCtr: number | null;
    outboundCtr: number | null;
    linkCpc: number | null;
    destinationType: string;
  } | null;
  inkflow: {
    sessions: number;
    exactSessions: number;
    fallbackSessions: number;
    viewSessions: number;
    favoriteSessions: number;
    leadSessions: number;
    exactLeadSessions: number;
    fallbackLeadSessions: number;
    lineLeadSessions: number;
    igLeadSessions: number;
    bookingStartSessions: number;
    exactBookingStartSessions: number;
    fallbackBookingStartSessions: number;
    bookingCompleteSessions: number;
    exactBookingCompleteSessions: number;
    fallbackBookingCompleteSessions: number;
  };
  rates: {
    landingToSession: MetaInkflowAttributionRate;
    sessionToView: MetaInkflowAttributionRate;
    sessionToLead: MetaInkflowAttributionRate;
    sessionToLine: MetaInkflowAttributionRate;
    sessionToIg: MetaInkflowAttributionRate;
    sessionToBookingStart: MetaInkflowAttributionRate;
    sessionToBookingComplete: MetaInkflowAttributionRate;
  };
}

export interface MetaInkflowAttributionDailyResponse {
  demographics?: { available: boolean; rows: MetaDemographicDetail[] };
  success: boolean;
  dateFrom: string;
  dateTo: string;
  businessTimezone: string;
  metaReportTimezone: string;
  eventStorageTimezone: string;
  convertTzAvailable: boolean;
  timezoneAligned: boolean;
  timezoneMismatch: boolean;
  timezoneNote: string | null;
  metaTimezones: string[];
  coverage: {
    websiteSessions: number;
    metaEligibleSessions: number;
    exactSessions: number;
    fallbackSessions: number;
    unattributedSessions: number;
    effectiveAttributionRate: number;
    exactRate: number;
    fallbackRate: number;
  };
  quality: {
    exactSessions: number;
    fallbackSessions: number;
    unattributedSessions: number;
    exactRate: number;
    fallbackRate: number;
    effectiveAttributionRate: number;
  };
  unmatched: {
    metaAdsWithNoInkflowSessions: number;
    inkflowAdIdsNotInCsv: number;
    metaAdsWithNoSessions: Array<{ date: string; adId: string; adName: string | null }>;
    inkflowAdIdsNotFound: Array<{
      adId: string;
      sessionCount: number;
      attributionQuality?: 'EXACT' | 'FALLBACK' | 'UNATTRIBUTED';
      metaJoinStatus?: 'MATCHED' | 'META_NOT_IMPORTED' | 'NO_META_ID';
    }>;
  };
  rows: MetaInkflowAttributionDailyRow[];
}

export interface MetaDemographicDetail {
  date: string;
  account_id: string;
  campaign_id: string | null;
  campaign_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  ad_id: string;
  ad_name: string | null;
  age_range: string;
  gender: string;
  currency: string | null;
  timezone: string | null;
  spend: number | string | null;
  impressions: number | string | null;
  reach: number | string | null;
  clicks_all: number | string | null;
  link_clicks: number | string | null;
  outbound_clicks: number | string | null;
  landing_page_views: number | string | null;
}
