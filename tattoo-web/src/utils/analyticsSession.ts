const ANALYTICS_SESSION_KEY = 'inkflow_session_id';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidUuid = (value: string): boolean => UUID_V4_REGEX.test(value);

const fallbackUuid = (): string => {
  const randomHex = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${randomHex()}${randomHex()}-${randomHex()}-4${randomHex().slice(1)}-${
    (8 + Math.floor(Math.random() * 4)).toString(16)
  }${randomHex().slice(1)}-${randomHex()}${randomHex()}${randomHex()}`;
};

const createUuid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return fallbackUuid();
};

export const createAnalyticsEventId = (): string => createUuid();

export const getAnalyticsSessionId = (): string => {
  if (typeof window === 'undefined') return createUuid();

  try {
    const stored = window.sessionStorage.getItem(ANALYTICS_SESSION_KEY)?.trim() ?? '';
    if (stored && isValidUuid(stored)) return stored;

    const nextId = createUuid();
    window.sessionStorage.setItem(ANALYTICS_SESSION_KEY, nextId);
    return nextId;
  } catch {
    return createUuid();
  }
};

