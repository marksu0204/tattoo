import React from 'react';
import * as THREE from 'three';
import { Decal } from '@react-three/drei';
import { Vec3 } from '../../config/tattoo3dPrototype';

interface TattooDecalProps {
  targetMesh: THREE.Mesh | null;
  texture: THREE.Texture;
  position: Vec3;
  rotation: Vec3;
  size: Vec3;
  debug: boolean;
  materialMode: 'texture' | 'solid_red';
}

const TattooDecal: React.FC<TattooDecalProps> = ({
  targetMesh,
  texture,
  position,
  rotation,
  size,
  debug,
  materialMode,
}) => {
  if (!targetMesh) return null;

  // TODO(Phase 2+): 若作品透明邊界很大，應改用 alpha content bounds 或後端裁切圖作為尺寸基準。
  // 目前 Prototype 先使用整張圖片長寬比來驗證 cm -> scene units 與固定 placement 可行性。
  return (
    <Decal
      mesh={{ current: targetMesh }}
      debug={debug}
      position={position}
      rotation={rotation}
      scale={size}
    >
      {materialMode === 'solid_red' ? (
        <meshBasicMaterial
          color="#ff1f1f"
          transparent
          opacity={1}
          side={THREE.DoubleSide}
          depthTest
          polygonOffset
          polygonOffsetFactor={-1}
        />
      ) : (
        <meshStandardMaterial
          map={texture}
          transparent
          alphaTest={0.01}
          depthTest
          polygonOffset
          polygonOffsetFactor={-1}
          side={THREE.DoubleSide}
        />
      )}
    </Decal>
  );
};

export default TattooDecal;
