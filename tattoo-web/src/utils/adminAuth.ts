export const ADMIN_TOKEN_KEY = 'inkflow_admin_token';
export const ADMIN_IDENTITY_KEY = 'inkflow_admin_identity';
export const ADMIN_BRAND_KEY = 'inkflow_admin_brand';

export interface AdminIdentity {
  id: number;
  email: string;
  displayName: string;
  isSuperAdmin: boolean;
}

export class AdminNotReadyError extends Error {
  constructor(message = 'Admin 登入尚未就緒') {
    super(message);
    this.name = 'AdminNotReadyError';
  }
}

export const getAdminToken = (): string | null => localStorage.getItem(ADMIN_TOKEN_KEY);

export const hasAdminToken = (): boolean => Boolean(getAdminToken()?.trim());

export const getAdminTokenOrThrow = (): string => {
  const token = getAdminToken()?.trim();
  if (!token) throw new AdminNotReadyError();
  return token;
};

/** UX-only brand preference — backend re-validates on every request. */
export const getSavedAdminBrandCode = (): string | null => {
  const code = localStorage.getItem(ADMIN_BRAND_KEY)?.trim().toLowerCase();
  return code || null;
};

export const saveAdminBrandCode = (code: string): void => {
  localStorage.setItem(ADMIN_BRAND_KEY, code.trim().toLowerCase());
};

/** UX-only display cache — not a security authority. */
export const saveAdminIdentity = (identity: AdminIdentity): void => {
  localStorage.setItem(ADMIN_IDENTITY_KEY, JSON.stringify(identity));
};

export const getAdminIdentity = (): AdminIdentity | null => {
  const raw = localStorage.getItem(ADMIN_IDENTITY_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminIdentity;
  } catch {
    return null;
  }
};

export const clearAdminSession = (): void => {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_IDENTITY_KEY);
  localStorage.removeItem(ADMIN_BRAND_KEY);
};
