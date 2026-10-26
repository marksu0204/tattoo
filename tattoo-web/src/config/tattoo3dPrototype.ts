export type Vec3 = [number, number, number];

export type Tattoo3DModelSlotId = 'female_arm' | 'male_arm' | 'female_leg' | 'male_leg';

export interface Tattoo3DPlacement {
  id: string;
  label: string;
  position: Vec3;
  rotation: Vec3;
  scaleMultiplier: number;
  depth: number;
  enabled: boolean;
}

export interface Tattoo3DModelCalibration {
  mode: 'temporary_whole_model_length' | 'anatomical_reference' | 'uncalibrated';
  referenceLabel: string;
  realReferenceLengthCm: number;
  sceneReferenceLengthUnits: number;
}

export interface Tattoo3DCameraConfig {
  fov: number;
  distanceMultiplier: number;
  minDistanceMultiplier: number;
  maxDistanceMultiplier: number;
}

export interface Tattoo3DModelConfig {
  id: Tattoo3DModelSlotId;
  label: string;
  assetUrl: string;
  bundledAssetUrl?: string;
  modelPosition: Vec3;
  modelRotation: Vec3;
  modelScale: 1;
  autoCenter: boolean;
  displayRotation: Vec3;
  displayPosition: Vec3;
  targetMeshName?: string;
  hasTemporaryCalibrationFallback: boolean;
  calibration: Tattoo3DModelCalibration;
  placements: Tattoo3DPlacement[];
  camera: Tattoo3DCameraConfig;
}

export interface Tattoo3DPrototypeConfig {
  models: Tattoo3DModelConfig[];
  defaultModelId: Tattoo3DModelSlotId;
  tattooAssetUrl: string;
  bundledTattooAssetUrl: string;
  defaultTattooLongEdgeCm: number;
  tattooSizeOptionsCm: number[];
}

export const cmToSceneUnits = (
  cm: number,
  calibration: Tattoo3DModelCalibration,
  unitsPerCmOverride?: number | null
): number => {
  if (!Number.isFinite(cm) || cm <= 0) return 0;

  const unitsPerCm =
    unitsPerCmOverride !== undefined &&
    unitsPerCmOverride !== null &&
    Number.isFinite(unitsPerCmOverride) &&
    unitsPerCmOverride > 0
      ? unitsPerCmOverride
      : calibration.sceneReferenceLengthUnits / calibration.realReferenceLengthCm;

  if (!Number.isFinite(unitsPerCm) || unitsPerCm <= 0) return 0;
  return cm * unitsPerCm;
};

export {
  TATTOO_3D_PROTOTYPE_CONFIG,
  TATTOO_3D_MODELS,
  TATTOO_3D_MODEL_SLOT_IDS,
  getTattoo3DModelById,
  getCalibrationStatusLabel,
} from './tattoo3dModels';
