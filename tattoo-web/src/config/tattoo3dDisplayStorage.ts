import { Tattoo3DModelSlotId, Vec3 } from './tattoo3dPrototype';

export const MODEL_DISPLAY_STORAGE_KEY = 'inkflow_3d_model_display';

export interface Tattoo3DModelDisplayConfig {
  modelId: Tattoo3DModelSlotId;
  displayRotationDeg: Vec3;
  displayPosition: Vec3;
  defaultCameraPosition: Vec3;
  defaultCameraTarget: Vec3;
  frontAzimuth: number;
  frontPolar: number;
  customerMinDistance: number;
  customerMaxDistance: number;
  savedAt: string;
}

export type ModelDisplayStore = Record<string, Tattoo3DModelDisplayConfig>;

export interface CameraSnapshot {
  position: Vec3;
  target: Vec3;
  azimuth: number;
  polar: number;
  distance: number;
}

export const cloneVec3 = (value: Vec3): Vec3 => [value[0], value[1], value[2]];

const toVec3 = (value: unknown, fallback: Vec3 = [0, 0, 0]): Vec3 => {
  if (!Array.isArray(value) || value.length < 3) return fallback;
  const next: Vec3 = [Number(value[0]), Number(value[1]), Number(value[2])];
  return next.every((item) => Number.isFinite(item)) ? next : fallback;
};

const toNumber = (value: unknown, fallback = 0): number => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

export const isPersistedDisplayConfig = (
  config: Tattoo3DModelDisplayConfig | null | undefined
): config is Tattoo3DModelDisplayConfig =>
  Boolean(config && typeof config.savedAt === 'string' && config.savedAt.length > 0);

export const normalizeDisplayConfig = (
  raw: unknown,
  modelId: Tattoo3DModelSlotId
): Tattoo3DModelDisplayConfig | null => {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const rotationSource = record.displayRotationDeg ?? record.displayRotation;

  return {
    modelId,
    displayRotationDeg: toVec3(rotationSource, [0, 0, 0]),
    displayPosition: toVec3(record.displayPosition, [0, 0, 0]),
    defaultCameraPosition: toVec3(record.defaultCameraPosition, [0, 0, 0]),
    defaultCameraTarget: toVec3(record.defaultCameraTarget, [0, 0, 0]),
    frontAzimuth: toNumber(record.frontAzimuth, 0),
    frontPolar: toNumber(record.frontPolar, Math.PI / 2),
    customerMinDistance: toNumber(record.customerMinDistance, 50),
    customerMaxDistance: toNumber(record.customerMaxDistance, 2000),
    savedAt: typeof record.savedAt === 'string' ? record.savedAt : '',
  };
};

export const loadModelDisplayConfigs = (): ModelDisplayStore => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(MODEL_DISPLAY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};

    const next: ModelDisplayStore = {};
    for (const [modelId, value] of Object.entries(parsed)) {
      const normalized = normalizeDisplayConfig(value, modelId as Tattoo3DModelSlotId);
      if (normalized && isPersistedDisplayConfig(normalized)) {
        next[modelId] = normalized;
      }
    }
    return next;
  } catch (error) {
    console.warn('Failed to load model display configs:', error);
    return {};
  }
};

export const loadRawModelDisplayStore = (): ModelDisplayStore => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(MODEL_DISPLAY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};

    const next: ModelDisplayStore = {};
    for (const [modelId, value] of Object.entries(parsed)) {
      const normalized = normalizeDisplayConfig(value, modelId as Tattoo3DModelSlotId);
      if (normalized) {
        next[modelId] = normalized;
      }
    }
    return next;
  } catch (error) {
    console.warn('Failed to load raw model display store:', error);
    return {};
  }
};

export type SaveModelDisplayConfigResult =
  | { ok: true; store: ModelDisplayStore }
  | { ok: false; error: unknown };

export const saveModelDisplayConfig = (
  modelId: Tattoo3DModelSlotId,
  config: Tattoo3DModelDisplayConfig
): SaveModelDisplayConfigResult => {
  if (typeof window === 'undefined') {
    return { ok: false, error: new Error('localStorage is unavailable (SSR)') };
  }

  try {
    const existing = loadRawModelDisplayStore();
    const nextStore: ModelDisplayStore = {
      ...existing,
      [modelId]: {
        ...config,
        modelId,
        displayRotationDeg: cloneVec3(config.displayRotationDeg),
        displayPosition: cloneVec3(config.displayPosition),
        defaultCameraPosition: cloneVec3(config.defaultCameraPosition),
        defaultCameraTarget: cloneVec3(config.defaultCameraTarget),
        savedAt: config.savedAt,
      },
    };

    const serialized = JSON.stringify(nextStore);
    window.localStorage.setItem(MODEL_DISPLAY_STORAGE_KEY, serialized);

    const verify = window.localStorage.getItem(MODEL_DISPLAY_STORAGE_KEY);
    if (!verify) {
      return {
        ok: false,
        error: new Error(
          `localStorage.getItem('${MODEL_DISPLAY_STORAGE_KEY}') returned null after setItem`
        ),
      };
    }

    return { ok: true, store: nextStore };
  } catch (error) {
    console.error('saveModelDisplayConfig failed:', error);
    return { ok: false, error };
  }
};

export const saveModelDisplayConfigs = (next: ModelDisplayStore): SaveModelDisplayConfigResult => {
  if (typeof window === 'undefined') {
    return { ok: false, error: new Error('localStorage is unavailable (SSR)') };
  }

  try {
    const serialized = JSON.stringify(next);
    window.localStorage.setItem(MODEL_DISPLAY_STORAGE_KEY, serialized);

    const verify = window.localStorage.getItem(MODEL_DISPLAY_STORAGE_KEY);
    if (!verify) {
      return {
        ok: false,
        error: new Error(
          `localStorage.getItem('${MODEL_DISPLAY_STORAGE_KEY}') returned null after setItem`
        ),
      };
    }

    return { ok: true, store: next };
  } catch (error) {
    console.error('saveModelDisplayConfigs failed:', error);
    return { ok: false, error };
  }
};

export const getModelDisplayConfig = (
  store: ModelDisplayStore,
  modelId: Tattoo3DModelSlotId
): Tattoo3DModelDisplayConfig | null => {
  const saved = store[modelId];
  if (!saved) return null;
  return saved;
};

export const createFallbackDisplayConfig = (
  modelId: Tattoo3DModelSlotId,
  options: {
    cameraPosition: Vec3;
    cameraTarget: Vec3;
    minDistance: number;
    maxDistance: number;
  }
): Tattoo3DModelDisplayConfig => {
  const offset = [
    options.cameraPosition[0] - options.cameraTarget[0],
    options.cameraPosition[1] - options.cameraTarget[1],
    options.cameraPosition[2] - options.cameraTarget[2],
  ] as Vec3;
  const distance = Math.hypot(offset[0], offset[1], offset[2]) || 1;
  const polar = Math.acos(Math.max(-1, Math.min(1, offset[1] / distance)));
  const azimuth = Math.atan2(offset[0], offset[2]);

  return {
    modelId,
    displayRotationDeg: [0, 0, 0],
    displayPosition: [0, 0, 0],
    defaultCameraPosition: cloneVec3(options.cameraPosition),
    defaultCameraTarget: cloneVec3(options.cameraTarget),
    frontAzimuth: azimuth,
    frontPolar: polar,
    customerMinDistance: options.minDistance,
    customerMaxDistance: options.maxDistance,
    savedAt: '',
  };
};

export const snapshotFromCameraState = (
  position: Vec3,
  target: Vec3,
  azimuth: number,
  polar: number
): CameraSnapshot => {
  const dx = position[0] - target[0];
  const dy = position[1] - target[1];
  const dz = position[2] - target[2];
  return {
    position: cloneVec3(position),
    target: cloneVec3(target),
    azimuth,
    polar,
    distance: Math.hypot(dx, dy, dz),
  };
};
