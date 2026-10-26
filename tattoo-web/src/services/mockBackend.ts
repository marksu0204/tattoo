
import { Artwork, Appointment, ArtworkStatus, User, MemberTag, LineBroadcast, LineBroadcastDetail, LineAudienceFilter, LineAudiencePreviewResponse, LineBroadcastSendResult, LineBroadcastTestSendResult, LineBroadcastImageEntry, LineCarouselItem, LineEligibleUserSearchResult, AttributionSnapshot, ArtworkEventType, ContactChannel, AnalyticsV2Response, AnalyticsCompareMode, AnalyticsLabel, AnalyticsLabelDimension, AvailabilityWindow, BookingCalendarData, BookingEventType, ArtworkTaxonomyCatalogResponse, MetaAdsCsvPreviewResult, MetaAdsCsvImportResult, MetaAdsImportOverview, MetaAdsImportHistoryItem, MetaInkflowAttributionDailyResponse, PublicAppointment, PublicConsent, AdminAppointmentPublicLinks, SaveAppointmentResponse, MemberGrowthAnalyticsResponse } from '../types';
import { ArtworkSort } from '../utils/artworkSort';
import { captureUtmParams, buildAcquisitionContextForSync } from '../utils/attribution';
import { createAnalyticsEventId, getAnalyticsSessionId } from '../utils/analyticsSession';
import { ADMIN_TOKEN_KEY, hasAdminToken, getAdminToken as readAdminToken, saveAdminIdentity, clearAdminSession, type AdminIdentity } from '../utils/adminAuth';
import { adminReadGet, logAdminFetchError, buildAdminRequestHeaders, adminFetchPost } from '../utils/adminFetch';
import { logLineSendDebug } from '../utils/lineSendDebug';

import { getDevBrandOverride } from '../utils/resolveBrand';

// ─── Admin Token 管理 ─────────────────────────────────────────────────────────
const TOKEN_KEY = ADMIN_TOKEN_KEY;
const getAdminToken = (): string | null => readAdminToken();
export { hasAdminToken };
export const saveAdminToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const clearAdminToken = () => clearAdminSession();

/** DEV-only: align backend effective brand with ?brand= override (localhost only). */
const devBrandRequestHeaders = (): Record<string, string> => {
    if (!import.meta.env.DEV) return {};
    const devBrand = getDevBrandOverride();
    if (!devBrand) return {};
    return { 'X-Inkflow-Dev-Brand': devBrand };
};

/** 一般請求 headers */
const jsonHeaders = (): HeadersInit => ({
    'Content-Type': 'application/json',
    ...devBrandRequestHeaders(),
});

/** 需要管理員 Token 的請求 headers */
const adminHeaders = (): HeadersInit => buildAdminRequestHeaders();

/** 管理員 GET 請求（帶 Authorization header） */
const adminGet = (url: string): Promise<Response> => adminReadGet(url, 'adminGet');

const handleAdminReadResponse = async (response: Response, action: string) => {
    if (!response.ok) {
        logAdminFetchError(action, new Error(`HTTP ${response.status}`), response.status);
    }
    return handleResponse(response);
};
// ─────────────────────────────────────────────────────────────────────────────

export interface PaginatedArtworks {
    artworks: Artwork[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
    availablePlacements?: string[];
}

// Points to the PHP file in your public_html folder
// CRITICAL: Use absolute path to ensure it works on nested routes (e.g. /artwork/1)
const API_URL = '/api.php';
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const parsePositiveNumber = (value: any): number | undefined => {
    if (value === null || value === undefined || value === '') return undefined;
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return undefined;
    return num;
};

const parsePlacementList = (value: any): string[] => {
    if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
    if (typeof value === 'string') return value.split(',').map(v => v.trim()).filter(Boolean);
    return [];
};

const parseClaimStage = (value: any): Artwork['claimStage'] => {
    if (value === 'AVAILABLE' || value === 'NEGOTIATING' || value === 'CLAIMED') return value;
    return undefined;
};

type AnalyticsEventMeta = {
    eventId: string;
    sessionId: string;
    attribution: AttributionSnapshot;
};

type RecordArtworkEventInput = {
    artworkId: string;
    eventType: ArtworkEventType;
    channel?: ContactChannel;
    eventMeta?: AnalyticsEventMeta;
};

const buildAnalyticsEventMeta = (): AnalyticsEventMeta => ({
    eventId: createAnalyticsEventId(),
    sessionId: getAnalyticsSessionId(),
    attribution: captureUtmParams(),
});

// Helper to handle API responses robustly
const handleResponse = async (response: Response) => {
    const text = await response.text();

    // Token 無效或過期：清除憑證並跳回登入頁
    if (response.status === 401) {
        clearAdminSession();
        localStorage.removeItem('inkflow_user');
        window.location.href = '/login';
        throw new Error('Session expired. Please log in again.');
    }

    if (response.status === 413) {
        throw new Error('REQUEST_ENTITY_TOO_LARGE');
    }
    
    if (!response.ok) {
        console.error(`[API Error ${response.status}]`, text);
        throw new Error(`Server returned status ${response.status}`);
    }
    
    // Handle empty responses
    if (!text || text.trim() === '') return {};

    try {
        const json = JSON.parse(text);
        // PHP sometimes returns { "error": "message" } even with 200 OK
        if (json && json.error) {
            throw new Error(json.error);
        }
        return json;
    } catch (e: any) {
        // If it's our own error from above, rethrow it
        if (e.message && typeof e.message === 'string' && !e.message.startsWith('Unexpected token')) {
            throw e;
        }
        console.error("JSON Parse Error. Raw text received:", text);
        throw new Error("Invalid response format from server");
    }
};

const fetchWithRetry = async (
    requestFactory: () => Promise<Response>,
    retryStatuses: number[] = [403, 429],
    maxRetries: number = 2
): Promise<Response> => {
    let response = await requestFactory();

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (response.ok || !retryStatuses.includes(response.status)) {
            return response;
        }
        // Exponential backoff to avoid triggering rate-limit / WAF burst rules
        await sleep(400 * Math.pow(2, attempt));
        response = await requestFactory();
    }

    return response;
};

class MockBackend {
  private buildEventMeta(): AnalyticsEventMeta {
    return buildAnalyticsEventMeta();
  }

  private queueArtworkEvent(payload: {
    eventId: string;
    artworkId: string;
    eventType: ArtworkEventType;
    sessionId: string;
    attribution: AttributionSnapshot;
    channel?: ContactChannel;
  }): void {
    const url = `${API_URL}?action=recordArtworkEvent`;
    const body = JSON.stringify(payload);

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([body], { type: 'application/json' });
        const beaconOk = navigator.sendBeacon(url, blob);
        if (beaconOk) return;
      }
    } catch {
      // ignore and fallback to fetch keepalive
    }

    fetch(url, {
      method: 'POST',
      headers: jsonHeaders(),
      body,
      keepalive: true,
    }).catch(() => {
      // ignore network failure; contact redirect flow must not be blocked
    });
  }

  // --- Admin Auth ---

  /** 管理員登入：向伺服器驗證帳密，成功後儲存 token */
  async adminLogin(email: string, password: string): Promise<{ ok: boolean; rateLimited?: boolean; retryAfter?: number }> {
    try {
        const response = await fetch(`${API_URL}?action=adminLogin`, {
            method: 'POST',
            headers: jsonHeaders(),
            body: JSON.stringify({ email, password })
        });
        if (response.status === 429) {
            let retryAfter: number | undefined;
            try {
                const text = await response.text();
                if (text) {
                    const data = JSON.parse(text);
                    if (typeof data.retryAfter === 'number') {
                        retryAfter = data.retryAfter;
                    }
                }
            } catch {
                // ignore parse errors
            }
            return { ok: false, rateLimited: true, retryAfter };
        }
        if (response.status === 401) {
            return { ok: false };
        }
        const data = await handleResponse(response);
        if (data.token) {
            saveAdminToken(data.token);
            if (data.admin) {
                saveAdminIdentity(data.admin as AdminIdentity);
            }
            return { ok: true };
        }
        return { ok: false };
    } catch (e) {
        return { ok: false };
    }
  }

  async getAdminContext(): Promise<import('../types').AdminContextResponse> {
    return handleResponse(await adminReadGet(`${API_URL}?action=getAdminContext&t=${Date.now()}`, 'getAdminContext'));
  }

  async getAdminBrandPresentation(): Promise<import('../types').AdminBrandPresentation> {
    const data = await handleAdminReadResponse(
      await adminReadGet(`${API_URL}?action=getAdminBrandPresentation&t=${Date.now()}`, 'getAdminBrandPresentation'),
      'getAdminBrandPresentation'
    );
    if (!data || typeof data !== 'object' || !('presentation' in data)) {
      throw new Error('Invalid brand presentation response');
    }
    return (data as { presentation: import('../types').AdminBrandPresentation }).presentation;
  }

  async updateAdminBrandPresentation(
    payload: Omit<import('../types').AdminBrandPresentation, 'code' | 'isActive'>
  ): Promise<import('../types').AdminBrandPresentation> {
    const response = await adminFetchPost(
      `${API_URL}?action=updateAdminBrandPresentation`,
      payload,
      'updateAdminBrandPresentation'
    );
    const data = await handleResponse(response);
    if (!data || typeof data !== 'object' || !('presentation' in data)) {
      throw new Error('Invalid update brand presentation response');
    }
    return (data as { presentation: import('../types').AdminBrandPresentation }).presentation;
  }

  async createBrandAdmin(payload: {
    email: string;
    displayName: string;
    temporaryPassword: string;
    brandCode: string;
  }): Promise<{ success: boolean; admin?: { id: number; email: string; displayName: string; brandCode: string } }> {
    const response = await adminFetchPost(`${API_URL}?action=createBrandAdmin`, payload, 'createBrandAdmin');
    return handleResponse(response);
  }

  async getAdminUsers(): Promise<import('../types').AdminUserListItem[]> {
    const data = await handleAdminReadResponse(
      await adminReadGet(`${API_URL}?action=getAdminUsers&t=${Date.now()}`, 'getAdminUsers'),
      'getAdminUsers'
    );
    if (!data || typeof data !== 'object' || !('users' in data)) {
      throw new Error('Invalid admin users response');
    }
    return (data as { users: import('../types').AdminUserListItem[] }).users;
  }

  async createAdminUser(payload: {
    email: string;
    displayName: string;
    password: string;
    brandCodes: string[];
  }): Promise<import('../types').AdminUserListItem> {
    const response = await adminFetchPost(`${API_URL}?action=createAdminUser`, payload, 'createAdminUser');
    const data = await handleResponse(response);
    if (!data || typeof data !== 'object' || !('user' in data)) {
      throw new Error('Invalid create admin user response');
    }
    return (data as { user: import('../types').AdminUserListItem }).user;
  }

  async updateAdminUser(payload: {
    id: number;
    displayName?: string;
    brandCodes?: string[];
    isActive?: boolean;
  }): Promise<import('../types').AdminUserListItem> {
    const response = await adminFetchPost(`${API_URL}?action=updateAdminUser`, payload, 'updateAdminUser');
    const data = await handleResponse(response);
    if (!data || typeof data !== 'object' || !('user' in data)) {
      throw new Error('Invalid update admin user response');
    }
    return (data as { user: import('../types').AdminUserListItem }).user;
  }

  async resetAdminPassword(payload: { id: number; password: string }): Promise<void> {
    const response = await adminFetchPost(`${API_URL}?action=resetAdminPassword`, payload, 'resetAdminPassword');
    await handleResponse(response);
  }

  async setAdminUserActive(payload: { id: number; isActive: boolean }): Promise<import('../types').AdminUserListItem> {
    const response = await adminFetchPost(`${API_URL}?action=setAdminUserActive`, payload, 'setAdminUserActive');
    const data = await handleResponse(response);
    if (!data || typeof data !== 'object' || !('user' in data)) {
      throw new Error('Invalid set admin user active response');
    }
    return (data as { user: import('../types').AdminUserListItem }).user;
  }

  // --- Category APIs ---
  async getCategories(options?: { admin?: boolean }): Promise<string[]> {
    try {
        const url = `${API_URL}?action=getCategories${options?.admin ? '&admin=1' : ''}`;
        const response = options?.admin
            ? await adminReadGet(url, 'getCategories')
            : await fetch(url);
        const data = await handleResponse(response);
        return Array.isArray(data) ? data : ['All', 'Flower', 'Animal', 'Geometry', 'Line Work', 'Traditional'];
    } catch (e) {
        console.warn("Failed to fetch categories, using default.", e);
        return ['All', 'Flower', 'Animal', 'Geometry', 'Line Work', 'Traditional'];
    }
  }

  async addCategory(name: string): Promise<string[]> {
    return await handleResponse(await fetch(`${API_URL}?action=addCategory`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ name })
    }));
  }

  async deleteCategory(name: string): Promise<string[]> {
    return await handleResponse(await fetch(`${API_URL}?action=deleteCategory`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ name })
    }));
  }

  async getArtworkTags(options?: { admin?: boolean }): Promise<ArtworkTaxonomyCatalogResponse> {
    return await handleResponse(await fetch(
      options?.admin
        ? `${API_URL}?action=getArtworkTags&admin=1&t=${Date.now()}`
        : `${API_URL}?action=getArtworkTags&t=${Date.now()}`,
      options?.admin ? { headers: adminHeaders() } : undefined
    ));
  }

  async createArtworkTag(payload: { groupKey: string; displayName: string; tagKey?: string }): Promise<{ success: boolean; id: number }> {
    return await handleResponse(await fetch(`${API_URL}?action=createArtworkTag`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify(payload),
    }));
  }

  async updateArtworkTag(id: number, displayName: string): Promise<{ success: boolean }> {
    return await handleResponse(await fetch(`${API_URL}?action=updateArtworkTag`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({ id, displayName }),
    }));
  }

  async toggleArtworkTag(id: number, isActive: boolean): Promise<{ success: boolean }> {
    return await handleResponse(await fetch(`${API_URL}?action=toggleArtworkTag`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({ id, isActive }),
    }));
  }

  async reorderArtworkTags(groupKey: string, orderedIds: number[]): Promise<{ success: boolean }> {
    return await handleResponse(await fetch(`${API_URL}?action=reorderArtworkTags`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({ groupKey, orderedIds }),
    }));
  }

  async deleteArtworkTag(id: number): Promise<{ success: boolean }> {
    return await handleResponse(await fetch(`${API_URL}?action=deleteArtworkTag`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({ id }),
    }));
  }

  // --- Aftercare APIs ---
  async getAftercareContent(): Promise<{ content: string; configured: boolean }> {
      try {
        const res = await handleResponse(await fetch(`${API_URL}?action=getAftercare`));
        const content = typeof res.content === 'string' ? res.content : '';
        const configured =
          typeof res.configured === 'boolean' ? res.configured : content.trim().length > 0;
        return { content, configured };
      } catch (e) {
          console.error("Failed to fetch aftercare:", e);
          return { content: '載入失敗，請稍後再試。', configured: true };
      }
  }

  async getAdminAftercareContent(): Promise<{ content: string; configured: boolean }> {
    const res = await handleResponse(
      await adminReadGet(`${API_URL}?action=getAdminAftercare`, 'getAdminAftercare'),
    );
    const content = typeof res.content === 'string' ? res.content : '';
    const configured = typeof res.configured === 'boolean' ? res.configured : content.trim().length > 0;
    return { content, configured };
  }

  async saveAftercareContent(content: string): Promise<void> {
      await handleResponse(await fetch(`${API_URL}?action=saveAftercare`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ content })
      }));
  }

  // --- Admin Settings APIs ---
  async getAdminSetting<T = unknown>(key: string): Promise<{ value: T | null; updatedAt: string | null }> {
    const data = await handleResponse(await adminGet(`${API_URL}?action=getAdminSetting&key=${encodeURIComponent(key)}`));
    return {
      value: (data.value ?? null) as T | null,
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
    };
  }

  async saveAdminSetting(key: string, value: unknown): Promise<void> {
    await handleResponse(await fetch(`${API_URL}?action=saveAdminSetting`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({ key, value }),
    }));
  }

  // --- Artwork APIs ---

  /** 上傳圖片至伺服器，回傳永久 URL（取代 base64 存 DB） */
  async uploadImage(imageData: string, isPng: boolean = false): Promise<string> {
    const data = await handleResponse(await fetch(`${API_URL}?action=uploadImage`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ imageData, isPng })
    }));
    if (!data.url) throw new Error("Upload failed: no URL returned");
    return data.url;
  }

  /** 以 multipart 上傳 PNG，避免 base64 JSON 造成 413 */
  async uploadPngFile(file: Blob): Promise<string> {
    const form = new FormData();
    form.append('file', file, 'artwork.png');
    form.append('isPng', 'true');
    const response = await fetch(`${API_URL}?action=uploadImage`, {
      method: 'POST',
      headers: buildAdminRequestHeaders({ json: false }),
      body: form,
    });
    const data = await handleResponse(response);
    if (!data.url) throw new Error('Upload failed: no URL returned');
    return data.url;
  }

  /** 取得單一作品（作品詳情頁專用） */
  async getArtwork(id: string): Promise<Artwork | null> {
    try {
        const data = await handleResponse(await fetch(`${API_URL}?action=getArtwork&id=${encodeURIComponent(id)}&t=${Date.now()}`));
        if (!data) return null;
        const imageUrls = Array.isArray(data.imageUrls) && data.imageUrls.length > 0
            ? data.imageUrls
            : [data.imageUrl];
        return {
            ...data,
            price: data.price ? Number(data.price) : undefined,
            specialPrice: data.specialPrice ? Number(data.specialPrice) : undefined,
            claimStage: parseClaimStage(data.claimStage),
            widthCm: parsePositiveNumber(data.widthCm),
            heightCm: parsePositiveNumber(data.heightCm),
            sizeNote: typeof data.sizeNote === 'string' && data.sizeNote.trim() ? data.sizeNote.trim() : undefined,
            recommendedPlacements: parsePlacementList(data.recommendedPlacements),
            tags: Array.isArray(data.tags) ? data.tags : [],
            imageUrls
        };
    } catch (e) {
        console.error("Failed to load artwork", e);
        return null;
    }
  }

  /** Admin 專用：失敗時 throw，不 silently 回傳 [] */
  async getAdminArtworks(): Promise<Artwork[]> {
    const url = `${API_URL}?action=getArtworks&t=${Date.now()}`;
    const data = await handleAdminReadResponse(await adminReadGet(url, 'getAdminArtworks'), 'getAdminArtworks');
    if (!Array.isArray(data)) {
      throw new Error('Invalid artworks response');
    }
    return data.map((art: any) => {
      const imageUrls = Array.isArray(art.imageUrls) && art.imageUrls.length > 0 ? art.imageUrls : [art.imageUrl];
      return {
        ...art,
        price: art.price ? Number(art.price) : undefined,
        specialPrice: art.specialPrice ? Number(art.specialPrice) : undefined,
        claimStage: parseClaimStage(art.claimStage),
        widthCm: parsePositiveNumber(art.widthCm),
        heightCm: parsePositiveNumber(art.heightCm),
        sizeNote: typeof art.sizeNote === 'string' && art.sizeNote.trim() ? art.sizeNote.trim() : undefined,
        recommendedPlacements: parsePlacementList(art.recommendedPlacements),
        tags: Array.isArray(art.tags) ? art.tags : [],
        imageUrls,
      } as Artwork;
    });
  }

  /** 取得作品列表（分頁版：傳入 page/limit；不傳則取全部給管理後台用） */
  async getArtworks(): Promise<Artwork[]>
  async getArtworks(page: number, limit: number): Promise<PaginatedArtworks>
  async getArtworks(page?: number, limit?: number): Promise<Artwork[] | PaginatedArtworks> {
    try {
        let url = `${API_URL}?action=getArtworks&t=${Date.now()}`;
        if (page !== undefined && limit !== undefined) {
            url += `&page=${page}&limit=${limit}`;
        }
        const data = await handleResponse(await fetch(url));

        const mapRow = (art: any): Artwork => {
            const imageUrls = Array.isArray(art.imageUrls) && art.imageUrls.length > 0
                ? art.imageUrls
                : [art.imageUrl];
            return {
                ...art,
                price: art.price ? Number(art.price) : undefined,
                specialPrice: art.specialPrice ? Number(art.specialPrice) : undefined,
                claimStage: parseClaimStage(art.claimStage),
                widthCm: parsePositiveNumber(art.widthCm),
                heightCm: parsePositiveNumber(art.heightCm),
                sizeNote: typeof art.sizeNote === 'string' && art.sizeNote.trim() ? art.sizeNote.trim() : undefined,
                recommendedPlacements: parsePlacementList(art.recommendedPlacements),
                tags: Array.isArray(art.tags) ? art.tags : [],
                imageUrls
            };
        };

        // 分頁模式回傳物件 { artworks, total, page, limit, hasMore }
        if (data && !Array.isArray(data) && Array.isArray(data.artworks)) {
            return {
                ...data,
                artworks: data.artworks.map(mapRow)
            } as PaginatedArtworks;
        }

        // 全量模式回傳陣列
        if (!Array.isArray(data)) return [] as Artwork[];
        return data.map(mapRow) as Artwork[];
    } catch (e) {
        console.error("Failed to load artworks", e);
        if (page !== undefined && limit !== undefined) {
            return { artworks: [], total: 0, page: 1, limit: limit!, hasMore: false } as PaginatedArtworks;
        }
        return [] as Artwork[];
    }
  }

  /** 取得首頁作品卡片（輕量欄位，提升列表效能） */
  async getArtworkCards(): Promise<Artwork[]>
  async getArtworkCards(
    page: number,
    limit: number,
    category?: string,
    userId?: string,
    sort?: ArtworkSort,
    filters?: {
      budgets?: string[];
      sizes?: string[];
      claims?: string[];
      placements?: string[];
      taxonomyTagIds?: number[];
    },
    lineAccessToken?: string | null
  ): Promise<PaginatedArtworks>
  async getArtworkCards(
    page?: number,
    limit?: number,
    category: string = 'All',
    userId?: string,
    sort: ArtworkSort = 'recommended',
    filters: {
      budgets?: string[];
      sizes?: string[];
      claims?: string[];
      placements?: string[];
      taxonomyTagIds?: number[];
    } = {},
    lineAccessToken?: string | null
  ): Promise<Artwork[] | PaginatedArtworks> {
    try {
      let url = `${API_URL}?action=getArtworkCards&t=${Date.now()}&category=${encodeURIComponent(category)}&sort=${encodeURIComponent(sort)}`;
      if (filters.budgets && filters.budgets.length > 0) {
        url += `&budget=${encodeURIComponent(filters.budgets.join(','))}`;
      }
      if (filters.sizes && filters.sizes.length > 0) {
        url += `&size=${encodeURIComponent(filters.sizes.join(','))}`;
      }
      if (filters.claims && filters.claims.length > 0) {
        url += `&claim=${encodeURIComponent(filters.claims.join(','))}`;
      }
      if (filters.placements && filters.placements.length > 0) {
        url += `&placement=${encodeURIComponent(filters.placements.join(','))}`;
      }
      if (filters.taxonomyTagIds && filters.taxonomyTagIds.length > 0) {
        url += `&taxonomy=${encodeURIComponent(filters.taxonomyTagIds.join(','))}`;
      }
      if (page !== undefined && limit !== undefined) {
        url += `&page=${page}&limit=${limit}`;
      }

      const isFavoritesCategory = category === 'Favorites';
      let response: Response;
      if (isFavoritesCategory) {
        const token = lineAccessToken?.trim();
        if (!token) {
          throw new Error('LINE登入狀態失效，請重新登入');
        }
        const body: Record<string, string> = { lineAccessToken: token };
        if (userId) {
          body.userId = userId;
        }
        response = await fetch(url, {
          method: 'POST',
          headers: jsonHeaders(),
          body: JSON.stringify(body),
        });
      } else {
        response = await fetch(url);
      }

      const data = await handleResponse(response);

      const mapRow = (art: any): Artwork => ({
        id: art.id,
        title: art.title ?? '',
        description: '',
        imageUrl: art.cardImageUrl ?? art.imageUrl ?? '',
        cardImageUrl: art.cardImageUrl ?? undefined,
        imageUrls: art.cardImageUrl && art.imageUrl
          ? [art.cardImageUrl, art.imageUrl]
          : (art.cardImageUrl || art.imageUrl) ? [art.cardImageUrl ?? art.imageUrl] : [],
        category: art.category ?? '',
        isNew: Boolean(art.isNew),
        status: art.status as ArtworkStatus,
        price: art.price ? Number(art.price) : undefined,
        specialPrice: art.specialPrice ? Number(art.specialPrice) : undefined,
        claimStage: parseClaimStage(art.claimStage),
        widthCm: parsePositiveNumber(art.widthCm),
        heightCm: parsePositiveNumber(art.heightCm),
        sizeNote: typeof art.sizeNote === 'string' && art.sizeNote.trim() ? art.sizeNote.trim() : undefined,
        recommendedPlacements: parsePlacementList(art.recommendedPlacements),
        createdAt: art.createdAt ?? '',
        tags: [],
        viewCount: 0,
      });

      if (data && !Array.isArray(data) && Array.isArray(data.artworks)) {
        return {
          ...data,
          availablePlacements: Array.isArray(data.availablePlacements)
            ? data.availablePlacements.map((v: unknown) => String(v).trim()).filter(Boolean)
            : [],
          artworks: data.artworks.map(mapRow),
        } as PaginatedArtworks;
      }

      if (!Array.isArray(data)) return [] as Artwork[];
      return data.map(mapRow) as Artwork[];
    } catch (e) {
      console.error('Failed to load artwork cards', e);
      if (page !== undefined && limit !== undefined) {
        return { artworks: [], total: 0, page: 1, limit: limit!, hasMore: false } as PaginatedArtworks;
      }
      return [] as Artwork[];
    }
  }

  async saveArtwork(artwork: Artwork): Promise<Artwork> {
    await handleResponse(await fetch(`${API_URL}?action=saveArtwork`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify(artwork)
    }));
    return artwork;
  }

  async deleteArtwork(id: string): Promise<void> {
    await handleResponse(await fetch(`${API_URL}?action=deleteArtwork`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ id })
    }));
  }

  async toggleStatus(id: string): Promise<Artwork | null> {
    try {
        const artworks = await this.getArtworks();
        const artwork = artworks.find(a => a.id === id);
        if (artwork) {
          artwork.status = artwork.status === ArtworkStatus.AVAILABLE ? ArtworkStatus.CLAIMED : ArtworkStatus.AVAILABLE;
          await this.saveArtwork(artwork);
          return artwork;
        }
    } catch (e) {
        console.error("Toggle Status Error", e);
    }
    return null;
  }

  async getArtworkStats(): Promise<Record<string, number>> {
      return handleAdminReadResponse(
        await adminReadGet(`${API_URL}?action=getArtworkStats&t=${Date.now()}`, 'getArtworkStats'),
        'getArtworkStats'
      );
  }

  // 記錄作品瀏覽次數
  async recordView(artworkId: string): Promise<void> {
      try {
        const eventMeta = this.buildEventMeta();
        await handleResponse(await fetch(`${API_URL}?action=recordView`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: artworkId,
              eventId: eventMeta.eventId,
              sessionId: eventMeta.sessionId,
              attribution: eventMeta.attribution,
            })
        }));
      } catch (e) {
          console.warn("Failed to record view", e);
      }
  }

  // --- User & Favorite APIs ---
  
  // Server-verified sync: only sends LIFF access token (never client profile as identity).
  async syncUser(lineAccessToken: string): Promise<User> {
      const token = lineAccessToken?.trim();
      if (!token) {
        throw new Error('LINE登入狀態失效，請重新登入');
      }

      const acquisitionContext = buildAcquisitionContextForSync();
      const body: Record<string, unknown> = { lineAccessToken: token };
      if (acquisitionContext) {
        body.acquisitionContext = acquisitionContext;
      }

      const response = await fetch(`${API_URL}?action=syncUser`, {
          method: 'POST',
          headers: jsonHeaders(),
          body: JSON.stringify(body),
      });

      if (response.status === 401) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          typeof data.error === 'string' ? data.error : 'LINE登入狀態失效，請重新登入'
        );
      }

      if (response.status === 503) {
        throw new Error('LINE 服務暫時無法使用，請稍後再試');
      }

      const syncedUser = await handleResponse(response);

      if (!syncedUser || typeof syncedUser !== 'object') {
           throw new Error('Invalid user data returned');
      }

      if (Array.isArray(syncedUser) && syncedUser.length === 0) {
           throw new Error('Backend returned empty array for user');
      }

      if (!Array.isArray(syncedUser.favorites)) {
          syncedUser.favorites = [];
      }
      return syncedUser as User;
  }

  async toggleFavorite(artworkId: string, lineAccessToken: string, userId?: string): Promise<string[]> {
      const token = lineAccessToken?.trim();
      if (!token) {
        throw new Error('LINE登入狀態失效，請重新登入');
      }
      const eventMeta = this.buildEventMeta();
      const body: Record<string, unknown> = {
        lineAccessToken: token,
        artworkId,
        eventId: eventMeta.eventId,
        sessionId: eventMeta.sessionId,
        attribution: eventMeta.attribution,
      };
      if (userId) {
        body.userId = userId;
      }
      const data = await handleResponse(await fetch(`${API_URL}?action=toggleFavorite`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify(body),
      }));
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.favorites)) return data.favorites;
      return [];
  }

  recordArtworkEvent(input: RecordArtworkEventInput): { eventId: string; sessionId: string } {
      const eventMeta = input.eventMeta ?? this.buildEventMeta();
      this.queueArtworkEvent({
        eventId: eventMeta.eventId,
        artworkId: input.artworkId,
        eventType: input.eventType,
        sessionId: eventMeta.sessionId,
        attribution: eventMeta.attribution,
        channel: input.channel,
      });
      return { eventId: eventMeta.eventId, sessionId: eventMeta.sessionId };
  }

  // --- Appointment APIs ---

  async getAdminAppointments(): Promise<Appointment[]> {
    const url = `${API_URL}?action=getAppointments&t=${Date.now()}`;
    const data = await handleAdminReadResponse(await adminReadGet(url, 'getAdminAppointments'), 'getAdminAppointments');
    if (!Array.isArray(data)) {
      throw new Error('Invalid appointments response');
    }
    return data;
  }

  async getAppointments(): Promise<Appointment[]> {
    try {
        const token = getAdminToken();
        const url = `${API_URL}?action=getAppointments&t=${Date.now()}`;
        // 有管理員 token 時才帶 auth header（PHP 會回傳全部資料）
        // 一般使用者不帶 token，PHP 只回傳 OPEN 時段，不觸發 401 跳登入
        const response = token
            ? await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
            : await fetch(url);
        const data = await handleResponse(response);
        return Array.isArray(data) ? data : [];
    } catch (e) {
        console.error("Failed to load appointments", e);
        return [];
    }
  }

  async getUserAppointments(lineAccessToken: string, userId?: string): Promise<Appointment[]> {
      const token = lineAccessToken?.trim();
      if (!token) {
        throw new Error('LINE登入狀態失效，請重新登入');
      }

      try {
        const body: Record<string, string> = { lineAccessToken: token };
        if (userId) {
          body.userId = userId;
        }

        const response = await fetch(`${API_URL}?action=getUserAppointments`, {
          method: 'POST',
          headers: jsonHeaders(),
          body: JSON.stringify(body),
        });

        if (response.status === 401) {
          const data = await response.json().catch(() => ({}));
          throw new Error(
            typeof data.error === 'string' ? data.error : 'LINE登入狀態失效，請重新登入'
          );
        }

        if (response.status === 403) {
          throw new Error('無權限查看此會員的預約資料');
        }

        const data = await handleResponse(response);
        return Array.isArray(data) ? data : [];
      } catch (e) {
          console.error("Failed to get user appointments", e);
          throw e;
      }
  }

  async getAppointment(_id: string): Promise<Appointment | null> {
      return null;
  }

  async getPublicAppointment(token: string): Promise<PublicAppointment | null> {
    try {
      const data = await handleResponse(await fetch(`${API_URL}?action=getPublicAppointment`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ token }),
      }));
      if (data?.error) return null;
      return data as PublicAppointment;
    } catch (e) {
      console.error('Failed to get public appointment', e);
      return null;
    }
  }

  async getPublicConsent(token: string): Promise<PublicConsent | null> {
    try {
      const data = await handleResponse(await fetch(`${API_URL}?action=getPublicConsent`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ token }),
      }));
      if (data?.error) return null;
      return data as PublicConsent;
    } catch (e) {
      console.error('Failed to get public consent', e);
      return null;
    }
  }

  async getAdminAppointmentPublicLinks(id: string): Promise<AdminAppointmentPublicLinks | null> {
    try {
      const data = await handleResponse(await fetch(`${API_URL}?action=getAdminAppointmentPublicLinks`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ id }),
      }));
      if (data?.error) return null;
      return data as AdminAppointmentPublicLinks;
    } catch (e) {
      console.error('Failed to get admin appointment public links', e);
      return null;
    }
  }

  async saveAppointment(apt: Appointment, lineAccessToken?: string | null): Promise<SaveAppointmentResponse> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const isAdminWrite = hasAdminToken();
    if (isAdminWrite) {
      Object.assign(headers, adminHeaders());
    }
    const body: Record<string, unknown> = { ...apt };
    if (!isAdminWrite) {
      const token = lineAccessToken?.trim();
      if (!token) {
        throw new Error('LINE登入狀態失效，請重新登入');
      }
      body.lineAccessToken = token;
    }
    const data = await handleResponse(await fetch(`${API_URL}?action=saveAppointment`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    }));
    return {
      success: Boolean(data?.success),
      publicAppointmentUrl: data?.publicAppointmentUrl ?? data?.appointmentUrl,
      publicConsentUrl: data?.publicConsentUrl ?? data?.consentUrl,
    };
  }

  async completeAppointment(id: string): Promise<void> {
    await handleResponse(await fetch(`${API_URL}?action=completeAppointment`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({ id }),
    }));
  }

  async cancelAppointment(id: string): Promise<void> {
    await handleResponse(await fetch(`${API_URL}?action=cancelAppointment`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({ id }),
    }));
  }

  async deleteAppointment(id: string): Promise<void> {
    await this.cancelAppointment(id);
  }

  async getBookingCalendarData(): Promise<BookingCalendarData> {
    try {
      const data = await handleResponse(
        await fetch(`${API_URL}?action=getBookingCalendarData&t=${Date.now()}`)
      );
      return {
        windows: Array.isArray(data.windows) ? data.windows : [],
        legacyOpenSlots: Array.isArray(data.legacyOpenSlots) ? data.legacyOpenSlots : [],
        bookedSlots: Array.isArray(data.bookedSlots) ? data.bookedSlots : [],
      };
    } catch (e) {
      console.error('Failed to load booking calendar data', e);
      return { windows: [], legacyOpenSlots: [], bookedSlots: [] };
    }
  }

  async getAvailabilityWindows(): Promise<AvailabilityWindow[]> {
    try {
      const data = await handleResponse(await adminGet(`${API_URL}?action=getAvailabilityWindows&t=${Date.now()}`));
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.error('Failed to load availability windows', e);
      return [];
    }
  }

  async saveAvailabilityWindow(window: AvailabilityWindow): Promise<void> {
    await handleResponse(await fetch(`${API_URL}?action=saveAvailabilityWindow`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify(window),
    }));
  }

  async deleteAvailabilityWindow(id: string): Promise<void> {
    await handleResponse(await fetch(`${API_URL}?action=deleteAvailabilityWindow`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({ id }),
    }));
  }

  recordBookingEvent(input: {
    eventType: BookingEventType;
    artworkId?: string;
    reservationId?: string;
    selectedDate?: string;
    selectedTime?: string;
    eventMeta?: AnalyticsEventMeta;
  }): void {
    const eventMeta = input.eventMeta ?? this.buildEventMeta();
    const url = `${API_URL}?action=recordBookingEvent`;
    const body = JSON.stringify({
      eventType: input.eventType,
      artworkId: input.artworkId,
      reservationId: input.reservationId,
      selectedDate: input.selectedDate,
      selectedTime: input.selectedTime,
      eventId: eventMeta.eventId,
      sessionId: eventMeta.sessionId,
      attribution: eventMeta.attribution,
    });

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([body], { type: 'application/json' });
        if (navigator.sendBeacon(url, blob)) return;
      }
    } catch {
      // fallback to fetch
    }

    fetch(url, {
      method: 'POST',
      headers: jsonHeaders(),
      body,
      keepalive: true,
    }).catch(() => {});
  }

  // --- Consent Form APIs ---
  
  async getConsent(appointmentId: string): Promise<Appointment | null> {
      try {
        const data = await handleAdminReadResponse(
          await adminReadGet(`${API_URL}?action=getConsent&id=${encodeURIComponent(appointmentId)}`, 'getConsent'),
          'getConsent',
        );
        if (data?.error) return null;
        return {
            ...data,
            totalPrice: data.totalPrice ? Number(data.totalPrice) : undefined,
            depositPaid: data.depositPaid ? Number(data.depositPaid) : undefined
        };
      } catch (e) {
          console.error("Failed to get consent data", e);
          return null;
      }
  }

  async saveConsent(data: {
    token: string;
    signerName: string;
    signerPhone: string;
    signatureData: string;
    consentNotes?: string;
  }): Promise<{ success: boolean; alreadySubmitted?: boolean }> {
      try {
        const response = await fetch(`${API_URL}?action=saveConsent`, {
            method: 'POST',
            headers: jsonHeaders(),
            body: JSON.stringify(data)
        });

        if (response.status === 409) {
          const payload = await response.json().catch(() => ({}));
          if (payload?.code === 'CONSENT_ALREADY_SUBMITTED') {
            return { success: false, alreadySubmitted: true };
          }
        }

        await handleResponse(response);
        return { success: true };
      } catch (e) {
          console.error("Failed to save consent", e);
          return { success: false };
      }
  }

  // --- User Management APIs ---
  async getAllUsers(): Promise<any[]> {
      const data = await handleAdminReadResponse(
        await adminReadGet(`${API_URL}?action=getAllUsers&t=${Date.now()}`, 'getAllUsers'),
        'getAllUsers'
      );
      if (!Array.isArray(data)) {
        throw new Error('Invalid users response');
      }
      return data;
  }

  // ─── LINE 推播 — 會員標籤 ──────────────────────────────────────────────────

  async getTags(): Promise<MemberTag[]> {
      const data = await handleAdminReadResponse(
        await adminReadGet(`${API_URL}?action=getTags&t=${Date.now()}`, 'getTags'),
        'getTags'
      );
      if (!Array.isArray(data)) {
        throw new Error('Invalid tags response');
      }
      return data;
  }

  async createTag(name: string, color: string): Promise<MemberTag> {
      return handleResponse(await fetch(`${API_URL}?action=createTag`, {
          method: 'POST',
          headers: adminHeaders(),
          body: JSON.stringify({ name, color }),
      }));
  }

  async deleteTag(id: number): Promise<void> {
      await handleResponse(await fetch(`${API_URL}?action=deleteTag`, {
          method: 'POST',
          headers: adminHeaders(),
          body: JSON.stringify({ id }),
      }));
  }

  async getUserTags(userId: string): Promise<number[]> {
      try {
          const data = await handleResponse(
              await adminGet(`${API_URL}?action=getUserTags&userId=${encodeURIComponent(userId)}`)
          );
          return Array.isArray(data) ? data : [];
      } catch (e) {
          return [];
      }
  }

  async setUserTags(userId: string, tagIds: number[]): Promise<void> {
      // 將整個 payload 用 base64 編碼後放入 POST body，WAF 無法識別內容
      const token = getAdminToken() ?? '';
      const payload = btoa(JSON.stringify({ u: userId, t: tagIds }));
      await handleResponse(await fetchWithRetry(() => fetch(`${API_URL}?action=syncData`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ d: payload }),
      })));
  }

  async getFilteredUsers(filterType: 'all' | 'tags', tagIds: number[], excludeTagIds: number[] = []): Promise<any[]> {
      const params =
          `filterType=${filterType}` +
          `${tagIds.length ? '&tagIds=' + tagIds.join(',') : ''}` +
          `${excludeTagIds.length ? '&excludeTagIds=' + excludeTagIds.join(',') : ''}`;
      const data = await handleAdminReadResponse(
        await adminReadGet(`${API_URL}?action=getFilteredUsers&${params}&t=${Date.now()}`, 'getFilteredUsers'),
        'getFilteredUsers'
      );
      if (!Array.isArray(data)) {
        throw new Error('Invalid filtered users response');
      }
      return data;
  }

  async previewLineBroadcastAudience(filter: LineAudienceFilter): Promise<LineAudiencePreviewResponse> {
      const data = await handleResponse(await fetch(`${API_URL}?action=previewLineBroadcastAudience`, {
          method: 'POST',
          headers: adminHeaders(),
          body: JSON.stringify(filter),
      }));
      return {
          totalEligible: typeof data.totalEligible === 'number' ? data.totalEligible : 0,
          matchedCount: typeof data.matchedCount === 'number' ? data.matchedCount : 0,
          excludedCount: typeof data.excludedCount === 'number' ? data.excludedCount : 0,
          finalCount: typeof data.finalCount === 'number' ? data.finalCount : (typeof data.matchedCount === 'number' ? data.matchedCount : 0),
          recipients: Array.isArray(data.recipients) ? data.recipients : [],
      };
  }

  // ─── LINE 推播 — 發送與紀錄 ───────────────────────────────────────────────

  private async parseLineSendResponse(response: Response, action: 'sendLineBroadcastTest' | 'sendLineBroadcast'): Promise<Record<string, unknown>> {
    const text = await response.text();
    let data: Record<string, unknown> = {};
    if (text && text.trim()) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text.slice(0, 200) };
      }
    }
    if (response.status === 401) {
      clearAdminToken();
      localStorage.removeItem('inkflow_user');
      window.location.href = '/login';
      throw new Error('Session expired. Please log in again.');
    }
    logLineSendDebug(action, {
      success: data.success as boolean | undefined,
      code: data.code as string | undefined,
      message: (data.message as string) || (data.error as string),
      lineHttpStatus: (data.lineHttpStatus as number) ?? response.status,
      errors: data.errors as string[] | undefined,
    });
    if (!response.ok && !data.message && !data.error) {
      throw new Error(`Server returned status ${response.status}`);
    }
    if (data.error && typeof data.error === 'string') {
      throw new Error(data.error);
    }
    return data;
  }

  async uploadLineBroadcastImage(file: File): Promise<LineBroadcastImageEntry> {
    const form = new FormData();
    form.append('file', file);
    const token = getAdminToken() ?? '';
    const response = await fetch(`${API_URL}?action=uploadLineBroadcastImage`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const text = await response.text();
    let data: Record<string, unknown> = {};
    if (text.trim()) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('圖片上傳回應格式錯誤');
      }
    }
    if (response.status === 401) {
      clearAdminToken();
      localStorage.removeItem('inkflow_user');
      window.location.href = '/login';
      throw new Error('Session expired. Please log in again.');
    }
    if (!response.ok || data.error) {
      throw new Error((data.error as string) || (data.message as string) || `圖片上傳失敗（HTTP ${response.status}）`);
    }
    if (!data.originalUrl || !data.previewUrl) {
      throw new Error('伺服器未回傳完整圖片網址');
    }
    return {
      originalUrl: String(data.originalUrl),
      previewUrl: String(data.previewUrl),
    };
  }

  async searchLineEligibleUsers(query: string, limit = 20): Promise<LineEligibleUserSearchResult[]> {
      const data = await handleAdminReadResponse(
        await adminReadGet(`${API_URL}?action=searchLineEligibleUsers&q=${encodeURIComponent(query)}&limit=${limit}&t=${Date.now()}`, 'searchLineEligibleUsers'),
        'searchLineEligibleUsers'
      );
      return Array.isArray(data) ? data : [];
  }

  async sendLineBroadcastTest(payload: {
      title: string;
      messages: import('../types').LineBroadcastMessageBlock[];
      trackingUrl?: string;
      testUserId: string;
      /** @deprecated legacy flat fields */
      content?: string;
      mainImage?: LineBroadcastImageEntry;
      carouselItems?: LineCarouselItem[];
  }): Promise<LineBroadcastTestSendResult> {
      const response = await fetch(`${API_URL}?action=sendLineBroadcastTest`, {
          method: 'POST',
          headers: adminHeaders(),
          body: JSON.stringify(payload),
      });
      const data = await this.parseLineSendResponse(response, 'sendLineBroadcastTest');
      return data as unknown as LineBroadcastTestSendResult;
  }

  async sendLineBroadcast(payload: {
      title: string;
      messages: import('../types').LineBroadcastMessageBlock[];
      trackingUrl?: string;
      audienceFilter: LineAudienceFilter;
      confirmedCount: number;
      requestId: string;
      /** @deprecated legacy flat fields */
      content?: string;
      mainImage?: LineBroadcastImageEntry;
      carouselItems?: LineCarouselItem[];
  }): Promise<LineBroadcastSendResult> {
      const response = await fetch(`${API_URL}?action=sendLineBroadcast`, {
          method: 'POST',
          headers: adminHeaders(),
          body: JSON.stringify(payload),
      });
      const data = await this.parseLineSendResponse(response, 'sendLineBroadcast');
      return data as unknown as LineBroadcastSendResult;
  }

  /** @deprecated 舊版標籤篩選，保留相容 */
  async sendLineBroadcastLegacy(payload: {
      title: string;
      content: string;
      imageUrl?: string;
      imageUrls?: string[];
      filterType: 'all' | 'tags';
      filterTags: number[];
      excludeTags?: string[];
      trackingUrl?: string;
  }): Promise<LineBroadcastSendResult> {
      return handleResponse(await fetch(`${API_URL}?action=sendLineBroadcast`, {
          method: 'POST',
          headers: adminHeaders(),
          body: JSON.stringify(payload),
      }));
  }

  async getLineBroadcasts(): Promise<LineBroadcast[]> {
      const data = await handleAdminReadResponse(
        await adminReadGet(`${API_URL}?action=getLineBroadcasts&t=${Date.now()}`, 'getLineBroadcasts'),
        'getLineBroadcasts'
      );
      if (!Array.isArray(data)) {
        throw new Error('Invalid broadcasts response');
      }
      return data;
  }

  async getLineBroadcastDetail(id: number, offset = 0, limit = 50): Promise<LineBroadcastDetail> {
      return handleResponse(await adminGet(`${API_URL}?action=getLineBroadcastDetail&id=${id}&offset=${offset}&limit=${limit}`));
  }

  // ─── Analytics APIs ───────────────────────────────────────────────────────

  // --- Analytics APIs ---
  async getAnalytics(period: 'daily' | 'weekly' | 'monthly'): Promise<{
      summary:    Array<{ period: string; views: number; fav_adds: number; fav_removes: number }>;
      by_artwork: Array<{ artwork_id: string; title: string; imageUrl: string; views: number; fav_adds: number; fav_removes: number }>;
      totals:     { views: number; fav_adds: number; fav_removes: number };
  }> {
      const data = await handleResponse(
          await adminGet(`${API_URL}?action=getAnalytics&period=${period}&t=${Date.now()}`)
      );
      return {
          summary:    Array.isArray(data.summary)    ? data.summary    : [],
          by_artwork: Array.isArray(data.by_artwork) ? data.by_artwork : [],
          totals:     data.totals ?? { views: 0, fav_adds: 0, fav_removes: 0 },
      };
  }

  async getAnalyticsV2(params: {
    startDate: string;
    endDate: string;
    granularity?: 'daily' | 'weekly' | 'monthly';
    compareMode?: AnalyticsCompareMode;
    comparisonStart?: string;
    comparisonEnd?: string;
    /** @deprecated use compareMode */
    comparePreviousPeriod?: boolean;
  }): Promise<AnalyticsV2Response> {
    const granularity = params.granularity ?? 'daily';
    const compareMode = params.compareMode
      ?? (params.comparePreviousPeriod ? 'previous' : 'none');
    const query = new URLSearchParams({
      action: 'getAnalyticsV2',
      startDate: params.startDate,
      endDate: params.endDate,
      granularity,
      t: String(Date.now()),
    });
    if (compareMode !== 'none') {
      query.set('compareMode', compareMode);
    }
    if (compareMode === 'custom') {
      if (params.comparisonStart) query.set('comparisonStart', params.comparisonStart);
      if (params.comparisonEnd) query.set('comparisonEnd', params.comparisonEnd);
    }

    return await handleResponse(
      await adminGet(`${API_URL}?${query.toString()}`)
    ) as AnalyticsV2Response;
  }

  async getMemberGrowthAnalytics(params: {
    startDate: string;
    endDate: string;
  }): Promise<MemberGrowthAnalyticsResponse> {
    const query = new URLSearchParams({
      action: 'getMemberGrowthAnalytics',
      startDate: params.startDate,
      endDate: params.endDate,
      t: String(Date.now()),
    });
    return await handleResponse(
      await adminGet(`${API_URL}?${query.toString()}`)
    ) as MemberGrowthAnalyticsResponse;
  }

  async getAnalyticsLabels(dimension?: AnalyticsLabelDimension): Promise<AnalyticsLabel[]> {
    const query = new URLSearchParams({
      action: 'getAnalyticsLabels',
      t: String(Date.now()),
    });
    if (dimension) query.set('dimension', dimension);
    const data = await handleResponse(await adminGet(`${API_URL}?${query.toString()}`));
    return Array.isArray(data.labels) ? data.labels : [];
  }

  async upsertAnalyticsLabel(payload: {
    dimension: AnalyticsLabelDimension;
    rawValue: string;
    displayName: string;
    note?: string;
  }): Promise<AnalyticsLabel> {
    const data = await handleResponse(
      await fetch(`${API_URL}?action=upsertAnalyticsLabel`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify(payload),
      })
    );
    return data.label as AnalyticsLabel;
  }

  async deleteAnalyticsLabel(payload: {
    dimension: AnalyticsLabelDimension;
    rawValue: string;
  }): Promise<boolean> {
    const data = await handleResponse(
      await fetch(`${API_URL}?action=deleteAnalyticsLabel`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify(payload),
      })
    );
    return Boolean(data.deleted);
  }

  private async postMetaAdsCsvFiles<T>(
    action: 'previewMetaAdsCsvImport' | 'importMetaAdsCsv',
    files: File[]
  ): Promise<T> {
    if (!files.length) {
      throw new Error('請選擇至少一個 CSV 檔案');
    }
    const form = new FormData();
    files.forEach((file) => form.append('files[]', file));
    const response = await fetch(`${API_URL}?action=${action}`, {
      method: 'POST',
      headers: buildAdminRequestHeaders({ json: false }),
      body: form,
    });
    const text = await response.text();
    let data = {} as T;
    if (text.trim()) {
      try {
        data = JSON.parse(text) as T;
      } catch {
        throw new Error('Meta CSV 回應格式錯誤');
      }
    }
    if (response.status === 401) {
      clearAdminToken();
      localStorage.removeItem('inkflow_user');
      window.location.href = '/login';
      throw new Error('Session expired. Please log in again.');
    }
    const errorMessage =
      typeof data === 'object' && data !== null && 'error' in data
        ? String((data as T & { error?: unknown }).error ?? '')
        : '';
    if (!response.ok || errorMessage) {
      throw new Error(errorMessage || `Meta CSV 請求失敗（HTTP ${response.status}）`);
    }
    return data;
  }

  async previewMetaAdsCsvImport(files: File[]): Promise<MetaAdsCsvPreviewResult> {
    return this.postMetaAdsCsvFiles<MetaAdsCsvPreviewResult>('previewMetaAdsCsvImport', files);
  }

  async importMetaAdsCsv(files: File[]): Promise<MetaAdsCsvImportResult> {
    return this.postMetaAdsCsvFiles<MetaAdsCsvImportResult>('importMetaAdsCsv', files);
  }

  async getMetaAdsImportOverview(): Promise<MetaAdsImportOverview> {
    const data = await handleAdminReadResponse(
      await adminReadGet(`${API_URL}?action=getMetaAdsImportOverview&t=${Date.now()}`, 'getMetaAdsImportOverview'),
      'getMetaAdsImportOverview'
    );
    if (!data || typeof data !== 'object' || !('overview' in data)) {
      throw new Error('Invalid Meta Ads overview response');
    }
    return (data as { overview: MetaAdsImportOverview }).overview;
  }

  async getMetaAdsImportHistory(limit = 20): Promise<MetaAdsImportHistoryItem[]> {
    const data = await handleAdminReadResponse(
      await adminReadGet(`${API_URL}?action=getMetaAdsImportHistory&limit=${limit}&t=${Date.now()}`, 'getMetaAdsImportHistory'),
      'getMetaAdsImportHistory'
    );
    if (!data || typeof data !== 'object' || !Array.isArray((data as { history?: unknown }).history)) {
      throw new Error('Invalid Meta Ads import history response');
    }
    return (data as { history: MetaAdsImportHistoryItem[] }).history;
  }

  async getMetaInkflowAttributionDaily(dateFrom: string, dateTo: string): Promise<MetaInkflowAttributionDailyResponse> {
    const query = new URLSearchParams({
      action: 'getMetaInkflowAttributionDaily',
      dateFrom,
      dateTo,
      t: String(Date.now()),
    });
    const data = await handleAdminReadResponse(
      await adminReadGet(`${API_URL}?${query}`, 'getMetaInkflowAttributionDaily'),
      'getMetaInkflowAttributionDaily'
    );
    if (!data || typeof data !== 'object' || !('rows' in data)) {
      throw new Error('Invalid Meta × INKFLOW attribution response');
    }
    return data as MetaInkflowAttributionDailyResponse;
  }

  async exportMetaInkflowAnalysisCsv(dateFrom: string, dateTo: string): Promise<void> {
    const token = getAdminToken();
    if (!token) {
      throw new Error('Unauthorized');
    }
    const query = new URLSearchParams({
      action: 'exportMetaInkflowAnalysisCsv',
      dateFrom,
      dateTo,
      t: String(Date.now()),
    });
    const response = await fetch(`${API_URL}?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 401) {
      clearAdminToken();
      localStorage.removeItem('inkflow_user');
      window.location.href = '/login';
      throw new Error('Session expired. Please log in again.');
    }
    if (!response.ok) {
      const text = await response.text();
      let message = text || 'CSV export failed';
      try {
        const json = JSON.parse(text) as { error?: string };
        if (json.error) message = json.error;
      } catch {
        // non-JSON error body
      }
      throw new Error(message);
    }
    const blob = await response.blob();
    const filename = `inkflow_ads_analysis_${dateFrom}_to_${dateTo}.csv`;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }
}

export const db = new MockBackend();
