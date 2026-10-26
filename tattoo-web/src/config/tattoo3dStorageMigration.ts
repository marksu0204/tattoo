import { CALIBRATION_STORAGE_KEY } from './tattoo3dCalibrationStorage';

const PLACEMENT_STORAGE_KEY = 'inkflow_3d_placement_overrides';
const LEGACY_MODEL_ID = 'right_arm_03';
const FEMALE_ARM_MODEL_ID = 'female_arm';

const migrateModelKeyedStore = <T extends Record<string, unknown>>(storageKey: string): void => {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    if (!parsed[LEGACY_MODEL_ID] || parsed[FEMALE_ARM_MODEL_ID]) return;
    parsed[FEMALE_ARM_MODEL_ID] = parsed[LEGACY_MODEL_ID];
    delete parsed[LEGACY_MODEL_ID];
    window.localStorage.setItem(storageKey, JSON.stringify(parsed));
  } catch (error) {
    console.warn(`Failed to migrate ${storageKey}:`, error);
  }
};

/** 將舊 right_arm_03 資料遷移至 female_arm，保留既有 placement / calibration。 */
export const migrate3dPrototypeStorage = (): void => {
  migrateModelKeyedStore(PLACEMENT_STORAGE_KEY);
  migrateModelKeyedStore(CALIBRATION_STORAGE_KEY);
};
