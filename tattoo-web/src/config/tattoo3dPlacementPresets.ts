import { Tattoo3DPlacement, Vec3 } from './tattoo3dPrototype';

export type PlacementFilterCategory =
  | '全部'
  | '前臂外側'
  | '前臂內側'
  | '前臂側面'
  | '上臂';

export const PLACEMENT_FILTER_CATEGORIES: PlacementFilterCategory[] = [
  '全部',
  '前臂外側',
  '前臂內側',
  '前臂側面',
  '上臂',
];

const LEGACY_WRIST: Pick<Tattoo3DPlacement, 'position' | 'rotation' | 'scaleMultiplier' | 'depth'> =
  {
    position: [-230, 10, 26],
    rotation: [0.04, 0.1, 0],
    scaleMultiplier: 1,
    depth: 24,
  };

const LEGACY_FOREARM_CENTER: Pick<
  Tattoo3DPlacement,
  'position' | 'rotation' | 'scaleMultiplier' | 'depth'
> = {
  position: [-145, 15, 24],
  rotation: [0.05, 0.06, -0.03],
  scaleMultiplier: 1,
  depth: 60,
};

const LEGACY_ELBOW: Pick<Tattoo3DPlacement, 'position' | 'rotation' | 'scaleMultiplier' | 'depth'> =
  {
    position: [-60, 20, 20],
    rotation: [0.08, 0.02, -0.02],
    scaleMultiplier: 1,
    depth: 26,
  };

const clonePresetValues = (
  source: Pick<Tattoo3DPlacement, 'position' | 'rotation' | 'scaleMultiplier' | 'depth'>
): Pick<Tattoo3DPlacement, 'position' | 'rotation' | 'scaleMultiplier' | 'depth'> => ({
  position: [...source.position] as Vec3,
  rotation: [...source.rotation] as Vec3,
  scaleMultiplier: source.scaleMultiplier,
  depth: source.depth,
});

const makePlacement = (
  id: string,
  label: string,
  source: Pick<Tattoo3DPlacement, 'position' | 'rotation' | 'scaleMultiplier' | 'depth'>
): Tattoo3DPlacement => ({
  id,
  label,
  enabled: true,
  ...clonePresetValues(source),
});

/** 右臂 10 個 Placement Preset（初始值複製自舊 Prototype，尚未人工校正） */
export const RIGHT_ARM_PLACEMENT_PRESETS: Tattoo3DPlacement[] = [
  makePlacement('forearm_outer_wrist', '前臂外側－靠手腕', LEGACY_WRIST),
  makePlacement('forearm_outer_center', '前臂外側－中央', LEGACY_FOREARM_CENTER),
  makePlacement('forearm_outer_elbow', '前臂外側－靠手肘', LEGACY_ELBOW),
  makePlacement('forearm_inner_wrist', '前臂內側－靠手腕', LEGACY_WRIST),
  makePlacement('forearm_inner_center', '前臂內側－中央', LEGACY_FOREARM_CENTER),
  makePlacement('forearm_inner_elbow', '前臂內側－靠手肘', LEGACY_ELBOW),
  makePlacement('forearm_side_center_a', '前臂側面－中央A', LEGACY_FOREARM_CENTER),
  makePlacement('forearm_side_center_b', '前臂側面－中央B', LEGACY_FOREARM_CENTER),
  makePlacement('upper_arm_outer_center', '上臂外側－中央', LEGACY_ELBOW),
  makePlacement('upper_arm_inner_center', '上臂內側－中央', LEGACY_ELBOW),
];

export const getPlacementFilterCategory = (
  label: string
): Exclude<PlacementFilterCategory, '全部'> => {
  if (label.startsWith('前臂外側')) return '前臂外側';
  if (label.startsWith('前臂內側')) return '前臂內側';
  if (label.startsWith('前臂側面')) return '前臂側面';
  return '上臂';
};

export const filterPlacementsByCategory = (
  placements: Tattoo3DPlacement[],
  category: PlacementFilterCategory
): Tattoo3DPlacement[] => {
  if (category === '全部') return placements;
  return placements.filter(
    (placement) => getPlacementFilterCategory(placement.label) === category
  );
};
