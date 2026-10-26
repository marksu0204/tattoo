// Analytics 2.0 完整事件（session/UTM/contact）起算時間
// null 代表尚未正式啟用；待 production migration + Phase 2 完成後再設定實際時間。
const analyticsV2StartAt = import.meta.env.VITE_ANALYTICS_V2_START_AT?.trim() ?? '';
export const ANALYTICS_V2_START_AT: string | null = analyticsV2StartAt || null;
