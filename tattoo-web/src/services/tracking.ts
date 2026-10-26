import { isSensitivePublicAppointmentLocation } from '../utils/publicAppointmentToken';
import { shouldTrackPublicPageView } from '../utils/sensitivePublicRoute';
import type { Artwork } from '../types';
import { captureUtmParams, toUtmEventPayload } from '../utils/attribution';

type TrackPayload = Record<string, unknown>;
type TrackingFn = (...args: unknown[]) => void;
type TrackingBootstrapFn = TrackingFn & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  loaded: boolean;
  version: string;
};

declare global {
  interface Window {
    fbq?: TrackingFn;
    _fbq?: TrackingFn;
    gtag?: TrackingFn;
    dataLayer?: unknown[];
  }
}

const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID?.trim() || '';
const IS_PROD = import.meta.env.PROD;
const ENABLE_DEBUG = !IS_PROD;

let pixelInitialized = false;
let pageViewTracked = false;
const dedupeSet = new Set<string>();
const contactLockMap = new Map<string, number>();
const CONTACT_LOCK_WINDOW_MS = 1200;

const logDebug = (event: string, payload?: TrackPayload) => {
  if (!ENABLE_DEBUG) return;
  if (payload) console.debug(`[tracking] ${event}`, payload);
  else console.debug(`[tracking] ${event}`);
};

const ensureFbq = (): boolean => {
  if (!PIXEL_ID) return false;
  if (typeof window === 'undefined') return false;

  if (window.fbq) return true;
  const n = (function(...args: unknown[]) {
    const fn = n as TrackingBootstrapFn;
    if (fn.callMethod) {
      fn.callMethod(...args);
    } else {
      fn.queue.push(args);
    }
  }) as TrackingBootstrapFn;
  n.queue = [];
  n.loaded = true;
  n.version = '2.0';
  window.fbq = n;
  if (!window._fbq) window._fbq = n;

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  const first = document.getElementsByTagName('script')[0];
  first.parentNode?.insertBefore(script, first);
  return true;
};

export const initTracking = () => {
  if (!PIXEL_ID) {
    logDebug('pixel_disabled_no_id');
    return;
  }
  if (pixelInitialized) return;
  if (!ensureFbq() || !window.fbq) return;
  window.fbq('init', PIXEL_ID);
  pixelInitialized = true;
  logDebug('pixel_initialized', { pixelId: PIXEL_ID });
};

export const trackPageView = () => {
  if (!PIXEL_ID || pageViewTracked) return;
  if (!shouldTrackPublicPageView()) {
    logDebug('PageView_skipped_sensitive_route');
    return;
  }
  initTracking();
  try {
    window.fbq?.('track', 'PageView');
    pageViewTracked = true;
    logDebug('PageView');
  } catch {
    // ignore blocked tracker
  }
};

const hasDataLayerEvent = (event: string, payload: TrackPayload): boolean => {
  if (typeof window === 'undefined' || !Array.isArray(window.dataLayer)) return false;
  return window.dataLayer.some((item) => {
    if (!item || typeof item !== 'object') return false;
    const row = item as Record<string, unknown> & { 0?: unknown; 1?: unknown; 2?: unknown };
    if (row[0] !== 'event' || row[1] !== event) return false;
    const rowPayload = row[2];
    if (!rowPayload || typeof rowPayload !== 'object') return false;
    const objectPayload = rowPayload as Record<string, unknown>;
    return objectPayload.artwork_id === payload.artwork_id
      && objectPayload.lead_source === payload.lead_source
      && objectPayload.value === payload.value;
  });
};

const pushDataLayerEvent = (event: string, payload: TrackPayload) => {
  if (typeof window === 'undefined' || !Array.isArray(window.dataLayer)) return;
  if (hasDataLayerEvent(event, payload)) return;
  window.dataLayer.push(['event', event, payload]);
  logDebug(`ga_datalayer_fallback:${event}`, payload);
};

export const trackGaEvent = (event: string, payload: TrackPayload = {}) => {
  try {
    if (typeof window === 'undefined') return;
    if (isSensitivePublicAppointmentLocation(window.location.pathname, window.location.hash)) {
      logDebug(`ga_skipped_sensitive_route:${event}`);
      return;
    }
    const sanitizedPayload = { ...payload };
    if (typeof window.gtag === 'function') {
      window.gtag('event', event, sanitizedPayload);
      logDebug(`ga:${event}`, sanitizedPayload);
      return;
    }
    pushDataLayerEvent(event, sanitizedPayload);
  } catch {
    // ignore blocked tracker
  }
};

export const trackMetaEvent = (event: string, payload: TrackPayload = {}) => {
  if (!PIXEL_ID) return;
  if (!shouldTrackPublicPageView()) {
    logDebug(`meta_skipped_sensitive_route:${event}`);
    return;
  }
  initTracking();
  try {
    window.fbq?.('track', event, payload);
    logDebug(event, payload);
  } catch {
    // ignore blocked tracker
  }
};

export const trackMetaCustomEvent = (event: string, payload: TrackPayload = {}) => {
  if (!PIXEL_ID) return;
  if (!shouldTrackPublicPageView()) {
    logDebug(`meta_skipped_sensitive_route:${event}`);
    return;
  }
  initTracking();
  try {
    window.fbq?.('trackCustom', event, payload);
    logDebug(event, payload);
  } catch {
    // ignore blocked tracker
  }
};

export const trackEvent = (
  eventName: string,
  payload: TrackPayload = {},
  options?: { metaStandard?: boolean }
) => {
  if (options?.metaStandard) trackMetaEvent(eventName, payload);
  else trackMetaCustomEvent(eventName, payload);
  trackGaEvent(eventName, payload);
};

const toPositiveNumber = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value > 0 ? value : null;
};

export const getEffectiveArtworkPrice = (artwork: Pick<Artwork, 'price' | 'specialPrice'>): number | null => {
  const special = toPositiveNumber(artwork.specialPrice);
  if (special !== null) return special;
  return toPositiveNumber(artwork.price);
};

export const getTrackingUtmParams = (): {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
} => {
  const attribution = captureUtmParams();
  return toUtmEventPayload(attribution);
};

type ContactChannel = 'line' | 'instagram';

type ArtworkContactTrackInput = {
  artwork: Pick<Artwork, 'id' | 'title' | 'category' | 'price' | 'specialPrice'>;
  channel: ContactChannel;
};

type ArtworkContactTrackResult = {
  tracked: boolean;
  skipped?: 'duplicate' | 'invalid_price';
  value?: number;
  gaQueued: boolean;
  metaQueued: boolean;
};

export const isAnalyticsDebugEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('analytics_debug') === '1';
};

export const debugAnalytics = (message: string, payload?: TrackPayload) => {
  if (!isAnalyticsDebugEnabled()) return;
  if (payload) console.debug(`[Analytics] ${message}`, payload);
  else console.debug(`[Analytics] ${message}`);
};

const debugContact = (message: string, payload?: TrackPayload) => {
  if (!isAnalyticsDebugEnabled()) return;
  if (payload) console.debug(`[Contact] ${message}`, payload);
  else console.debug(`[Contact] ${message}`);
};

export const trackArtworkContact = async ({
  artwork,
  channel,
}: ArtworkContactTrackInput): Promise<ArtworkContactTrackResult> => {
  const lockKey = `${artwork.id}:${channel}`;
  const now = Date.now();
  const lastTriggeredAt = contactLockMap.get(lockKey) ?? 0;
  if (now - lastTriggeredAt < CONTACT_LOCK_WINDOW_MS) {
    logDebug('contact_skipped_duplicate', { lockKey });
    return { tracked: false, skipped: 'duplicate', gaQueued: false, metaQueued: false };
  }
  contactLockMap.set(lockKey, now);

  const value = getEffectiveArtworkPrice(artwork);
  if (value === null) {
    logDebug('contact_skipped_invalid_price', { artworkId: artwork.id, channel });
    return { tracked: false, skipped: 'invalid_price', gaQueued: false, metaQueued: false };
  }

  const utm = getTrackingUtmParams();
  const gaPayload: TrackPayload = {
    currency: 'TWD',
    value,
    lead_source: channel,
    artwork_id: String(artwork.id),
    artwork_name: artwork.title,
    ...utm,
  };
  const metaPayload: TrackPayload = {
    content_ids: [String(artwork.id)],
    content_name: artwork.title,
    content_type: 'claim_design',
    contact_channel: channel,
    value,
    currency: 'TWD',
    ...utm,
  };

  debugContact('before GA4', { channel, artworkId: artwork.id, effectivePrice: value });
  let gaQueued = false;
  try {
    trackGaEvent('generate_lead', gaPayload);
    pushDataLayerEvent('generate_lead', gaPayload);
    gaQueued = true;
  } catch {
    gaQueued = false;
  }
  debugAnalytics('GA4 generate_lead queued', { channel, artworkId: artwork.id, value });
  debugContact('after GA4', { channel, artworkId: artwork.id, effectivePrice: value });

  let metaQueued = false;
  try {
    trackMetaEvent('Contact', metaPayload);
    metaQueued = true;
    debugContact('after Meta', { channel, artworkId: artwork.id, effectivePrice: value });
    debugAnalytics('Meta Contact queued', { channel, artworkId: artwork.id, value });
  } catch {
    // ignore blocked tracker
    metaQueued = false;
  }

  return { tracked: true, value, gaQueued, metaQueued };
};

type ArtworkViewTrackInput = {
  artwork: Pick<Artwork, 'id' | 'title' | 'category' | 'price' | 'specialPrice'>;
  status: 'AVAILABLE' | 'NEGOTIATING' | 'CLAIMED';
  onceKey: string;
};

export const trackArtworkView = ({ artwork, status, onceKey }: ArtworkViewTrackInput): boolean => {
  return trackOnce(onceKey, () => {
    const value = getEffectiveArtworkPrice(artwork);
    const utm = getTrackingUtmParams();

    const metaPayload: TrackPayload = {
      content_ids: [artwork.id],
      content_name: artwork.title,
      content_type: 'claim_design',
      currency: 'TWD',
      status,
      ...utm,
    };
    if (value !== null) metaPayload.value = value;
    trackMetaEvent('ViewContent', metaPayload);

    const gaPayload: TrackPayload = {
      currency: 'TWD',
      items: [{
        item_id: artwork.id,
        item_name: artwork.title,
        item_category: artwork.category,
      }],
      status,
      ...utm,
    };
    if (value !== null) gaPayload.value = value;
    trackGaEvent('view_item', gaPayload);
  });
};

export const trackOnce = (key: string, callback: () => void): boolean => {
  if (dedupeSet.has(key)) return false;
  dedupeSet.add(key);
  callback();
  return true;
};

export const getPixelId = () => PIXEL_ID;

/** 網站上「LINE 詢問・加入好友」入口的位置，用於比較哪個入口最有效 */
export type LineEntryPlacement =
  | 'header'
  | 'menu'
  | 'preview_result'
  | 'aftercare'
  | 'gallery_empty'
  | 'custom_inquiry_home'
  | 'custom_inquiry_menu';

/**
 * 一般 LINE 入口點擊（非特定作品）。
 * GA4 事件 line_entry_click、Meta 自訂事件 LineEntryClick，附帶 placement 與 UTM。
 */
export const trackLineEntryClick = (placement: LineEntryPlacement): void => {
  const payload: TrackPayload = { placement, ...getTrackingUtmParams() };
  try {
    trackGaEvent('line_entry_click', payload);
    trackMetaCustomEvent('LineEntryClick', payload);
  } catch {
    // ignore blocked tracker
  }
};
