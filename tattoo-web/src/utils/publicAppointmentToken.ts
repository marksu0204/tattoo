export const PUBLIC_APPOINTMENT_TOKEN_PARAM = 't';
export const PUBLIC_APPOINTMENT_TOKEN_REGEX = /^[a-f0-9]{64}$/i;

export function validatePublicAppointmentToken(token: string | null | undefined): token is string {
  if (!token) return false;
  return PUBLIC_APPOINTMENT_TOKEN_REGEX.test(token.trim());
}

export function parsePublicAppointmentTokenFromHash(hash?: string): string | null {
  const raw = (hash ?? (typeof window !== 'undefined' ? window.location.hash : '')).replace(/^#/, '');
  if (!raw) return null;

  const params = new URLSearchParams(raw.includes('=') ? raw : `${PUBLIC_APPOINTMENT_TOKEN_PARAM}=${raw}`);
  const token = params.get(PUBLIC_APPOINTMENT_TOKEN_PARAM);
  return validatePublicAppointmentToken(token) ? token.trim() : null;
}

export function buildPublicAppointmentUrl(origin: string, token: string): string {
  const base = origin.replace(/\/$/, '');
  return `${base}/appointment#${PUBLIC_APPOINTMENT_TOKEN_PARAM}=${token}`;
}

export function buildPublicConsentUrl(origin: string, token: string): string {
  const base = origin.replace(/\/$/, '');
  return `${base}/consent#${PUBLIC_APPOINTMENT_TOKEN_PARAM}=${token}`;
}

export function isSensitivePublicAppointmentLocation(
  pathname: string,
  hash?: string,
): boolean {
  if (pathname !== '/appointment' && pathname !== '/consent') {
    return false;
  }
  return validatePublicAppointmentToken(parsePublicAppointmentTokenFromHash(hash));
}

export function getSanitizedPagePath(pathname: string): string {
  return pathname || '/';
}
