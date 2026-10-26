import { Tattoo3DModelCalibration, Vec3 } from './tattoo3dPrototype';

export const CALIBRATION_STORAGE_KEY = 'inkflow_3d_model_calibration';

export interface SavedAnatomicalCalibration {
  modelId: string;
  referenceLabel: string;
  pointA: Vec3;
  pointB: Vec3;
  sceneDistanceUnits: number;
  realDistanceCm: number;
  unitsPerCm: number;
  savedAt: string;
}

export type ModelCalibrationStore = Record<string, SavedAnatomicalCalibration>;

export const getDefaultUnitsPerCm = (calibration: Tattoo3DModelCalibration): number => {
  if (calibration.mode === 'uncalibrated') return 0;
  if (
    !Number.isFinite(calibration.realReferenceLengthCm) ||
    calibration.realReferenceLengthCm <= 0
  ) {
    return 0;
  }
  return calibration.sceneReferenceLengthUnits / calibration.realReferenceLengthCm;
};

export const loadModelCalibrations = (): ModelCalibrationStore => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(CALIBRATION_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as ModelCalibrationStore;
  } catch (error) {
    console.warn('Failed to load model calibrations:', error);
    return {};
  }
};

export const saveModelCalibrations = (next: ModelCalibrationStore): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn('Failed to save model calibrations:', error);
  }
};

export const getSavedCalibrationForModel = (
  store: ModelCalibrationStore,
  modelId: string
): SavedAnatomicalCalibration | null => {
  const saved = store[modelId];
  if (!saved || !Number.isFinite(saved.unitsPerCm) || saved.unitsPerCm <= 0) {
    return null;
  }
  return saved;
};

export const resolveUnitsPerCm = (
  configCalibration: Tattoo3DModelCalibration,
  savedCalibration?: SavedAnatomicalCalibration | null,
  allowTemporaryFallback = true
): number => {
  if (
    savedCalibration &&
    Number.isFinite(savedCalibration.unitsPerCm) &&
    savedCalibration.unitsPerCm > 0
  ) {
    return savedCalibration.unitsPerCm;
  }
  if (!allowTemporaryFallback || configCalibration.mode === 'uncalibrated') {
    return 0;
  }
  return getDefaultUnitsPerCm(configCalibration);
};
