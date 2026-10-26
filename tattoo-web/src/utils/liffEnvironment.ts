import liff from '@line/liff';
import { lineService } from '../services/lineService';

export type LiffEnvironmentState = {
  /** App LIFF init has settled — login flags are authoritative when true. */
  isReady: boolean;
  isLiffClient: boolean;
  isLiffLoggedIn: boolean;
  /** Current LIFF access token present (session capability signal — UX only). */
  hasValidLineAccessToken: boolean;
};

const notReadyState = (): LiffEnvironmentState => ({
  isReady: false,
  isLiffClient: false,
  isLiffLoggedIn: false,
  hasValidLineAccessToken: false,
});

const loggedOutReadyState = (): LiffEnvironmentState => ({
  isReady: true,
  isLiffClient: false,
  isLiffLoggedIn: false,
  hasValidLineAccessToken: false,
});

/**
 * Read LIFF runtime flags (UX only — not an auth authority).
 * Before init settles, isReady=false and login flags are not treated as authoritative.
 */
export function getLiffEnvironmentState(liffId: string | null | undefined): LiffEnvironmentState {
  if (!lineService.isLiffInitSettled(liffId)) {
    return notReadyState();
  }

  if (!liffId?.trim()) {
    return loggedOutReadyState();
  }

  try {
    if (!liff.id) {
      return loggedOutReadyState();
    }
    const isLiffLoggedIn = liff.isLoggedIn();
    let hasValidLineAccessToken = false;
    if (isLiffLoggedIn) {
      const token = liff.getAccessToken();
      hasValidLineAccessToken = Boolean(token && token.trim() !== '');
    }
    return {
      isReady: true,
      isLiffClient: liff.isInClient(),
      isLiffLoggedIn,
      hasValidLineAccessToken,
    };
  } catch {
    return loggedOutReadyState();
  }
}
