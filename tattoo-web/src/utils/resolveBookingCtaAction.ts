export type BookingCtaAction = 'checking' | 'calendar' | 'line' | 'hidden';

export type BookingCtaDecisionInput = {
  hasBookingCapability: boolean;
  /** LIFF init settled — distinguishes unknown vs confirmed logged-out. */
  liffEnvironmentReady: boolean;
  /** Current LIFF login state — not inferred from cached App user. */
  isLiffLoggedIn: boolean;
  /** Short-lived LIFF access token available now (UX session capability). */
  hasValidLineAccessToken: boolean;
};

export function resolveBookingCtaAction(input: BookingCtaDecisionInput): BookingCtaAction {
  if (!input.hasBookingCapability) {
    return 'hidden';
  }
  if (!input.liffEnvironmentReady) {
    return 'checking';
  }
  if (input.isLiffLoggedIn || input.hasValidLineAccessToken) {
    return 'calendar';
  }
  return 'line';
}

export type BookingCtaCopy = {
  title: string;
  subtitle: string;
  icon: 'calendar' | 'line';
  disabled?: boolean;
};

export function getBookingCtaCopy(action: BookingCtaAction): BookingCtaCopy | null {
  if (action === 'hidden') {
    return null;
  }
  if (action === 'checking') {
    return {
      title: '確認登入狀態中…',
      subtitle: '請稍候',
      icon: 'calendar',
      disabled: true,
    };
  }
  if (action === 'calendar') {
    return {
      title: '查看可預約日期',
      subtitle: '已登入，直接查看可以預約的時間',
      icon: 'calendar',
    };
  }
  return {
    title: '詢問可預約日期',
    subtitle: '開啟官方 LINE，由刺青師協助安排',
    icon: 'line',
  };
}
