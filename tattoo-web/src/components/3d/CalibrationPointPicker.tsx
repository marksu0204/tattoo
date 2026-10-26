import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { Vec3 } from '../../config/tattoo3dPrototype';

interface CalibrationPointPickerProps {
  active: boolean;
  pickTarget: 'A' | 'B' | null;
  pointA: Vec3 | null;
  pointB: Vec3 | null;
  bodyMeshes: THREE.Mesh[];
  onPointPicked: (point: Vec3) => void;
}

const CalibrationMarker: React.FC<{
  position: Vec3;
  label: string;
  color: string;
}> = ({ position, label, color }) => (
  <group position={position}>
    <mesh renderOrder={10}>
      <sphereGeometry args={[4, 16, 16]} />
      <meshBasicMaterial color={color} depthTest={false} transparent opacity={0.95} />
    </mesh>
    <Html
      center
      distanceFactor={12}
      style={{
        pointerEvents: 'none',
        userSelect: 'none',
        padding: '2px 6px',
        borderRadius: '4px',
        background: 'rgba(0,0,0,0.75)',
        color: '#fff',
        fontSize: '12px',
        fontWeight: 700,
        border: `1px solid ${color}`,
      }}
    >
      {label}
    </Html>
  </group>
);

const CalibrationPointPicker: React.FC<CalibrationPointPickerProps> = ({
  active,
  pickTarget,
  pointA,
  pointB,
  bodyMeshes,
  onPointPicked,
}) => {
  const { camera, gl } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const pointer = useMemo(() => new THREE.Vector2(), []);

  useEffect(() => {
    if (!active || !pickTarget || bodyMeshes.length === 0) return;

    const handleClick = (event: MouseEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(bodyMeshes, false);
      if (hits.length === 0) return;
      const hitPoint = hits[0].point;
      onPointPicked([hitPoint.x, hitPoint.y, hitPoint.z]);
    };

    gl.domElement.addEventListener('click', handleClick);
    return () => {
      gl.domElement.removeEventListener('click', handleClick);
    };
  }, [active, bodyMeshes, camera, gl.domElement, onPointPicked, pickTarget, pointer, raycaster]);

  if (!active) return null;

  return (
    <>
      {pointA ? <CalibrationMarker position={pointA} label="A" color="#22c55e" /> : null}
      {pointB ? <CalibrationMarker position={pointB} label="B" color="#3b82f6" /> : null}
    </>
  );
};

export default CalibrationPointPicker;
