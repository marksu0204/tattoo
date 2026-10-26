import {
  Tattoo3DCameraConfig,
  Tattoo3DModelCalibration,
  Tattoo3DModelConfig,
  Tattoo3DModelSlotId,
  Tattoo3DPrototypeConfig,
} from './tattoo3dPrototype';
import { RIGHT_ARM_PLACEMENT_PRESETS } from './tattoo3dPlacementPresets';

export const TATTOO_3D_MODEL_SLOT_IDS: Tattoo3DModelSlotId[] = [
  'female_arm',
  'male_arm',
  'female_leg',
  'male_leg',
];

export const UPLOADED_MODEL_OBJ_URL = (modelId: Tattoo3DModelSlotId): string =>
  `/uploads/3d/models/${modelId}/model.obj`;

export const UPLOADED_TEST_TEXTURE_URL = '/uploads/3d/test-textures/test.png';
export const BUNDLED_TEST_TEXTURE_URL = '/images/3d-test/test.png';
export const BUNDLED_FEMALE_ARM_OBJ_URL = '/models/3d-test/right-arm-03.obj';

const DEFAULT_CAMERA: Tattoo3DCameraConfig = {
  fov: 36,
  distanceMultiplier: 2.1,
  minDistanceMultiplier: 0.45,
  maxDistanceMultiplier: 6,
};

const FEMALE_ARM_TEMP_CALIBRATION: Tattoo3DModelCalibration = {
  mode: 'temporary_whole_model_length',
  referenceLabel: '完整模型長軸（暫定）',
  realReferenceLengthCm: 70,
  sceneReferenceLengthUnits: 699.936,
};

const UNCALIBRATED_CALIBRATION: Tattoo3DModelCalibration = {
  mode: 'uncalibrated',
  referenceLabel: '',
  realReferenceLengthCm: 0,
  sceneReferenceLengthUnits: 0,
};

const clonePlacements = () =>
  RIGHT_ARM_PLACEMENT_PRESETS.map((item) => ({
    ...item,
    position: [...item.position] as typeof item.position,
    rotation: [...item.rotation] as typeof item.rotation,
  }));

const createArmLikeModel = (
  id: Tattoo3DModelSlotId,
  label: string,
  options: {
    bundledAssetUrl?: string;
    hasTemporaryCalibrationFallback: boolean;
    calibration: Tattoo3DModelCalibration;
  }
): Tattoo3DModelConfig => ({
  id,
  label,
  assetUrl: UPLOADED_MODEL_OBJ_URL(id),
  bundledAssetUrl: options.bundledAssetUrl,
  modelPosition: [0, 0, 0],
  modelRotation: [0, 0, 0],
  modelScale: 1,
  autoCenter: true,
  displayRotation: [0, 0, 0],
  displayPosition: [0, 0, 0],
  targetMeshName: '',
  hasTemporaryCalibrationFallback: options.hasTemporaryCalibrationFallback,
  calibration: options.calibration,
  placements: clonePlacements(),
  camera: { ...DEFAULT_CAMERA },
});

export const TATTOO_3D_MODELS: Tattoo3DModelConfig[] = [
  createArmLikeModel('female_arm', '女生手臂', {
    bundledAssetUrl: BUNDLED_FEMALE_ARM_OBJ_URL,
    hasTemporaryCalibrationFallback: true,
    calibration: FEMALE_ARM_TEMP_CALIBRATION,
  }),
  createArmLikeModel('male_arm', '男生手臂', {
    hasTemporaryCalibrationFallback: false,
    calibration: UNCALIBRATED_CALIBRATION,
  }),
  createArmLikeModel('female_leg', '女生腿', {
    hasTemporaryCalibrationFallback: false,
    calibration: UNCALIBRATED_CALIBRATION,
  }),
  createArmLikeModel('male_leg', '男生腿', {
    hasTemporaryCalibrationFallback: false,
    calibration: UNCALIBRATED_CALIBRATION,
  }),
];

export const getTattoo3DModelById = (modelId: Tattoo3DModelSlotId): Tattoo3DModelConfig | null =>
  TATTOO_3D_MODELS.find((model) => model.id === modelId) ?? null;

export const getCalibrationStatusLabel = (
  model: Tattoo3DModelConfig,
  hasSavedCalibration: boolean
): string => {
  if (hasSavedCalibration) return '已校正';
  if (model.hasTemporaryCalibrationFallback) return '暫定70cm';
  return '尚未校正';
};

export const TATTOO_3D_PROTOTYPE_CONFIG: Tattoo3DPrototypeConfig = {
  models: TATTOO_3D_MODELS,
  defaultModelId: 'female_arm',
  tattooAssetUrl: UPLOADED_TEST_TEXTURE_URL,
  bundledTattooAssetUrl: BUNDLED_TEST_TEXTURE_URL,
  defaultTattooLongEdgeCm: 15,
  tattooSizeOptionsCm: [10, 15, 20],
};
