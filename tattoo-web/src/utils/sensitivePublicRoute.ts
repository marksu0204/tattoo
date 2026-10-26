import { isSensitivePublicAppointmentLocation } from './publicAppointmentToken';

export function shouldTrackPublicPageView(): boolean {
  if (typeof window === 'undefined') return true;
  return !isSensitivePublicAppointmentLocation(window.location.pathname, window.location.hash);
}
