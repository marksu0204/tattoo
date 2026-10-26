import { getAdminTokenOrThrow, getSavedAdminBrandCode } from './adminAuth';
import { getDevBrandOverride } from './resolveBrand';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableStatus = (status: number) => status >= 500 || status === 429;

const devBrandRequestHeaders = (): Record<string, string> => {
  if (!import.meta.env.DEV) return {};
  const devBrand = getDevBrandOverride();
  if (!devBrand) return {};
  return { 'X-Inkflow-Dev-Brand': devBrand };
};

/** Admin effective brand header — never use on public fetch. */
export const adminBrandRequestHeaders = (): Record<string, string> => {
  const code = getSavedAdminBrandCode();
  if (!code) return {};
  return { 'X-Inkflow-Admin-Brand': code };
};

export const buildAdminRequestHeaders = (options?: { json?: boolean }): HeadersInit => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getAdminTokenOrThrow()}`,
    ...devBrandRequestHeaders(),
    ...adminBrandRequestHeaders(),
  };
  if (options?.json !== false) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
};

export function logAdminFetchError(action: string, error: unknown, status?: number) {
  if (!(import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV) return;
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[AdminFetch] action=${action} status=${status ?? 'n/a'} message=${message}`);
}

/** Admin 讀取型 GET：需 token、5xx/429/網路錯誤最多 retry 1 次 */
export async function adminReadGet(url: string, action: string): Promise<Response> {
  const attempt = () =>
    fetch(url, {
      headers: buildAdminRequestHeaders({ json: false }),
    });

  try {
    let response = await attempt();
    if (isRetryableStatus(response.status)) {
      await sleep(350);
      response = await attempt();
    }
    return response;
  } catch (error) {
    logAdminFetchError(action, error);
    await sleep(350);
    return attempt();
  }
}

/** Admin POST with brand scope headers. */
export async function adminFetchPost(url: string, body: unknown, action: string): Promise<Response> {
  const attempt = () =>
    fetch(url, {
      method: 'POST',
      headers: buildAdminRequestHeaders(),
      body: JSON.stringify(body),
    });

  try {
    let response = await attempt();
    if (isRetryableStatus(response.status)) {
      await sleep(350);
      response = await attempt();
    }
    return response;
  } catch (error) {
    logAdminFetchError(action, error);
    await sleep(350);
    return attempt();
  }
}
