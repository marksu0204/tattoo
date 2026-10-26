import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useLoader, useThree } from '@react-three/fiber';
import { Html, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import ObjBodyPart, { ObjBodyPartDebugInfo } from './ObjBodyPart';
import TattooDecal from './TattooDecal';
import CalibrationPointPicker from './CalibrationPointPicker';
import {
  Tattoo3DModelConfig,
  Tattoo3DPlacement,
  Vec3,
  cmToSceneUnits,
} from '../../config/tattoo3dPrototype';
import {
  SavedAnatomicalCalibration,
  getDefaultUnitsPerCm,
  resolveUnitsPerCm,
} from '../../config/tattoo3dCalibrationStorage';
import {
  CameraSnapshot,
  Tattoo3DModelDisplayConfig,
} from '../../config/tattoo3dDisplayStorage';

export type PreviewMode = 'developer' | 'customer';

export interface Tattoo3DDebugInfo {
  selectedPresetId: string;
  resolvedPlacementId: string;
  placementId: string;
  placementRotation: Vec3;
  placementPosition: Vec3;
  decalSize: Vec3;
  unitsPerCm: number;
  defaultUnitsPerCm: number;
  calibrationSource: 'saved_anatomical' | 'temporary_whole_model_length' | 'uncalibrated';
  tattooLongEdgeCm: number;
  tattooLongEdgeUnits: number;
  tattooWidthUnits: number;
  tattooHeightUnits: number;
  textureWidth: number;
  textureHeight: number;
  textureAspectRatio: number;
  referenceLabel: string;
  calibrationMode: string;
  realReferenceLengthCm: number;
  sceneReferenceLengthUnits: number;
  rawBoundingBoxMin: Vec3;
  rawBoundingBoxMax: Vec3;
  rawBoundingBoxSize: Vec3;
  rawBoundingBoxCenter: Vec3;
  centeredBoundingBoxMin: Vec3;
  centeredBoundingBoxMax: Vec3;
  centeredBoundingBoxSize: Vec3;
  centeredBoundingBoxCenter: Vec3;
  centeredBoundingSphereRadius: number;
  centeringOffset: Vec3;
  meshList: Array<{ name: string; vertexCount: number; triangleCount: number }>;
  targetMeshName: string | null;
  targetMeshUUID: string | null;
  targetMeshVertexCount: number;
  targetMeshTriangleCount: number;
  renderedMeshName: string | null;
  renderedMeshUUID: string | null;
  totalVertices: number;
  totalTriangles: number;
  cameraDistance: number;
  cameraNear: number;
  cameraFar: number;
  controlMinDistance: number;
  controlMaxDistance: number;
  matrixWorldUpdated: boolean;
  decalVertexCount: number;
  decalIndexCount: number;
  decalBoundingBoxMin: Vec3 | null;
  decalBoundingBoxMax: Vec3 | null;
  decalBoundingBoxSize: Vec3 | null;
  minimumIntersectDepth: number | null;
  diagnosticInput: {
    targetMeshName: string | null;
    targetMeshUUID: string | null;
    position: Vec3;
    rotation: Vec3;
    size: Vec3;
  };
  renderInput: {
    targetMeshName: string | null;
    targetMeshUUID: string | null;
    position: Vec3;
    rotation: Vec3;
    size: Vec3;
  };
}

export interface DepthScanEntry {
  depth: number;
  vertexCount: number;
}

export interface DepthScanResult {
  kind: 'broad' | 'fine';
  entries: DepthScanEntry[];
  firstIntersectionDepth: number | null;
}

interface Tattoo3DViewerProps {
  selectedPresetId: string;
  model: Tattoo3DModelConfig;
  placement: Tattoo3DPlacement;
  tattooTextureUrl: string;
  tattooLongEdgeCm: number;
  savedCalibration: SavedAnatomicalCalibration | null;
  calibrationModeActive: boolean;
  calibrationPickTarget: 'A' | 'B' | null;
  calibrationPointA: Vec3 | null;
  calibrationPointB: Vec3 | null;
  onCalibrationPointPicked: (point: Vec3) => void;
  previewMode: PreviewMode;
  displayConfig: Tattoo3DModelDisplayConfig;
  resetFrontRequestId: number;
  captureCameraRequestId: number;
  onCameraCaptured: (snapshot: CameraSnapshot) => void;
  debug: boolean;
  decalMaterialMode: 'texture' | 'solid_red';
  renderEngine: 'drei_decal' | 'raw_decal_geometry';
  scanRequest: { id: number; kind: 'broad' | 'fine'; depths: number[] } | null;
  onDepthScanResult: (result: DepthScanResult) => void;
  onDebugInfoChange: (info: Tattoo3DDebugInfo) => void;
}

interface CameraFit {
  target: Vec3;
  position: Vec3;
  distance: number;
  near: number;
  far: number;
  minDistance: number;
  maxDistance: number;
}

class ViewerErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: (error: Error) => void },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; onError: (error: Error) => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full flex items-center justify-center text-red-300 bg-black/40">
          3D模型載入失敗
        </div>
      );
    }
    return this.props.children;
  }
}

const SceneControls: React.FC<{
  cameraFit: CameraFit;
  fov: number;
  previewMode: PreviewMode;
  displayConfig: Tattoo3DModelDisplayConfig;
  resetFrontRequestId: number;
  captureCameraRequestId: number;
  onCameraCaptured: (snapshot: CameraSnapshot) => void;
}> = ({
  cameraFit,
  fov,
  previewMode,
  displayConfig,
  resetFrontRequestId,
  captureCameraRequestId,
  onCameraCaptured,
}) => {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const cameraAppliedModelRef = useRef<string | null>(null);
  const isCustomer = previewMode === 'customer';

  const initialTarget = useMemo<Vec3>(
    () =>
      displayConfig.defaultCameraTarget.some((value) => value !== 0)
        ? displayConfig.defaultCameraTarget
        : cameraFit.target,
    [cameraFit.target, displayConfig.defaultCameraTarget]
  );

  const initialPosition = useMemo<Vec3>(
    () =>
      displayConfig.defaultCameraPosition.some((value) => value !== 0)
        ? displayConfig.defaultCameraPosition
        : cameraFit.position,
    [cameraFit.position, displayConfig.defaultCameraPosition]
  );

  useEffect(() => {
    cameraAppliedModelRef.current = null;
  }, [displayConfig.modelId]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    if (cameraAppliedModelRef.current === displayConfig.modelId) return;

    const hasSavedCamera = displayConfig.defaultCameraPosition.some((value) => value !== 0);
    const hasObjFit = cameraFit.distance > 0;
    if (!hasSavedCamera && !hasObjFit) return;

    camera.position.set(initialPosition[0], initialPosition[1], initialPosition[2]);
    controls.target.set(initialTarget[0], initialTarget[1], initialTarget[2]);
    controls.update();
    cameraAppliedModelRef.current = displayConfig.modelId;
  }, [
    camera,
    cameraFit.distance,
    displayConfig.defaultCameraPosition,
    displayConfig.modelId,
    initialPosition,
    initialTarget,
  ]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    if (isCustomer) {
      controls.minPolarAngle = displayConfig.frontPolar;
      controls.maxPolarAngle = displayConfig.frontPolar;
      controls.minAzimuthAngle = -Infinity;
      controls.maxAzimuthAngle = Infinity;
    } else {
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = Math.PI;
      controls.minAzimuthAngle = -Infinity;
      controls.maxAzimuthAngle = Infinity;
    }
    controls.update();
  }, [displayConfig.frontPolar, displayConfig.modelId, isCustomer]);

  useEffect(() => {
    if (!resetFrontRequestId) return;
    const controls = controlsRef.current;
    if (!controls) return;
    camera.position.set(
      displayConfig.defaultCameraPosition[0],
      displayConfig.defaultCameraPosition[1],
      displayConfig.defaultCameraPosition[2]
    );
    controls.target.set(
      displayConfig.defaultCameraTarget[0],
      displayConfig.defaultCameraTarget[1],
      displayConfig.defaultCameraTarget[2]
    );
    controls.update();
  }, [camera, displayConfig, resetFrontRequestId]);

  useEffect(() => {
    if (!captureCameraRequestId) return;
    const controls = controlsRef.current;
    if (!controls) return;
    onCameraCaptured({
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: [controls.target.x, controls.target.y, controls.target.z],
      azimuth: controls.getAzimuthalAngle(),
      polar: controls.getPolarAngle(),
      distance: camera.position.distanceTo(controls.target),
    });
  }, [camera, captureCameraRequestId, onCameraCaptured]);

  const minDistance = isCustomer
    ? displayConfig.customerMinDistance
    : cameraFit.minDistance;
  const maxDistance = isCustomer
    ? displayConfig.customerMaxDistance
    : cameraFit.maxDistance;

  return (
    <>
      <PerspectiveCamera
        makeDefault
        fov={fov}
        near={cameraFit.near}
        far={cameraFit.far}
        position={initialPosition}
      />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan={false}
        enableRotate
        enableZoom
        minDistance={minDistance}
        maxDistance={maxDistance}
        target={initialTarget}
        minAzimuthAngle={-Infinity}
        maxAzimuthAngle={Infinity}
        minPolarAngle={isCustomer ? displayConfig.frontPolar : 0}
        maxPolarAngle={isCustomer ? displayConfig.frontPolar : Math.PI}
      />
    </>
  );
};

interface DecalGeometryStats {
  vertexCount: number;
  indexCount: number;
  bboxMin: Vec3 | null;
  bboxMax: Vec3 | null;
  bboxSize: Vec3 | null;
  matrixWorldUpdated: boolean;
}

const analyzeDecalGeometry = (
  targetMesh: THREE.Mesh | null,
  position: Vec3,
  rotation: Vec3,
  size: Vec3
): DecalGeometryStats => {
  if (!targetMesh) {
    return {
      vertexCount: 0,
      indexCount: 0,
      bboxMin: null,
      bboxMax: null,
      bboxSize: null,
      matrixWorldUpdated: false,
    };
  }

  targetMesh.updateWorldMatrix(true, false);

  const geometry = new DecalGeometry(
    targetMesh,
    new THREE.Vector3(position[0], position[1], position[2]),
    new THREE.Euler(rotation[0], rotation[1], rotation[2]),
    new THREE.Vector3(size[0], size[1], size[2])
  );

  const vertexCount = geometry.attributes.position?.count ?? 0;
  const indexCount = geometry.index?.count ?? 0;

  if (vertexCount <= 0) {
    return {
      vertexCount,
      indexCount,
      bboxMin: null,
      bboxMax: null,
      bboxSize: null,
      matrixWorldUpdated: true,
    };
  }

  const box = new THREE.Box3().setFromBufferAttribute(
    geometry.attributes.position as THREE.BufferAttribute
  );
  const sizeVec = new THREE.Vector3();
  box.getSize(sizeVec);

  return {
    vertexCount,
    indexCount,
    bboxMin: [box.min.x, box.min.y, box.min.z],
    bboxMax: [box.max.x, box.max.y, box.max.z],
    bboxSize: [sizeVec.x, sizeVec.y, sizeVec.z],
    matrixWorldUpdated: true,
  };
};

const RawDecalGeometryMesh: React.FC<{
  targetMesh: THREE.Mesh | null;
  position: Vec3;
  rotation: Vec3;
  size: Vec3;
  materialMode: 'texture' | 'solid_red';
  texture: THREE.Texture;
}> = ({ targetMesh, position, rotation, size, materialMode, texture }) => {
  const geometry = useMemo(() => {
    if (!targetMesh) return null;
    targetMesh.updateWorldMatrix(true, false);
    return new DecalGeometry(
      targetMesh,
      new THREE.Vector3(position[0], position[1], position[2]),
      new THREE.Euler(rotation[0], rotation[1], rotation[2]),
      new THREE.Vector3(size[0], size[1], size[2])
    );
  }, [position, rotation, size, targetMesh]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} position={[0, 0, 0]} rotation={[0, 0, 0]} scale={1}>
      {materialMode === 'solid_red' ? (
        <meshBasicMaterial color="#ff1f1f" side={THREE.DoubleSide} transparent opacity={1} />
      ) : (
        <meshStandardMaterial
          map={texture}
          transparent
          alphaTest={0.01}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      )}
    </mesh>
  );
};

const Tattoo3DScene: React.FC<Tattoo3DViewerProps> = ({
  selectedPresetId,
  model,
  placement,
  tattooTextureUrl,
  tattooLongEdgeCm,
  savedCalibration,
  calibrationModeActive,
  calibrationPickTarget,
  calibrationPointA,
  calibrationPointB,
  onCalibrationPointPicked,
  previewMode,
  displayConfig,
  resetFrontRequestId,
  captureCameraRequestId,
  onCameraCaptured,
  debug,
  decalMaterialMode,
  renderEngine,
  scanRequest,
  onDepthScanResult,
  onDebugInfoChange,
}) => {
  const texture = useLoader(THREE.TextureLoader, tattooTextureUrl);
  const [targetMesh, setTargetMesh] = useState<THREE.Mesh | null>(null);
  const [bodyMeshes, setBodyMeshes] = useState<THREE.Mesh[]>([]);
  const [objDebug, setObjDebug] = useState<ObjBodyPartDebugInfo | null>(null);

  const defaultUnitsPerCm = useMemo(
    () => getDefaultUnitsPerCm(model.calibration),
    [model.calibration]
  );

  const unitsPerCm = useMemo(
    () =>
      resolveUnitsPerCm(
        model.calibration,
        savedCalibration,
        model.hasTemporaryCalibrationFallback
      ),
    [model.calibration, model.hasTemporaryCalibrationFallback, savedCalibration]
  );

  const calibrationSource = savedCalibration
    ? 'saved_anatomical'
    : model.hasTemporaryCalibrationFallback
      ? 'temporary_whole_model_length'
      : 'uncalibrated';

  const tattooLongEdgeUnits = useMemo(
    () => cmToSceneUnits(tattooLongEdgeCm, model.calibration, unitsPerCm),
    [model.calibration, tattooLongEdgeCm, unitsPerCm]
  );

  const textureWidth = texture.image?.width ?? 1;
  const textureHeight = texture.image?.height ?? 1;
  const textureAspectRatio = textureWidth / textureHeight;

  const decalSize = useMemo<Vec3>(() => {
    const imageW = texture.image?.width ?? 1;
    const imageH = texture.image?.height ?? 1;
    const aspect = imageW / imageH;
    if (!Number.isFinite(aspect) || aspect <= 0) {
      return [tattooLongEdgeUnits, tattooLongEdgeUnits, placement.depth];
    }
    if (imageW >= imageH) {
      return [tattooLongEdgeUnits, tattooLongEdgeUnits / aspect, placement.depth];
    }
    return [tattooLongEdgeUnits * aspect, tattooLongEdgeUnits, placement.depth];
  }, [placement.depth, tattooLongEdgeUnits, texture.image?.height, texture.image?.width]);

  const scaledDecalSize = useMemo<Vec3>(
    () => [
      decalSize[0] * placement.scaleMultiplier,
      decalSize[1] * placement.scaleMultiplier,
      decalSize[2],
    ],
    [decalSize, placement.scaleMultiplier]
  );

  const decalGeometryStats = useMemo(
    () =>
      analyzeDecalGeometry(
        targetMesh,
        placement.position,
        placement.rotation,
        scaledDecalSize
      ),
    [placement.position, placement.rotation, scaledDecalSize, targetMesh]
  );

  const cameraFit = useMemo<CameraFit>(() => {
    const radius = objDebug?.centeredBoundingSphereRadius ?? 280;
    const center = objDebug?.centeredBoundingBoxCenter ?? [0, 0, 0];
    const safeRadius = Math.max(radius, 1);
    const cam = model.camera;
    const distance = safeRadius * cam.distanceMultiplier;
    const near = Math.max(0.1, safeRadius * 0.01);
    const far = Math.max(5000, safeRadius * 18);
    const minDistance = safeRadius * cam.minDistanceMultiplier;
    const maxDistance = safeRadius * cam.maxDistanceMultiplier;
    return {
      target: center,
      position: [center[0], center[1], center[2] + distance],
      distance,
      near,
      far,
      minDistance,
      maxDistance,
    };
  }, [model.camera, objDebug]);

  useEffect(() => {
    if (!scanRequest || !targetMesh) return;
    const entries: DepthScanEntry[] = scanRequest.depths.map((depth) => {
      const stats = analyzeDecalGeometry(targetMesh, placement.position, placement.rotation, [
        scaledDecalSize[0],
        scaledDecalSize[1],
        depth,
      ]);
      return {
        depth,
        vertexCount: stats.vertexCount,
      };
    });
    const first = entries.find((item) => item.vertexCount > 0);
    onDepthScanResult({
      kind: scanRequest.kind,
      entries,
      firstIntersectionDepth: first?.depth ?? null,
    });
  }, [
    onDepthScanResult,
    placement.position,
    placement.rotation,
    scaledDecalSize,
    scanRequest,
    targetMesh,
  ]);

  useEffect(() => {
    onDebugInfoChange({
      selectedPresetId,
      resolvedPlacementId: placement.id,
      placementId: placement.id,
      placementRotation: placement.rotation,
      placementPosition: placement.position,
      decalSize: scaledDecalSize,
      tattooLongEdgeCm,
      unitsPerCm,
      defaultUnitsPerCm,
      calibrationSource,
      tattooLongEdgeUnits,
      tattooWidthUnits: scaledDecalSize[0],
      tattooHeightUnits: scaledDecalSize[1],
      textureWidth,
      textureHeight,
      textureAspectRatio,
      referenceLabel: savedCalibration?.referenceLabel ?? model.calibration.referenceLabel,
      calibrationMode: calibrationSource,
      realReferenceLengthCm:
        savedCalibration?.realDistanceCm ?? model.calibration.realReferenceLengthCm,
      sceneReferenceLengthUnits:
        savedCalibration?.sceneDistanceUnits ?? model.calibration.sceneReferenceLengthUnits,
      rawBoundingBoxMin: objDebug?.rawBoundingBoxMin ?? [0, 0, 0],
      rawBoundingBoxMax: objDebug?.rawBoundingBoxMax ?? [0, 0, 0],
      rawBoundingBoxSize: objDebug?.rawBoundingBoxSize ?? [0, 0, 0],
      rawBoundingBoxCenter: objDebug?.rawBoundingBoxCenter ?? [0, 0, 0],
      centeredBoundingBoxMin: objDebug?.centeredBoundingBoxMin ?? [0, 0, 0],
      centeredBoundingBoxMax: objDebug?.centeredBoundingBoxMax ?? [0, 0, 0],
      centeredBoundingBoxSize: objDebug?.centeredBoundingBoxSize ?? [0, 0, 0],
      centeredBoundingBoxCenter: objDebug?.centeredBoundingBoxCenter ?? [0, 0, 0],
      centeredBoundingSphereRadius: objDebug?.centeredBoundingSphereRadius ?? 0,
      centeringOffset: objDebug?.centeringOffset ?? [0, 0, 0],
      meshList: objDebug?.meshList ?? [],
      targetMeshName: objDebug?.targetMeshName ?? null,
      targetMeshUUID: objDebug?.targetMeshUUID ?? null,
      targetMeshVertexCount: objDebug?.targetMeshVertexCount ?? 0,
      targetMeshTriangleCount: objDebug?.targetMeshTriangleCount ?? 0,
      renderedMeshName: objDebug?.renderedMeshName ?? null,
      renderedMeshUUID: objDebug?.renderedMeshUUID ?? null,
      totalVertices: objDebug?.totalVertices ?? 0,
      totalTriangles: objDebug?.totalTriangles ?? 0,
      cameraDistance: cameraFit.distance,
      cameraNear: cameraFit.near,
      cameraFar: cameraFit.far,
      controlMinDistance: cameraFit.minDistance,
      controlMaxDistance: cameraFit.maxDistance,
      matrixWorldUpdated: decalGeometryStats.matrixWorldUpdated,
      decalVertexCount: decalGeometryStats.vertexCount,
      decalIndexCount: decalGeometryStats.indexCount,
      decalBoundingBoxMin: decalGeometryStats.bboxMin,
      decalBoundingBoxMax: decalGeometryStats.bboxMax,
      decalBoundingBoxSize: decalGeometryStats.bboxSize,
      minimumIntersectDepth:
        decalGeometryStats.vertexCount > 0 ? scaledDecalSize[2] : null,
      diagnosticInput: {
        targetMeshName: objDebug?.targetMeshName ?? null,
        targetMeshUUID: objDebug?.targetMeshUUID ?? null,
        position: placement.position,
        rotation: placement.rotation,
        size: scaledDecalSize,
      },
      renderInput: {
        targetMeshName: objDebug?.targetMeshName ?? null,
        targetMeshUUID: objDebug?.targetMeshUUID ?? null,
        position: placement.position,
        rotation: placement.rotation,
        size: scaledDecalSize,
      },
    });
  }, [
    cameraFit.distance,
    cameraFit.far,
    cameraFit.maxDistance,
    cameraFit.minDistance,
    cameraFit.near,
    decalGeometryStats.bboxMax,
    decalGeometryStats.bboxMin,
    decalGeometryStats.bboxSize,
    decalGeometryStats.indexCount,
    decalGeometryStats.matrixWorldUpdated,
    decalGeometryStats.vertexCount,
    model.calibration.referenceLabel,
    model.calibration.realReferenceLengthCm,
    model.calibration.sceneReferenceLengthUnits,
    calibrationSource,
    defaultUnitsPerCm,
    savedCalibration,
    objDebug,
    onDebugInfoChange,
    placement.id,
    placement.position,
    placement.rotation,
    placement.scaleMultiplier,
    scaledDecalSize,
    textureAspectRatio,
    textureHeight,
    textureWidth,
    tattooLongEdgeCm,
    tattooLongEdgeUnits,
    unitsPerCm,
    selectedPresetId,
  ]);

  // 注意：Decal 在尖角或高曲率區域可能出現拉伸/失真。
  // 本功能採固定 placement，正式版應由管理端人工挑選可投影區域，不在 Phase 1 嘗試自動修正曲面失真。
  return (
    <>
      <ambientLight intensity={0.8} />
      <hemisphereLight intensity={0.65} groundColor="#554433" />
      <directionalLight position={[4, 5, 3]} intensity={0.9} />

      <ObjBodyPart
        model={model}
        onTargetMeshReady={setTargetMesh}
        onBodyMeshesReady={setBodyMeshes}
        onDebugInfoChange={setObjDebug}
      />

      <CalibrationPointPicker
        active={calibrationModeActive}
        pickTarget={calibrationPickTarget}
        pointA={calibrationPointA}
        pointB={calibrationPointB}
        bodyMeshes={bodyMeshes}
        onPointPicked={onCalibrationPointPicked}
      />

      {renderEngine === 'drei_decal' ? (
        <TattooDecal
          targetMesh={targetMesh}
          texture={texture}
          position={placement.position}
          rotation={placement.rotation}
          size={scaledDecalSize}
          debug={debug}
          materialMode={decalMaterialMode}
        />
      ) : (
        <RawDecalGeometryMesh
          targetMesh={targetMesh}
          texture={texture}
          position={placement.position}
          rotation={placement.rotation}
          size={scaledDecalSize}
          materialMode={decalMaterialMode}
        />
      )}

      <SceneControls
        cameraFit={cameraFit}
        fov={model.camera.fov}
        previewMode={previewMode}
        displayConfig={displayConfig}
        resetFrontRequestId={resetFrontRequestId}
        captureCameraRequestId={captureCameraRequestId}
        onCameraCaptured={onCameraCaptured}
      />
    </>
  );
};

const Tattoo3DViewer: React.FC<Tattoo3DViewerProps> = (props) => {
  const [loadError, setLoadError] = useState<string | null>(null);

  return (
    <div className="h-full min-h-[420px] rounded-xl border border-white/10 overflow-hidden bg-black">
      <ViewerErrorBoundary
        onError={(error) => {
          console.error('Tattoo3D viewer load failed:', error);
          setLoadError('3D模型載入失敗');
        }}
      >
        {loadError ? (
          <div className="h-full w-full flex items-center justify-center text-red-300 bg-black/40">
            {loadError}
          </div>
        ) : (
          <Canvas
            dpr={[1, 1.5]}
            frameloop="demand"
          >
            <Suspense
              fallback={
                <Html center>
                  <div className="px-4 py-2 rounded bg-black/80 text-white text-sm border border-white/10">
                    正在載入3D模型…
                  </div>
                </Html>
              }
            >
              <Tattoo3DScene {...props} />
            </Suspense>
          </Canvas>
        )}
      </ViewerErrorBoundary>
    </div>
  );
};

export default Tattoo3DViewer;
