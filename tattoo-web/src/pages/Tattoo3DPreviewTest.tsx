import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { DepthScanResult, PreviewMode, Tattoo3DDebugInfo } from '../components/3d/Tattoo3DViewer';
import Tattoo3DDebugPanel from '../components/3d/Tattoo3DDebugPanel';
import {
  TATTOO_3D_PROTOTYPE_CONFIG,
  Vec3,
  Tattoo3DPlacement,
  Tattoo3DModelConfig,
  Tattoo3DModelSlotId,
  TATTOO_3D_MODEL_SLOT_IDS,
  getTattoo3DModelById,
  getCalibrationStatusLabel,
} from '../config/tattoo3dPrototype';
import { migrate3dPrototypeStorage } from '../config/tattoo3dStorageMigration';
import {
  isAdminAuthenticated,
  upload3dModelObj,
  upload3dTestTexturePng,
} from '../services/tattoo3dUploadApi';
import {
  SavedAnatomicalCalibration,
  getDefaultUnitsPerCm,
  getSavedCalibrationForModel,
  loadModelCalibrations,
  saveModelCalibrations,
} from '../config/tattoo3dCalibrationStorage';
import {
  PLACEMENT_FILTER_CATEGORIES,
  PlacementFilterCategory,
  filterPlacementsByCategory,
} from '../config/tattoo3dPlacementPresets';
import {
  CameraSnapshot,
  Tattoo3DModelDisplayConfig,
  cloneVec3 as cloneDisplayVec3,
  createFallbackDisplayConfig,
  isPersistedDisplayConfig,
  loadModelDisplayConfigs,
  loadRawModelDisplayStore,
  saveModelDisplayConfig,
  saveModelDisplayConfigs,
} from '../config/tattoo3dDisplayStorage';
import { usePageSeo } from '../hooks/usePageSeo';
import { build3dPreviewTestSeo } from '../utils/seoConfig';
import { useBrand } from '../context/BrandContext';

type AssetStatus = 'checking' | 'ready' | 'missing' | 'error';
type DraftPlacement = {
  id: string;
  label: string;
  position: Vec3;
  rotationDeg: Vec3;
  scaleMultiplier: number;
  depth: number;
};
type PlacementOverride = {
  position: Vec3;
  rotationDeg: Vec3;
  scaleMultiplier: number;
  depth: number;
  savedAt: string;
};
type PlacementOverridesMap = Record<string, Record<string, PlacementOverride>>;

const LOCAL_STORAGE_KEY = 'inkflow_3d_placement_overrides';
const Tattoo3DViewer = React.lazy(() => import('../components/3d/Tattoo3DViewer'));

class ViewerLoadBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Tattoo3DViewer chunk load failed:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-[460px] flex items-center justify-center text-amber-200 bg-black/30 rounded-lg border border-amber-700/40 text-center px-6">
          3D Viewer 載入失敗，但路由已正確進入 Prototype 頁面。
        </div>
      );
    }
    return this.props.children;
  }
}

const checkAssetExists = async (url: string): Promise<boolean> => {
  try {
    const head = await fetch(url, { method: 'HEAD' });
    if (head.ok) return true;
    const fallback = await fetch(url, { method: 'GET' });
    return fallback.ok;
  } catch {
    return false;
  }
};

const radToDeg = (value: number): number => (value * 180) / Math.PI;
const degToRad = (value: number): number => (value * Math.PI) / 180;

const cloneVec3 = (input: Vec3): Vec3 => [input[0], input[1], input[2]];

const computeSceneDistance = (pointA: Vec3, pointB: Vec3): number =>
  new THREE.Vector3(pointA[0], pointA[1], pointA[2]).distanceTo(
    new THREE.Vector3(pointB[0], pointB[1], pointB[2])
  );

const loadPlacementOverrides = (): PlacementOverridesMap => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as PlacementOverridesMap;
  } catch (error) {
    console.warn('Failed to load placement overrides:', error);
    return {};
  }
};

const savePlacementOverrides = (next: PlacementOverridesMap): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn('Failed to save placement overrides:', error);
  }
};

const toDraftPlacement = (
  preset: Tattoo3DPlacement,
  override?: PlacementOverride
): DraftPlacement => {
  if (override) {
    return {
      id: preset.id,
      label: preset.label,
      position: cloneVec3(override.position),
      rotationDeg: cloneVec3(override.rotationDeg),
      scaleMultiplier: override.scaleMultiplier,
      depth: override.depth,
    };
  }

  return {
    id: preset.id,
    label: preset.label,
    position: cloneVec3(preset.position),
    rotationDeg: [
      radToDeg(preset.rotation[0]),
      radToDeg(preset.rotation[1]),
      radToDeg(preset.rotation[2]),
    ],
    scaleMultiplier: preset.scaleMultiplier,
    depth: preset.depth,
  };
};

const vec3Equal = (a: Vec3, b: Vec3): boolean =>
  a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

const cloneDisplayConfig = (config: Tattoo3DModelDisplayConfig): Tattoo3DModelDisplayConfig => ({
  ...config,
  displayRotationDeg: cloneDisplayVec3(config.displayRotationDeg),
  displayPosition: cloneDisplayVec3(config.displayPosition),
  defaultCameraPosition: cloneDisplayVec3(config.defaultCameraPosition),
  defaultCameraTarget: cloneDisplayVec3(config.defaultCameraTarget),
});

const buildFallbackDisplayFromDebug = (
  modelId: Tattoo3DModelSlotId,
  debugInfo: Tattoo3DDebugInfo
): Tattoo3DModelDisplayConfig => {
  const center = debugInfo.centeredBoundingBoxCenter;
  return createFallbackDisplayConfig(modelId, {
    cameraPosition: [center[0], center[1], center[2] + debugInfo.cameraDistance],
    cameraTarget: center,
    minDistance: debugInfo.controlMinDistance,
    maxDistance: debugInfo.controlMaxDistance,
  });
};
const resolveModelAssetUrl = async (model: Tattoo3DModelConfig): Promise<string | null> => {
  if (await checkAssetExists(model.assetUrl)) return model.assetUrl;
  if (model.bundledAssetUrl && (await checkAssetExists(model.bundledAssetUrl))) {
    return model.bundledAssetUrl;
  }
  return null;
};

const resolveTattooAssetUrl = async (): Promise<string | null> => {
  const config = TATTOO_3D_PROTOTYPE_CONFIG;
  if (await checkAssetExists(config.tattooAssetUrl)) return config.tattooAssetUrl;
  if (await checkAssetExists(config.bundledTattooAssetUrl)) return config.bundledTattooAssetUrl;
  return null;
};

const Tattoo3DPreviewTest: React.FC = () => {
  const { brand } = useBrand();
  usePageSeo(build3dPreviewTestSeo(brand));
  const config = TATTOO_3D_PROTOTYPE_CONFIG;
  const [selectedModelId, setSelectedModelId] = useState<Tattoo3DModelSlotId>(
    config.defaultModelId
  );
  const activeModel = useMemo(
    () => getTattoo3DModelById(selectedModelId) ?? config.models[0],
    [config.models, selectedModelId]
  );
  const placementPresets = useMemo(
    () => activeModel.placements.filter((item) => item.enabled),
    [activeModel.placements]
  );
  const [selectedPlacementId, setSelectedPlacementId] = useState(
    placementPresets.find((item) => item.id === 'forearm_outer_center')?.id ??
      placementPresets[0]?.id ??
      ''
  );
  const [placementFilterCategory, setPlacementFilterCategory] =
    useState<PlacementFilterCategory>('全部');
  const [draftPlacement, setDraftPlacement] = useState<DraftPlacement | null>(null);
  const [tattooLongEdgeCm, setTattooLongEdgeCm] = useState(
    config.defaultTattooLongEdgeCm
  );
  const [debugEnabled, setDebugEnabled] = useState(true);
  const [renderEngine, setRenderEngine] = useState<'drei_decal' | 'raw_decal_geometry'>(
    'drei_decal'
  );
  const [decalMaterialMode, setDecalMaterialMode] = useState<'texture' | 'solid_red'>(
    'texture'
  );
  const [modelAssetStatus, setModelAssetStatus] = useState<AssetStatus>('checking');
  const [tattooAssetStatus, setTattooAssetStatus] = useState<AssetStatus>('checking');
  const [debugInfo, setDebugInfo] = useState<Tattoo3DDebugInfo | null>(null);
  const [scanRequest, setScanRequest] = useState<{
    id: number;
    kind: 'broad' | 'fine';
    depths: number[];
  } | null>(null);
  const [broadScanResult, setBroadScanResult] = useState<DepthScanResult | null>(null);
  const [fineScanResult, setFineScanResult] = useState<DepthScanResult | null>(null);
  const [overrides, setOverrides] = useState<PlacementOverridesMap>(() =>
    loadPlacementOverrides()
  );
  const [panelMessage, setPanelMessage] = useState('');
  const [calibrationMessage, setCalibrationMessage] = useState('');
  const [modelCalibrations, setModelCalibrations] = useState(() => loadModelCalibrations());
  const [calibrationModeActive, setCalibrationModeActive] = useState(false);
  const [calibrationPickTarget, setCalibrationPickTarget] = useState<'A' | 'B' | null>(null);
  const [calibrationPointA, setCalibrationPointA] = useState<Vec3 | null>(null);
  const [calibrationPointB, setCalibrationPointB] = useState<Vec3 | null>(null);
  const [calibrationReferenceLabel, setCalibrationReferenceLabel] = useState('');
  const [calibrationRealDistanceCm, setCalibrationRealDistanceCm] = useState(26);
  const [resolvedModelAssetUrl, setResolvedModelAssetUrl] = useState<string | null>(null);
  const [resolvedTattooAssetUrl, setResolvedTattooAssetUrl] = useState<string | null>(null);
  const [modelReloadNonce, setModelReloadNonce] = useState(0);
  const [textureReloadNonce, setTextureReloadNonce] = useState(0);
  const [uploadMessage, setUploadMessage] = useState('');
  const isAdmin = isAdminAuthenticated();
  const [previewMode, setPreviewMode] = useState<PreviewMode>('developer');
  const [displayConfigs, setDisplayConfigs] = useState(() => loadModelDisplayConfigs());
  const [draftDisplay, setDraftDisplay] = useState<Tattoo3DModelDisplayConfig | null>(() => {
    const saved = loadModelDisplayConfigs()[config.defaultModelId];
    return isPersistedDisplayConfig(saved) ? cloneDisplayConfig(saved) : null;
  });
  const [resetFrontRequestId, setResetFrontRequestId] = useState(0);
  const [captureCameraRequestId, setCaptureCameraRequestId] = useState(0);
  const [displayMessage, setDisplayMessage] = useState('');
  const displayConfigsRef = useRef(displayConfigs);
  displayConfigsRef.current = displayConfigs;
  const modelDebugFitRef = useRef<Partial<Record<Tattoo3DModelSlotId, Tattoo3DDebugInfo>>>({});
  const fallbackHydratedModelsRef = useRef<Set<Tattoo3DModelSlotId>>(new Set());
  const activeModelIdRef = useRef(activeModel.id);
  activeModelIdRef.current = activeModel.id;
  const draftDisplayRef = useRef(draftDisplay);
  draftDisplayRef.current = draftDisplay;

  useEffect(() => {
    migrate3dPrototypeStorage();
  }, []);

  const handleDebugInfoChange = useCallback((info: Tattoo3DDebugInfo) => {
    const modelId = activeModelIdRef.current;
    if (!modelDebugFitRef.current[modelId]) {
      modelDebugFitRef.current[modelId] = info;
    }

    setDebugInfo((prev) => {
      if (!prev) return info;
      if (
        prev.cameraDistance === info.cameraDistance &&
        prev.controlMinDistance === info.controlMinDistance &&
        prev.controlMaxDistance === info.controlMaxDistance &&
        vec3Equal(prev.centeredBoundingBoxCenter, info.centeredBoundingBoxCenter)
      ) {
        return prev;
      }
      return info;
    });
  }, []);

  const defaultUnitsPerCm = useMemo(
    () => getDefaultUnitsPerCm(activeModel.calibration),
    [activeModel.calibration]
  );

  const savedModelCalibration = useMemo(
    () => getSavedCalibrationForModel(modelCalibrations, activeModel.id),
    [activeModel.id, modelCalibrations]
  );

  const calibrationStatusLabel = useMemo(
    () => getCalibrationStatusLabel(activeModel, Boolean(savedModelCalibration)),
    [activeModel, savedModelCalibration]
  );

  const calibrationSceneDistanceUnits = useMemo(() => {
    if (!calibrationPointA || !calibrationPointB) return 0;
    return computeSceneDistance(calibrationPointA, calibrationPointB);
  }, [calibrationPointA, calibrationPointB]);

  const calibrationDraftUnitsPerCm = useMemo(() => {
    if (calibrationSceneDistanceUnits <= 0 || calibrationRealDistanceCm <= 0) return 0;
    return calibrationSceneDistanceUnits / calibrationRealDistanceCm;
  }, [calibrationRealDistanceCm, calibrationSceneDistanceUnits]);

  const selectedPreset = useMemo<Tattoo3DPlacement | null>(() => {
    return placementPresets.find((item) => item.id === selectedPlacementId) ?? null;
  }, [placementPresets, selectedPlacementId]);

  const selectedOverride = useMemo<PlacementOverride | null>(() => {
    const modelOverrides = overrides[activeModel.id];
    if (!modelOverrides) return null;
    return modelOverrides[selectedPlacementId] ?? null;
  }, [activeModel.id, overrides, selectedPlacementId]);

  const selectedPlacementSavedAt = selectedOverride?.savedAt ?? null;

  const hasSavedOverride = (placementId: string): boolean =>
    Boolean(overrides[activeModel.id]?.[placementId]);

  const filteredPlacementPresets = useMemo(
    () => filterPlacementsByCategory(placementPresets, placementFilterCategory),
    [placementFilterCategory, placementPresets]
  );

  const savedPlacementCount = useMemo(() => {
    const modelOverrides = overrides[activeModel.id] ?? {};
    return placementPresets.filter((preset) => Boolean(modelOverrides[preset.id])).length;
  }, [activeModel.id, overrides, placementPresets]);

  const totalPlacementCount = placementPresets.length;

  useEffect(() => {
    if (!selectedPreset) return;
    setDraftPlacement(toDraftPlacement(selectedPreset, selectedOverride ?? undefined));
  }, [selectedPreset, selectedOverride]);

  const resolvedPlacement = useMemo<Tattoo3DPlacement | null>(() => {
    if (!draftPlacement) return null;
    return {
      id: draftPlacement.id,
      label: draftPlacement.label,
      position: cloneVec3(draftPlacement.position),
      rotation: [
        degToRad(draftPlacement.rotationDeg[0]),
        degToRad(draftPlacement.rotationDeg[1]),
        degToRad(draftPlacement.rotationDeg[2]),
      ],
      scaleMultiplier: draftPlacement.scaleMultiplier,
      depth: draftPlacement.depth,
      enabled: true,
    };
  }, [draftPlacement]);

  const updateDraftPlacement = (patch: Partial<DraftPlacement>) => {
    setDraftPlacement((current) => {
      if (!current) return current;
      return {
        ...current,
        ...patch,
      };
    });
  };

  const handleSelectPlacement = (placementId: string) => {
    setSelectedPlacementId(placementId);
    setPanelMessage('');
  };

  const handleSelectModel = (modelId: Tattoo3DModelSlotId) => {
    const nextModel = getTattoo3DModelById(modelId);
    if (!nextModel) return;
    setSelectedModelId(modelId);
    setCalibrationModeActive(false);
    setCalibrationPickTarget(null);
    setPanelMessage('');
    setUploadMessage('');
    setDisplayMessage('');
    setDebugInfo(null);
    fallbackHydratedModelsRef.current.delete(modelId);
    const presets = nextModel.placements.filter((item) => item.enabled);
    setSelectedPlacementId(
      presets.find((item) => item.id === 'forearm_outer_center')?.id ??
        presets[0]?.id ??
        ''
    );
  };

  const resolvedDisplayConfig = useMemo((): Tattoo3DModelDisplayConfig => {
    if (draftDisplay && draftDisplay.modelId === activeModel.id) {
      return draftDisplay;
    }
    const persisted = displayConfigs[activeModel.id];
    if (isPersistedDisplayConfig(persisted)) {
      return persisted;
    }
    const fit = modelDebugFitRef.current[activeModel.id];
    if (fit) {
      return buildFallbackDisplayFromDebug(activeModel.id, fit);
    }
    return createFallbackDisplayConfig(activeModel.id, {
      cameraPosition: [0, 0, 280],
      cameraTarget: [0, 0, 0],
      minDistance: 50,
      maxDistance: 2000,
    });
  }, [activeModel.id, displayConfigs, draftDisplay]);

  useEffect(() => {
    fallbackHydratedModelsRef.current.delete(activeModel.id);

    const persisted = displayConfigsRef.current[activeModel.id];
    if (isPersistedDisplayConfig(persisted)) {
      setDraftDisplay(cloneDisplayConfig(persisted));
      fallbackHydratedModelsRef.current.add(activeModel.id);
      return;
    }

    setDraftDisplay(null);
  }, [activeModel.id]);

  useEffect(() => {
    if (isPersistedDisplayConfig(displayConfigsRef.current[activeModel.id])) return;
    if (fallbackHydratedModelsRef.current.has(activeModel.id)) return;

    const fit = modelDebugFitRef.current[activeModel.id];
    if (!fit) return;

    fallbackHydratedModelsRef.current.add(activeModel.id);
    setDraftDisplay((current) => {
      if (current?.modelId === activeModel.id) return current;
      return buildFallbackDisplayFromDebug(activeModel.id, fit);
    });
  }, [activeModel.id, debugInfo]);

  const updateDraftDisplay = (patch: Partial<Tattoo3DModelDisplayConfig>) => {
    setDraftDisplay((current) => {
      if (!current || current.modelId !== activeModel.id) {
        return current;
      }
      const next: Tattoo3DModelDisplayConfig = {
        ...current,
        ...patch,
        modelId: activeModel.id,
      };
      if (
        patch.displayRotationDeg &&
        vec3Equal(patch.displayRotationDeg, current.displayRotationDeg)
      ) {
        return current;
      }
      return next;
    });
  };

  const handleCameraCaptured = useCallback((snapshot: CameraSnapshot) => {
    setDraftDisplay((current) => {
      if (!current || current.modelId !== activeModelIdRef.current) {
        return current;
      }
      return {
        ...current,
        modelId: activeModelIdRef.current,
        defaultCameraPosition: cloneVec3(snapshot.position),
        defaultCameraTarget: cloneVec3(snapshot.target),
        frontAzimuth: snapshot.azimuth,
        frontPolar: snapshot.polar,
        customerMinDistance: Math.max(
          snapshot.distance * 0.5,
          modelDebugFitRef.current[activeModelIdRef.current]?.controlMinDistance ?? 50
        ),
        customerMaxDistance: Math.min(
          snapshot.distance * 2,
          modelDebugFitRef.current[activeModelIdRef.current]?.controlMaxDistance ?? 2000
        ),
      };
    });
    setDisplayMessage('已擷取目前視角為正面');
  }, []);

  const handleSetPoseAsDefault = () => {
    if (!draftDisplay || draftDisplay.modelId !== activeModel.id) {
      setDisplayMessage('請先調整 Display Rotation');
      return;
    }
    setDisplayMessage('已將目前 Display Rotation 設為此模型預設姿勢');
  };

  const handleSetViewAsFront = () => {
    setCaptureCameraRequestId((value) => value + 1);
  };

  const handleSaveDisplayConfig = () => {
    const draft = draftDisplayRef.current;
    const source =
      draft && draft.modelId === activeModel.id ? draft : resolvedDisplayConfig;

    const fit = modelDebugFitRef.current[activeModel.id];
    const defaults = fit
      ? buildFallbackDisplayFromDebug(activeModel.id, fit)
      : createFallbackDisplayConfig(activeModel.id, {
          cameraPosition: [0, 0, 280],
          cameraTarget: [0, 0, 0],
          minDistance: 50,
          maxDistance: 2000,
        });

    const hasNonZeroVec3 = (value: Vec3): boolean => value.some((item) => item !== 0);

    const payload: Tattoo3DModelDisplayConfig = {
      modelId: activeModel.id,
      displayRotationDeg: cloneVec3(source.displayRotationDeg),
      displayPosition: cloneVec3(source.displayPosition),
      defaultCameraPosition: hasNonZeroVec3(source.defaultCameraPosition)
        ? cloneVec3(source.defaultCameraPosition)
        : cloneVec3(defaults.defaultCameraPosition),
      defaultCameraTarget: hasNonZeroVec3(source.defaultCameraTarget)
        ? cloneVec3(source.defaultCameraTarget)
        : cloneVec3(defaults.defaultCameraTarget),
      frontAzimuth: Number.isFinite(source.frontAzimuth)
        ? source.frontAzimuth
        : defaults.frontAzimuth,
      frontPolar: Number.isFinite(source.frontPolar) ? source.frontPolar : defaults.frontPolar,
      customerMinDistance:
        source.customerMinDistance > 0
          ? source.customerMinDistance
          : defaults.customerMinDistance,
      customerMaxDistance:
        source.customerMaxDistance > 0
          ? source.customerMaxDistance
          : defaults.customerMaxDistance,
      savedAt: new Date().toISOString(),
    };

    const result = saveModelDisplayConfig(activeModel.id, payload);
    if (result.ok === false) {
      console.error('儲存模型顯示設定失敗:', result.error);
      setDisplayMessage('儲存失敗，請確認瀏覽器允許 localStorage');
      return;
    }

    const persistedStore = loadModelDisplayConfigs();
    setDisplayConfigs(persistedStore);
    setDraftDisplay(cloneDisplayConfig(payload));
    fallbackHydratedModelsRef.current.add(activeModel.id);
    setDisplayMessage('模型顯示設定已儲存');
  };

  const handleResetDisplayConfig = () => {
    const nextStore = { ...loadRawModelDisplayStore() };
    delete nextStore[activeModel.id];

    const result = saveModelDisplayConfigs(nextStore);
    if (result.ok === false) {
      console.error('恢復模型顯示預設失敗:', result.error);
      setDisplayMessage('儲存失敗，請確認瀏覽器允許 localStorage');
      return;
    }

    setDisplayConfigs(loadModelDisplayConfigs());
    fallbackHydratedModelsRef.current.delete(activeModel.id);
    const fit = modelDebugFitRef.current[activeModel.id];
    if (fit) {
      setDraftDisplay(buildFallbackDisplayFromDebug(activeModel.id, fit));
      fallbackHydratedModelsRef.current.add(activeModel.id);
    } else {
      setDraftDisplay(null);
    }
    setDisplayMessage('已恢復模型顯示預設');
  };

  const handleResetFrontView = () => {
    setResetFrontRequestId((value) => value + 1);
  };

  const handleTattooSizeInput = (rawValue: number) => {
    if (!Number.isFinite(rawValue)) return;
    const clamped = Math.min(40, Math.max(5, Math.round(rawValue)));
    setTattooLongEdgeCm(clamped);
  };

  const viewerModel = useMemo<Tattoo3DModelConfig | null>(() => {
    if (!resolvedModelAssetUrl) return null;
    const display = resolvedDisplayConfig;
    return {
      ...activeModel,
      assetUrl: `${resolvedModelAssetUrl}?v=${modelReloadNonce}`,
      displayRotation: display.displayRotationDeg.map((value) => degToRad(value)) as Vec3,
      displayPosition: cloneVec3(display.displayPosition),
    };
  }, [activeModel, modelReloadNonce, resolvedDisplayConfig, resolvedModelAssetUrl]);

  const tattooTextureUrl = useMemo(() => {
    if (!resolvedTattooAssetUrl) return '';
    return `${resolvedTattooAssetUrl}?v=${textureReloadNonce}`;
  }, [resolvedTattooAssetUrl, textureReloadNonce]);

  const updateOverrides = (
    updater: (prev: PlacementOverridesMap) => PlacementOverridesMap
  ) => {
    setOverrides((prev) => {
      const next = updater(prev);
      savePlacementOverrides(next);
      return next;
    });
  };

  const copyJsonToClipboard = async (value: unknown, message: string) => {
    const text = JSON.stringify(value, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setPanelMessage(message);
    } catch (error) {
      console.warn('Copy failed:', error);
      setPanelMessage('複製失敗，請改用下方 JSON 手動複製。');
    }
  };

  const handleCopyCurrentPreset = async () => {
    if (!draftPlacement) return;
    await copyJsonToClipboard(
      {
        id: draftPlacement.id,
        label: draftPlacement.label,
        position: draftPlacement.position,
        rotationDeg: draftPlacement.rotationDeg,
        scaleMultiplier: draftPlacement.scaleMultiplier,
        depth: draftPlacement.depth,
      },
      `已複製 ${draftPlacement.label} 目前校正值`
    );
  };

  const handleSaveCurrentPreset = () => {
    if (!draftPlacement) return;
    const now = new Date().toISOString();
    const modelId = activeModel.id;

    updateOverrides((prev) => {
      const modelOverrides = prev[modelId] ?? {};
      return {
        ...prev,
        [modelId]: {
          ...modelOverrides,
          [draftPlacement.id]: {
            position: cloneVec3(draftPlacement.position),
            rotationDeg: cloneVec3(draftPlacement.rotationDeg),
            scaleMultiplier: draftPlacement.scaleMultiplier,
            depth: draftPlacement.depth,
            savedAt: now,
          },
        },
      };
    });

    setPanelMessage(`已儲存 ${draftPlacement.label} 校正值`);
  };

  const handleResetCurrentPreset = () => {
    if (!selectedPreset) return;
    const modelId = activeModel.id;
    const placementId = selectedPreset.id;

    updateOverrides((prev) => {
      const modelOverrides = prev[modelId];
      if (!modelOverrides || !modelOverrides[placementId]) return prev;
      const nextModelOverrides = { ...modelOverrides };
      delete nextModelOverrides[placementId];
      if (Object.keys(nextModelOverrides).length === 0) {
        const next = { ...prev };
        delete next[modelId];
        return next;
      }
      return {
        ...prev,
        [modelId]: nextModelOverrides,
      };
    });

    setDraftPlacement(toDraftPlacement(selectedPreset));
    setPanelMessage(`已恢復 ${selectedPreset.label} 預設值`);
  };

  const handleExportAllPresets = async () => {
    const modelId = activeModel.id;
    const modelOverrides = overrides[modelId] ?? {};
    const placements = activeModel.placements
      .filter((preset) => modelOverrides[preset.id])
      .map((preset) => {
        const override = modelOverrides[preset.id];
        return {
          id: preset.id,
          label: preset.label,
          position: cloneVec3(override.position),
          rotationDeg: cloneVec3(override.rotationDeg),
          scaleMultiplier: override.scaleMultiplier,
          depth: override.depth,
        };
      });

    await copyJsonToClipboard(
      {
        modelId,
        placements,
      },
      `已匯出 ${placements.length} 筆已校正 Preset`
    );
  };

  const updateModelCalibrations = (
    updater: (
      prev: Record<string, SavedAnatomicalCalibration>
    ) => Record<string, SavedAnatomicalCalibration>
  ) => {
    setModelCalibrations((prev) => {
      const next = updater(prev);
      saveModelCalibrations(next);
      return next;
    });
  };

  const loadDraftFromSaved = (saved: SavedAnatomicalCalibration | null) => {
    if (!saved) {
      setCalibrationPointA(null);
      setCalibrationPointB(null);
      setCalibrationReferenceLabel('');
      setCalibrationRealDistanceCm(26);
      return;
    }
    setCalibrationPointA(cloneVec3(saved.pointA));
    setCalibrationPointB(cloneVec3(saved.pointB));
    setCalibrationReferenceLabel(saved.referenceLabel);
    setCalibrationRealDistanceCm(saved.realDistanceCm);
  };

  const handleStartCalibrationMode = () => {
    setCalibrationModeActive(true);
    setCalibrationMessage('');
    loadDraftFromSaved(savedModelCalibration);
    setCalibrationPickTarget(savedModelCalibration ? null : 'A');
  };

  const handleStopCalibrationMode = () => {
    setCalibrationModeActive(false);
    setCalibrationPickTarget(null);
  };

  const handleCalibrationPointPicked = useCallback(
    (point: Vec3) => {
      if (calibrationPickTarget === 'A') {
        setCalibrationPointA(cloneVec3(point));
        setCalibrationPickTarget('B');
        return;
      }
      if (calibrationPickTarget === 'B') {
        setCalibrationPointB(cloneVec3(point));
        setCalibrationPickTarget(null);
      }
    },
    [calibrationPickTarget]
  );

  const handleRepickCalibrationPointA = () => {
    setCalibrationPointA(null);
    setCalibrationPickTarget('A');
    setCalibrationMessage('');
  };

  const handleRepickCalibrationPointB = () => {
    setCalibrationPointB(null);
    setCalibrationPickTarget('B');
    setCalibrationMessage('');
  };

  const handleSaveModelCalibration = () => {
    if (!calibrationPointA || !calibrationPointB) {
      setCalibrationMessage('請先選取 Point A 與 Point B');
      return;
    }
    if (!calibrationReferenceLabel.trim()) {
      setCalibrationMessage('請輸入 Reference Label');
      return;
    }
    if (!Number.isFinite(calibrationRealDistanceCm) || calibrationRealDistanceCm <= 0) {
      setCalibrationMessage('Real Distance Cm 必須大於 0');
      return;
    }

    const sceneDistanceUnits = computeSceneDistance(calibrationPointA, calibrationPointB);
    if (sceneDistanceUnits <= 0) {
      setCalibrationMessage('Scene Distance 必須大於 0');
      return;
    }

    const unitsPerCm = sceneDistanceUnits / calibrationRealDistanceCm;
    const now = new Date().toISOString();
    const payload: SavedAnatomicalCalibration = {
      modelId: activeModel.id,
      referenceLabel: calibrationReferenceLabel.trim(),
      pointA: cloneVec3(calibrationPointA),
      pointB: cloneVec3(calibrationPointB),
      sceneDistanceUnits,
      realDistanceCm: calibrationRealDistanceCm,
      unitsPerCm,
      savedAt: now,
    };

    updateModelCalibrations((prev) => ({
      ...prev,
      [activeModel.id]: payload,
    }));
    setCalibrationMessage('已儲存模型尺寸校正');
  };

  const handleClearModelCalibration = () => {
    updateModelCalibrations((prev) => {
      if (!prev[activeModel.id]) return prev;
      const next = { ...prev };
      delete next[activeModel.id];
      return next;
    });
    loadDraftFromSaved(null);
    setCalibrationPickTarget(null);
    setCalibrationMessage('已清除模型尺寸校正');
  };

  const handleRestoreTemporaryCalibration = () => {
    handleClearModelCalibration();
    setCalibrationMessage(
      activeModel.hasTemporaryCalibrationFallback
        ? '已恢復暫定 70cm calibration'
        : '已清除模型尺寸校正'
    );
  };

  const handleObjUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      await upload3dModelObj(activeModel.id, file);
      setModelReloadNonce((value) => value + 1);
      setUploadMessage(`${activeModel.label} OBJ 上傳成功，已重新載入模型`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OBJ 上傳失敗';
      setUploadMessage(message);
    }
  };

  const handlePngUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      await upload3dTestTexturePng(file);
      setTextureReloadNonce((value) => value + 1);
      setUploadMessage('測試 PNG 上傳成功，已重新載入貼圖');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'PNG 上傳失敗';
      setUploadMessage(message);
    }
  };

  const runBroadDepthScan = () => {
    setScanRequest({
      id: Date.now(),
      kind: 'broad',
      depths: [10, 20, 30, 40, 50, 60, 80, 100, 120, 150, 200],
    });
  };

  const runFineDepthScan = () => {
    if (!broadScanResult || broadScanResult.entries.length === 0) return;
    let low = 0;
    let high = 0;
    for (let i = 1; i < broadScanResult.entries.length; i += 1) {
      const prev = broadScanResult.entries[i - 1];
      const curr = broadScanResult.entries[i];
      if (prev.vertexCount === 0 && curr.vertexCount > 0) {
        low = prev.depth;
        high = curr.depth;
        break;
      }
    }
    if (low === 0 && high === 0) return;
    const depths: number[] = [];
    for (let d = low; d <= high; d += 1) depths.push(d);
    setScanRequest({
      id: Date.now(),
      kind: 'fine',
      depths,
    });
  };

  const handleDepthScanResult = (result: DepthScanResult) => {
    if (result.kind === 'broad') setBroadScanResult(result);
    if (result.kind === 'fine') setFineScanResult(result);
  };

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setModelAssetStatus('checking');
      setTattooAssetStatus('checking');

      const [modelUrl, tattooUrl] = await Promise.all([
        resolveModelAssetUrl(activeModel),
        resolveTattooAssetUrl(),
      ]);
      if (!mounted) return;
      setResolvedModelAssetUrl(modelUrl);
      setResolvedTattooAssetUrl(tattooUrl);
      setModelAssetStatus(modelUrl ? 'ready' : 'missing');
      setTattooAssetStatus(tattooUrl ? 'ready' : 'missing');
    };
    run().catch((error) => {
      console.error('3D prototype asset check failed:', error);
      if (!mounted) return;
      setModelAssetStatus('error');
      setTattooAssetStatus('error');
    });
    return () => {
      mounted = false;
    };
  }, [activeModel, modelReloadNonce, textureReloadNonce]);

  return (
    <div className="min-h-screen bg-dark text-gray-200 px-4 py-6 md:px-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="bg-card border border-white/10 rounded-xl p-4">
          <h1 className="text-2xl font-bold text-white">3D Tattoo Preview — Real OBJ Prototype</h1>
          <p className="text-sm text-gray-400 mt-2">
            驗證固定 Placement + Decal + 真實比例換算（Phase 1 技術驗證頁）
          </p>
          {previewMode === 'developer' ? (
            <p className="text-xs text-amber-300 mt-2 border border-amber-500/30 bg-amber-950/30 rounded px-3 py-2">
              {savedModelCalibration
                ? `Calibration：已校正（${savedModelCalibration.referenceLabel} / ${savedModelCalibration.realDistanceCm} cm）`
                : `Calibration：${calibrationStatusLabel}${
                    activeModel.hasTemporaryCalibrationFallback
                      ? '（699.936 units = 70 cm）'
                      : ''
                  }`}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
          <section className="bg-card border border-white/10 rounded-xl p-3 md:p-4 min-h-[480px]">
            {modelAssetStatus === 'checking' || tattooAssetStatus === 'checking' ? (
              <div className="h-[460px] flex items-center justify-center text-gray-300">
                檢查測試資產中…
              </div>
            ) : modelAssetStatus !== 'ready' || !viewerModel ? (
              <div className="h-[460px] flex items-center justify-center text-gray-300 bg-black/30 rounded-lg border border-white/10 text-center px-6">
                尚未加入模型
                <p className="text-xs text-gray-500 mt-2">{activeModel.label}</p>
              </div>
            ) : tattooAssetStatus !== 'ready' || !tattooTextureUrl ? (
              <div className="h-[460px] flex items-center justify-center text-red-300 bg-black/30 rounded-lg border border-red-900/40 text-center px-6">
                找不到測試刺青圖片
              </div>
            ) : !resolvedPlacement ? (
              <div className="h-[460px] flex items-center justify-center text-amber-300">
                尚未設定 Placement，請檢查 prototype config。
              </div>
            ) : (
              <ViewerLoadBoundary>
                <Suspense
                  fallback={
                    <div className="h-[460px] flex items-center justify-center text-gray-300">
                      3D Viewer 載入中…
                    </div>
                  }
                >
                  <Tattoo3DViewer
                    key={`${activeModel.id}-${modelReloadNonce}`}
                    selectedPresetId={selectedPlacementId}
                    model={viewerModel}
                    placement={resolvedPlacement}
                    tattooTextureUrl={tattooTextureUrl}
                    tattooLongEdgeCm={tattooLongEdgeCm}
                    savedCalibration={savedModelCalibration}
                    calibrationModeActive={
                      previewMode === 'developer' && calibrationModeActive
                    }
                    calibrationPickTarget={calibrationPickTarget}
                    calibrationPointA={calibrationPointA}
                    calibrationPointB={calibrationPointB}
                    onCalibrationPointPicked={handleCalibrationPointPicked}
                    previewMode={previewMode}
                    displayConfig={resolvedDisplayConfig}
                    resetFrontRequestId={resetFrontRequestId}
                    captureCameraRequestId={captureCameraRequestId}
                    onCameraCaptured={handleCameraCaptured}
                    debug={previewMode === 'developer' && debugEnabled}
                    decalMaterialMode={decalMaterialMode}
                    renderEngine={renderEngine}
                    scanRequest={scanRequest}
                    onDepthScanResult={handleDepthScanResult}
                    onDebugInfoChange={handleDebugInfoChange}
                  />
                </Suspense>
              </ViewerLoadBoundary>
            )}
          </section>

          <aside className="bg-card border border-white/10 rounded-xl p-4 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {previewMode === 'customer' ? 'Customer Preview' : '控制區'}
              </h2>
              <p className="text-xs text-gray-400 mt-1">模型：{activeModel.label}</p>
              {previewMode === 'developer' ? (
                <p className="text-xs text-emerald-300 mt-1">
                  已校正 {savedPlacementCount} / {totalPlacementCount}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-200">預覽模式</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewMode('developer')}
                  className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                    previewMode === 'developer'
                      ? 'bg-primary text-black border-primary'
                      : 'bg-gray-900 text-gray-200 border-white/15 hover:border-primary/60'
                  }`}
                >
                  Developer Mode
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('customer')}
                  className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                    previewMode === 'customer'
                      ? 'bg-primary text-black border-primary'
                      : 'bg-gray-900 text-gray-200 border-white/15 hover:border-primary/60'
                  }`}
                >
                  Customer Preview
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-200">模型切換</p>
              <div className="grid grid-cols-2 gap-2">
                {TATTOO_3D_MODEL_SLOT_IDS.map((modelId) => {
                  const slot = getTattoo3DModelById(modelId);
                  if (!slot) return null;
                  return (
                    <button
                      key={modelId}
                      type="button"
                      onClick={() => handleSelectModel(modelId)}
                      className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                        selectedModelId === modelId
                          ? 'bg-primary text-black border-primary'
                          : 'bg-gray-900 text-gray-200 border-white/15 hover:border-primary/60'
                      }`}
                    >
                      {slot.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {previewMode === 'customer' ? (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-200">刺青尺寸</p>
                  <label className="flex items-center gap-2 text-sm text-gray-300">
                    <input
                      type="number"
                      min={5}
                      max={40}
                      step={1}
                      value={tattooLongEdgeCm}
                      onChange={(event) => handleTattooSizeInput(Number(event.target.value))}
                      className="w-24 bg-black/30 border border-white/15 rounded px-2 py-1 text-gray-200"
                    />
                    <span>cm（長邊，5–40）</span>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={handleResetFrontView}
                  className="w-full px-3 py-2 rounded-lg text-sm font-medium border border-white/15 bg-gray-900 text-gray-200 hover:border-primary/60"
                >
                  ↻ 回到正面
                </button>
              </>
            ) : null}

            {previewMode === 'developer' && isAdmin ? (
              <div className="space-y-2 text-xs">
                <p className="text-sm font-medium text-gray-200">Admin 3D 資產</p>
                <label className="block">
                  <span className="text-gray-300">上傳 / 更換 OBJ（max 20MB）</span>
                  <input
                    type="file"
                    accept=".obj"
                    onChange={handleObjUpload}
                    className="mt-1 block w-full text-xs text-gray-300 file:mr-2 file:rounded file:border-0 file:bg-primary file:px-2 file:py-1 file:text-black"
                  />
                </label>
                {debugEnabled ? (
                  <label className="block">
                    <span className="text-gray-300">上傳測試 PNG（max 10MB）</span>
                    <input
                      type="file"
                      accept=".png,image/png"
                      onChange={handlePngUpload}
                      className="mt-1 block w-full text-xs text-gray-300 file:mr-2 file:rounded file:border-0 file:bg-primary file:px-2 file:py-1 file:text-black"
                    />
                  </label>
                ) : null}
                {uploadMessage ? <p className="text-emerald-300">{uploadMessage}</p> : null}
              </div>
            ) : null}

            {previewMode === 'developer' ? (
              <div className="text-sm text-gray-300 space-y-1">
                <p>Calibration：{calibrationStatusLabel}</p>
                {savedModelCalibration ? (
                  <>
                    <p>參考：{savedModelCalibration.referenceLabel}</p>
                    <p>
                      {savedModelCalibration.sceneDistanceUnits.toFixed(2)} units /{' '}
                      {savedModelCalibration.realDistanceCm} cm
                    </p>
                    <p>unitsPerCm：{savedModelCalibration.unitsPerCm.toFixed(4)}</p>
                  </>
                ) : activeModel.hasTemporaryCalibrationFallback ? (
                  <>
                    <p>
                      參考：{activeModel.calibration.sceneReferenceLengthUnits} units /{' '}
                      {activeModel.calibration.realReferenceLengthCm} cm
                    </p>
                    <p>unitsPerCm：{defaultUnitsPerCm.toFixed(4)}</p>
                  </>
                ) : (
                  <p className="text-gray-400">請使用 A-B 尺寸校正設定真實比例</p>
                )}
                <p>預設刺青尺寸：{config.defaultTattooLongEdgeCm} cm</p>
              </div>
            ) : null}

            {previewMode === 'developer' ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-200">刺青尺寸測試</p>
                <div className="flex gap-2">
                  {config.tattooSizeOptionsCm.map((sizeCm) => (
                    <button
                      key={sizeCm}
                      type="button"
                      onClick={() => setTattooLongEdgeCm(sizeCm)}
                      className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                        tattooLongEdgeCm === sizeCm
                          ? 'bg-primary text-black border-primary'
                          : 'bg-gray-900 text-gray-200 border-white/15 hover:border-primary/60'
                      }`}
                    >
                      {sizeCm} cm
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-200">Placement Preset</p>
              {previewMode === 'developer' ? (
                <div className="flex flex-wrap gap-2">
                  {PLACEMENT_FILTER_CATEGORIES.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setPlacementFilterCategory(category)}
                      className={`px-2 py-1 rounded-lg text-xs border transition-colors ${
                        placementFilterCategory === category
                          ? 'bg-primary text-black border-primary'
                          : 'bg-gray-900 text-gray-200 border-white/15 hover:border-primary/60'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="grid grid-cols-1 gap-2 max-h-[320px] overflow-y-auto pr-1">
                {(previewMode === 'customer'
                  ? placementPresets
                  : filteredPlacementPresets
                ).map((placement) => (
                  <button
                    key={placement.id}
                    type="button"
                    onClick={() => handleSelectPlacement(placement.id)}
                    className={`px-3 py-2 rounded-lg text-sm border text-left transition-colors ${
                      selectedPlacementId === placement.id
                        ? 'bg-primary text-black border-primary'
                        : 'bg-gray-900 text-gray-200 border-white/15 hover:border-primary/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>{placement.label}</span>
                      {previewMode === 'developer' ? (
                        hasSavedOverride(placement.id) ? (
                          <span className="text-emerald-300 text-xs">✓ 已校正</span>
                        ) : (
                          <span className="text-gray-400 text-xs">未校正</span>
                        )
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {previewMode === 'developer' ? (
              <>
                <button
                  type="button"
                  onClick={() => setDebugEnabled((prev) => !prev)}
                  className={`w-full px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    debugEnabled
                      ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40'
                      : 'bg-gray-900 text-gray-200 border-white/15'
                  }`}
                >
                  Debug {debugEnabled ? 'ON' : 'OFF'}
                </button>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-200">Render Engine</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRenderEngine('drei_decal')}
                      className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                        renderEngine === 'drei_decal'
                          ? 'bg-primary text-black border-primary'
                          : 'bg-gray-900 text-gray-200 border-white/15'
                      }`}
                    >
                      Drei Decal
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenderEngine('raw_decal_geometry')}
                      className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                        renderEngine === 'raw_decal_geometry'
                          ? 'bg-primary text-black border-primary'
                          : 'bg-gray-900 text-gray-200 border-white/15'
                      }`}
                    >
                      Raw DecalGeometry
                    </button>
                  </div>
                </div>

                <p className="text-xs text-gray-400 border-t border-white/10 pt-3">
                  拖曳旋轉模型，滾輪縮放。已禁止平移（Pan）。
                </p>
              </>
            ) : (
              <p className="text-xs text-gray-400 border-t border-white/10 pt-3">
                僅可左右旋轉與有限度縮放；不可上下翻轉或平移。
              </p>
            )}
          </aside>
        </div>

        {previewMode === 'developer' && debugEnabled && (
          <Tattoo3DDebugPanel
            debugInfo={debugInfo}
            selectedPresetId={selectedPlacementId}
            draftPlacement={draftPlacement}
            onDraftPlacementChange={updateDraftPlacement}
            onCopyCurrentPreset={handleCopyCurrentPreset}
            onSaveCurrentPreset={handleSaveCurrentPreset}
            onResetCurrentPreset={handleResetCurrentPreset}
            onExportAllPresets={handleExportAllPresets}
            panelMessage={panelMessage}
            lastSavedAt={selectedPlacementSavedAt}
            decalMaterialMode={decalMaterialMode}
            onDecalMaterialModeChange={setDecalMaterialMode}
            onRunDepthScan={runBroadDepthScan}
            onRunFineScan={runFineDepthScan}
            broadScanResult={broadScanResult}
            fineScanResult={fineScanResult}
            calibrationModeActive={calibrationModeActive}
            calibrationPickTarget={calibrationPickTarget}
            calibrationPointA={calibrationPointA}
            calibrationPointB={calibrationPointB}
            calibrationReferenceLabel={calibrationReferenceLabel}
            calibrationRealDistanceCm={calibrationRealDistanceCm}
            calibrationSceneDistanceUnits={calibrationSceneDistanceUnits}
            calibrationDraftUnitsPerCm={calibrationDraftUnitsPerCm}
            defaultUnitsPerCm={defaultUnitsPerCm}
            savedModelCalibration={savedModelCalibration}
            calibrationStatusLabel={calibrationStatusLabel}
            hasTemporaryCalibrationFallback={activeModel.hasTemporaryCalibrationFallback}
            calibrationMessage={calibrationMessage}
            onStartCalibrationMode={handleStartCalibrationMode}
            onStopCalibrationMode={handleStopCalibrationMode}
            onCalibrationReferenceLabelChange={setCalibrationReferenceLabel}
            onCalibrationRealDistanceCmChange={setCalibrationRealDistanceCm}
            onRepickCalibrationPointA={handleRepickCalibrationPointA}
            onRepickCalibrationPointB={handleRepickCalibrationPointB}
            onSaveModelCalibration={handleSaveModelCalibration}
            onClearModelCalibration={handleClearModelCalibration}
            onRestoreTemporaryCalibration={handleRestoreTemporaryCalibration}
            draftDisplay={draftDisplay}
            onDraftDisplayChange={updateDraftDisplay}
            onSetPoseAsDefault={handleSetPoseAsDefault}
            onSetViewAsFront={handleSetViewAsFront}
            onSaveDisplayConfig={handleSaveDisplayConfig}
            onResetDisplayConfig={handleResetDisplayConfig}
            displayMessage={displayMessage}
          />
        )}
      </div>
    </div>
  );
};

export default Tattoo3DPreviewTest;
