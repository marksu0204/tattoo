/** Development-only LINE send diagnostics（不記錄 token / 完整個資） */
export function logLineSendDebug(
  action: 'sendLineBroadcastTest' | 'sendLineBroadcast',
  payload: {
    success?: boolean;
    code?: string;
    message?: string;
    lineHttpStatus?: number;
    errors?: string[];
  },
): void {
  if (typeof import.meta !== 'undefined' && (import.meta as { env?: { DEV?: boolean } }).env?.DEV !== true) return;
  console.error('[LINE Send Debug]', {
    action,
    success: payload.success,
    code: payload.code,
    message: payload.message,
    httpStatus: payload.lineHttpStatus,
    errors: payload.errors,
  });
}

export function formatLineSendError(result: {
  message?: string;
  code?: string;
  errors?: string[];
  error?: string;
}): string {
  return result.message || result.error || result.errors?.[0] || 'LINE 訊息發送失敗';
}
