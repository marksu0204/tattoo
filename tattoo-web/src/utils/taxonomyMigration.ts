/**
 * 分類整理 V2：把 31 個標籤收斂成「題材 7 + 風格 4」。
 *
 * 做法是「沿用既有標籤（改名）＋把被合併的標籤轉移過去」，tag_key 不變，
 * 所以後端每次請求的 seed（INSERT IGNORE）不會把舊名稱加回來。
 */

export type NewGroup = 'subject' | 'style';

export interface NewTagDef {
  group: NewGroup;
  /** 沿用的既有 tag_key */
  tagKey: string;
  /** 新顯示名稱 */
  name: string;
  /** 併入此標籤的舊 tag_key */
  absorbs: string[];
}

export const NEW_TAGS: NewTagDef[] = [
  { group: 'subject', tagKey: 'floral_botanical', name: '花卉植物', absorbs: [] },
  { group: 'subject', tagKey: 'animal', name: '動物', absorbs: ['bird'] },
  { group: 'subject', tagKey: 'insect', name: '昆蟲', absorbs: [] },
  { group: 'subject', tagKey: 'marine', name: '海洋生物', absorbs: [] },
  { group: 'subject', tagKey: 'human', name: '人物・神話', absorbs: ['myth_religion'] },
  { group: 'subject', tagKey: 'astronomy_zodiac', name: '星空・風景', absorbs: ['landscape'] },
  { group: 'subject', tagKey: 'abstract', name: '意象・抽象', absorbs: ['text_symbol'] },
  { group: 'style', tagKey: 'sumi_ink', name: '水墨暈染', absorbs: ['fluid_smoke'] },
  { group: 'style', tagKey: 'dotwork', name: '點霧漸層', absorbs: [] },
  { group: 'style', tagKey: 'sketch', name: '素描線條', absorbs: ['fine_line'] },
  { group: 'style', tagKey: 'realism', name: '寫實', absorbs: ['blackwork'] },
];

/** 保留在作品上、但不顯示在前台分類面板的標籤（之後做「刺青師推薦」用） */
export const KEEP_TAG_KEYS = ['want_to_tattoo'];

/** 整理後停用的舊標籤（停用前會確認已沒有作品使用） */
export const RETIRED_TAG_KEYS = [
  'bird', 'myth_religion', 'landscape', 'text_symbol',
  'black_grey', 'fine_line', 'fluid_smoke', 'geometric', 'japanese', 'engraving', 'minimal', 'blackwork',
  'sleeve', 'chest_back', 'leg_large',
  'special_small', 'special_large', 'discount', 'limited_project',
];

/** 前台分類面板顯示的群組 */
export const GALLERY_TAXONOMY_GROUPS: NewGroup[] = ['subject', 'style'];

const SUBJECT_FROM_OLD: Record<string, string> = {
  floral_botanical: 'floral_botanical',
  animal: 'animal',
  bird: 'animal',
  insect: 'insect',
  marine: 'marine',
  human: 'human',
  myth_religion: 'human',
  astronomy_zodiac: 'astronomy_zodiac',
  landscape: 'astronomy_zodiac',
  text_symbol: 'abstract',
  abstract: 'abstract',
};

/** 同時有多個具體題材時的優先順序（「抽象」永遠最後） */
const SUBJECT_PRIORITY = ['human', 'animal', 'marine', 'insect', 'astronomy_zodiac', 'floral_botanical', 'abstract'];

/**
 * 人工看圖後的修正（依作品 id）：
 * - 沒有標籤的作品（多為已認領）
 * - 原本分錯的：螺 → 海洋生物、蝙蝠 → 動物、雙雀木蘭主體是花
 */
export const MANUAL_OVERRIDES: Record<string, { subject?: string; style?: string }> = {
  '1785548889863': { subject: 'floral_botanical', style: 'sumi_ink' }, // 茶花（紅）
  '1784703986358': { subject: 'floral_botanical', style: 'sumi_ink' }, // 山茶（紅）
  '1769067399662': { subject: 'abstract', style: 'sumi_ink' }, // 花臂包手 示範圖
  '1769067187430': { subject: 'animal', style: 'sketch' }, // 蛇 荊棘
  '1766835061682': { subject: 'floral_botanical', style: 'sketch' }, // 蘭花
  '1766580136080': { subject: 'human', style: 'sketch' }, // 情緒大衛
  '1785243388072': { subject: 'floral_botanical', style: 'sketch' }, // 茶花（手稿）
  '1780920017696': { subject: 'insect', style: 'sumi_ink' }, // 煙蝶
  '1779106351362': { subject: 'marine', style: 'sumi_ink' }, // 煙海豚a
  '1779106318521': { subject: 'marine', style: 'sumi_ink' }, // 煙海豚
  '1779006773693': { subject: 'floral_botanical', style: 'sumi_ink' }, // 煙霧彼岸
  '1773812722013': { subject: 'animal', style: 'sumi_ink' }, // 飛燕c
  '1773812685189': { subject: 'animal', style: 'sumi_ink' }, // 飛燕b
  '1773812642515': { subject: 'animal', style: 'sumi_ink' }, // 飛燕a
  '1773730380830': { subject: 'animal', style: 'sumi_ink' }, // 墨獅
  '1773730314797': { subject: 'animal', style: 'sumi_ink' }, // 鷹
  '1773578899091': { subject: 'abstract', style: 'sumi_ink' }, // 煙流
  '1773578844522': { subject: 'animal', style: 'sumi_ink' }, // 墨虎
  '1773578793907': { subject: 'floral_botanical', style: 'sumi_ink' }, // 墨花
  '1773578735908': { subject: 'floral_botanical', style: 'sumi_ink' }, // 墨鳶尾
  '1770386334454': { subject: 'animal', style: 'dotwork' }, // 外星牛牛
  '1768995564267': { subject: 'animal', style: 'sumi_ink' }, // 鷹
  '1768995541643': { subject: 'insect', style: 'sumi_ink' }, // 蝶F
  '1768995370976': { subject: 'marine', style: 'sumi_ink' }, // 魟魚B
  '1768995311196': { subject: 'animal', style: 'sumi_ink' }, // 墨虎(側)
  '1768995271473': { subject: 'animal', style: 'sumi_ink' }, // 墨虎
  '1767259006360': { subject: 'insect', style: 'sumi_ink' }, // 蝶B
  '1767258983560': { subject: 'insect', style: 'sumi_ink' }, // 蝶A
  '1767090121827': { subject: 'animal', style: 'sumi_ink' }, // 燕子A
  '1766834213412': { subject: 'astronomy_zodiac', style: 'dotwork' }, // 月
  '1766834187908': { subject: 'floral_botanical', style: 'dotwork' }, // 太陽草
  '1766581893083': { subject: 'animal', style: 'dotwork' }, // 喵喵山D
  '1766581480276': { subject: 'floral_botanical', style: 'sketch' }, // 雙牡丹
  '1766581436436': { subject: 'floral_botanical', style: 'sketch' }, // 牡丹單支B
  '1786263891415': { subject: 'floral_botanical' }, // 雙雀木蘭：主體是花
  '1782633769721': { subject: 'animal' }, // 蝙蝠
  '1779006842413': { subject: 'marine' }, // 螺a
  '1779006817182': { subject: 'marine' }, // 螺
};

export interface MigrationProposal {
  subject: string | null;
  style: string | null;
  /** 來自人工修正或規則無法判斷 → 介面上提示確認 */
  needsReview: boolean;
}

export function proposeSubject(oldKeys: string[]): string | null {
  const mapped = new Set(oldKeys.map((k) => SUBJECT_FROM_OLD[k]).filter(Boolean));
  for (const key of SUBJECT_PRIORITY) {
    if (mapped.has(key)) return key;
  }
  return null;
}

export function proposeStyle(oldKeys: string[]): string | null {
  const has = (k: string) => oldKeys.includes(k);
  if (has('realism')) return 'realism';
  if (has('sketch') || has('fine_line')) return 'sketch';
  if (has('sumi_ink') || has('fluid_smoke')) return 'sumi_ink';
  if (has('dotwork') || has('geometric') || has('minimal')) return 'dotwork';
  if (has('blackwork')) return 'realism';
  if (has('black_grey')) return 'sumi_ink';
  return null;
}

export function proposeForArtwork(artworkId: string, oldKeys: string[]): MigrationProposal {
  const override = MANUAL_OVERRIDES[artworkId];
  const subject = override?.subject ?? proposeSubject(oldKeys);
  const style = override?.style ?? proposeStyle(oldKeys);
  return {
    subject,
    style,
    needsReview: Boolean(override) || !subject || !style,
  };
}

/** 新的 tagIds：題材 + 風格 + 需保留的標籤（例如很想刺） */
export function buildNewTagIds(
  proposal: Pick<MigrationProposal, 'subject' | 'style'>,
  oldKeys: string[],
  idByKey: Record<string, number>,
): number[] {
  const ids: number[] = [];
  if (proposal.subject && idByKey[proposal.subject]) ids.push(idByKey[proposal.subject]);
  if (proposal.style && idByKey[proposal.style]) ids.push(idByKey[proposal.style]);
  for (const key of KEEP_TAG_KEYS) {
    if (oldKeys.includes(key) && idByKey[key]) ids.push(idByKey[key]);
  }
  return ids;
}

export const NEW_TAG_NAME: Record<string, string> = Object.fromEntries(NEW_TAGS.map((t) => [t.tagKey, t.name]));
