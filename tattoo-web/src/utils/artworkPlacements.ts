export const ARTWORK_PLACEMENT_OPTIONS = [
  { key: 'upper_arm_outer', label: '上臂外側' },
  { key: 'upper_arm_inner', label: '上臂內側' },
  { key: 'forearm_outer', label: '前臂外側' },
  { key: 'forearm_inner', label: '前臂內側' },
  { key: 'shoulder', label: '肩膀' },
  { key: 'chest', label: '胸口' },
  { key: 'back', label: '背部' },
  { key: 'side_ribs', label: '側腰／肋骨' },
  { key: 'thigh', label: '大腿' },
  { key: 'calf', label: '小腿' },
  { key: 'wrist', label: '手腕' },
  { key: 'ankle', label: '腳踝' },
] as const;

export type ArtworkPlacementKey = typeof ARTWORK_PLACEMENT_OPTIONS[number]['key'];

const PLACEMENT_KEY_SET = new Set<string>(ARTWORK_PLACEMENT_OPTIONS.map((item) => item.key));

const LABEL_TO_KEY = new Map<string, ArtworkPlacementKey>(
  ARTWORK_PLACEMENT_OPTIONS.flatMap((item) => [
    [item.label, item.key],
    [item.label.replace('／', '/'), item.key],
  ] as const)
);

const KEY_TO_LABEL = new Map<string, string>(
  ARTWORK_PLACEMENT_OPTIONS.map((item) => [item.key, item.label])
);

export const isArtworkPlacementKey = (value: string): value is ArtworkPlacementKey =>
  PLACEMENT_KEY_SET.has(value);

export const artworkPlacementKeyToLabel = (key: string): string | null =>
  KEY_TO_LABEL.get(key) ?? null;

export const artworkPlacementLabelToKey = (label: string): ArtworkPlacementKey | null => {
  const trimmed = label.trim();
  if (!trimmed) return null;
  if (isArtworkPlacementKey(trimmed)) return trimmed;
  return LABEL_TO_KEY.get(trimmed) ?? LABEL_TO_KEY.get(trimmed.replace('/', '／')) ?? null;
};

export const normalizeArtworkPlacementKeys = (keys: string[]): ArtworkPlacementKey[] => {
  const seen = new Set<ArtworkPlacementKey>();
  const result: ArtworkPlacementKey[] = [];
  for (const raw of keys) {
    const key = isArtworkPlacementKey(raw) ? raw : artworkPlacementLabelToKey(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(key);
  }
  return result;
};

export const resolveStoredPlacements = (values: string[] | undefined | null): {
  keys: ArtworkPlacementKey[];
  legacy: string[];
  labels: string[];
} => {
  const keys: ArtworkPlacementKey[] = [];
  const legacy: string[] = [];
  const seenKeys = new Set<ArtworkPlacementKey>();
  const seenLegacy = new Set<string>();

  for (const raw of values ?? []) {
    const item = raw.trim();
    if (!item) continue;
    if (isArtworkPlacementKey(item)) {
      if (seenKeys.has(item)) continue;
      seenKeys.add(item);
      keys.push(item);
      continue;
    }
    const mapped = artworkPlacementLabelToKey(item);
    if (mapped) {
      if (seenKeys.has(mapped)) continue;
      seenKeys.add(mapped);
      keys.push(mapped);
      continue;
    }
    if (seenLegacy.has(item)) continue;
    seenLegacy.add(item);
    legacy.push(item);
  }

  const labels = [
    ...keys.map((key) => artworkPlacementKeyToLabel(key) ?? key),
    ...legacy,
  ];

  return { keys, legacy, labels };
};

export const formatArtworkPlacementSummary = (keys: string[], legacy: string[] = []): string => {
  const labels = [
    ...normalizeArtworkPlacementKeys(keys).map((key) => artworkPlacementKeyToLabel(key) ?? key),
    ...legacy,
  ];
  return labels.length > 0 ? labels.join('・') : '';
};
