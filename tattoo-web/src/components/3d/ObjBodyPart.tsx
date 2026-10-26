import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { Tattoo3DModelConfig, Vec3 } from '../../config/tattoo3dPrototype';

export interface MeshDebugItem {
  name: string;
  vertexCount: number;
  triangleCount: number;
}

export interface ObjBodyPartDebugInfo {
  rawBoundingBoxMin: Vec3;
  rawBoundingBoxMax: Vec3;
  rawBoundingBoxSize: Vec3;
  rawBoundingBoxCenter: Vec3;
  centeredBoundingBoxMin: Vec3;
  centeredBoundingBoxMax: Vec3;
  centeredBoundingBoxSize: Vec3;
  centeredBoundingBoxCenter: Vec3;
  centeredBoundingSphereRadius: number;
  meshList: MeshDebugItem[];
  targetMeshName: string | null;
  targetMeshUUID: string | null;
  targetMeshVertexCount: number;
  targetMeshTriangleCount: number;
  renderedMeshName: string | null;
  renderedMeshUUID: string | null;
  totalVertices: number;
  totalTriangles: number;
  centeringOffset: Vec3;
}

interface ObjBodyPartProps {
  model: Tattoo3DModelConfig;
  onTargetMeshReady: (mesh: THREE.Mesh | null) => void;
  onBodyMeshesReady?: (meshes: THREE.Mesh[]) => void;
  onDebugInfoChange: (info: ObjBodyPartDebugInfo) => void;
}

const NEUTRAL_BODY_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#d6c0aa',
  roughness: 0.88,
  metalness: 0.03,
});

const findDecalTargetMesh = (
  meshes: THREE.Mesh[],
  meshList: MeshDebugItem[],
  targetMeshName?: string
): THREE.Mesh | null => {
  if (meshes.length === 0) return null;
  const normalizedTargetName = targetMeshName?.trim().toLowerCase();
  if (normalizedTargetName) {
    const matched = meshes.find(
      (mesh) => mesh.name.trim().toLowerCase() === normalizedTargetName
    );
    if (matched) return matched;
  }
  let bestIndex = 0;
  let bestTriangles = meshList[0]?.triangleCount ?? -1;
  let bestVertices = meshList[0]?.vertexCount ?? -1;
  for (let i = 1; i < meshList.length; i += 1) {
    const row = meshList[i];
    if (row.triangleCount > bestTriangles) {
      bestIndex = i;
      bestTriangles = row.triangleCount;
      bestVertices = row.vertexCount;
      continue;
    }
    if (row.triangleCount === bestTriangles && row.vertexCount > bestVertices) {
      bestIndex = i;
      bestVertices = row.vertexCount;
    }
  }
  return meshes[bestIndex] ?? meshes[0];
};

const ObjBodyPart: React.FC<ObjBodyPartProps> = ({
  model,
  onTargetMeshReady,
  onBodyMeshesReady,
  onDebugInfoChange,
}) => {
  const obj = useLoader(OBJLoader, model.assetUrl);

  const preparedObject = useMemo(() => {
    const clone = obj.clone(true);
    const meshItems: THREE.Mesh[] = [];
    const meshList: MeshDebugItem[] = [];
    let totalVertices = 0;
    let totalTriangles = 0;

    clone.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      if (!node.geometry) return;

      meshItems.push(node);
      node.material = NEUTRAL_BODY_MATERIAL;
      node.castShadow = false;
      node.receiveShadow = false;
      node.frustumCulled = true;

      const vertexCount =
        node.geometry.attributes?.position?.count &&
        Number.isFinite(node.geometry.attributes.position.count)
          ? Number(node.geometry.attributes.position.count)
          : 0;
      const triangleCount = node.geometry.index
        ? Math.floor(node.geometry.index.count / 3)
        : Math.floor(vertexCount / 3);

      totalVertices += vertexCount;
      totalTriangles += triangleCount;

      meshList.push({
        name: node.name || '(unnamed)',
        vertexCount,
        triangleCount,
      });
    });

    const targetMesh = findDecalTargetMesh(
      meshItems,
      meshList,
      model.targetMeshName
    );
    const targetMeshName = targetMesh?.name || null;
    const targetMeshUUID = targetMesh?.uuid ?? null;

    const rawBox = new THREE.Box3().setFromObject(clone);
    const rawMin = rawBox.min.clone();
    const rawMax = rawBox.max.clone();
    const rawSize = new THREE.Vector3();
    rawBox.getSize(rawSize);
    const rawCenter = new THREE.Vector3();
    rawBox.getCenter(rawCenter);

    const centeringOffset = model.autoCenter
      ? rawCenter.clone().multiplyScalar(-1)
      : new THREE.Vector3(0, 0, 0);
    clone.position.add(centeringOffset);

    const centeredBox = new THREE.Box3().setFromObject(clone);
    const centeredMin = centeredBox.min.clone();
    const centeredMax = centeredBox.max.clone();
    const centeredSize = new THREE.Vector3();
    centeredBox.getSize(centeredSize);
    const centeredCenter = new THREE.Vector3();
    centeredBox.getCenter(centeredCenter);
    const centeredSphere = new THREE.Sphere();
    centeredBox.getBoundingSphere(centeredSphere);

    const targetMeshMetric = targetMesh
      ? meshList.find((item) => item.name === (targetMesh.name || '(unnamed)'))
      : null;

    return {
      clone,
      targetMesh,
      meshItems,
      debugInfo: {
        rawBoundingBoxMin: [rawMin.x, rawMin.y, rawMin.z] as Vec3,
        rawBoundingBoxMax: [rawMax.x, rawMax.y, rawMax.z] as Vec3,
        rawBoundingBoxSize: [rawSize.x, rawSize.y, rawSize.z] as Vec3,
        rawBoundingBoxCenter: [rawCenter.x, rawCenter.y, rawCenter.z] as Vec3,
        centeredBoundingBoxMin: [centeredMin.x, centeredMin.y, centeredMin.z] as Vec3,
        centeredBoundingBoxMax: [centeredMax.x, centeredMax.y, centeredMax.z] as Vec3,
        centeredBoundingBoxSize: [centeredSize.x, centeredSize.y, centeredSize.z] as Vec3,
        centeredBoundingBoxCenter: [centeredCenter.x, centeredCenter.y, centeredCenter.z] as Vec3,
        centeredBoundingSphereRadius: centeredSphere.radius,
        meshList,
        targetMeshName,
        targetMeshUUID,
        targetMeshVertexCount: targetMeshMetric?.vertexCount ?? 0,
        targetMeshTriangleCount: targetMeshMetric?.triangleCount ?? 0,
        renderedMeshName: targetMeshName,
        renderedMeshUUID: targetMeshUUID,
        totalVertices,
        totalTriangles,
        centeringOffset: [
          centeringOffset.x,
          centeringOffset.y,
          centeringOffset.z,
        ] as Vec3,
      },
    };
  }, [model.autoCenter, model.targetMeshName, obj]);

  useEffect(() => {
    onTargetMeshReady(preparedObject.targetMesh);
    onBodyMeshesReady?.(preparedObject.meshItems);
    onDebugInfoChange(preparedObject.debugInfo);
  }, [onBodyMeshesReady, onDebugInfoChange, onTargetMeshReady, preparedObject]);

  useEffect(() => {
    const root = preparedObject.clone;
    return () => {
      root.traverse((node) => {
        if (node instanceof THREE.Mesh && node.geometry) {
          node.geometry.dispose();
        }
      });
    };
  }, [preparedObject]);

  return (
    <group
      position={[
        model.modelPosition[0] + model.displayPosition[0],
        model.modelPosition[1] + model.displayPosition[1],
        model.modelPosition[2] + model.displayPosition[2],
      ]}
      rotation={[
        model.modelRotation[0] + model.displayRotation[0],
        model.modelRotation[1] + model.displayRotation[1],
        model.modelRotation[2] + model.displayRotation[2],
      ]}
      scale={model.modelScale}
    >
      <primitive object={preparedObject.clone} />
    </group>
  );
};

export default ObjBodyPart;
