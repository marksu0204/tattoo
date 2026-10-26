import React, { useMemo } from 'react';
import { DepthScanResult, Tattoo3DDebugInfo } from './Tattoo3DViewer';
import type { Vec3 } from '../../config/tattoo3dPrototype';
import type { SavedAnatomicalCalibration } from '../../config/tattoo3dCalibrationStorage';
import type { Tattoo3DModelDisplayConfig } from '../../config/tattoo3dDisplayStorage';

interface DraftPlacement {
  id: string;
  label: string;
  position: Vec3;
  rotationDeg: Vec3;
  scaleMultiplier: number;
  depth: number;
}

interface Tattoo3DDebugPanelProps {
  debugInfo: Tattoo3DDebugInfo | null;
  selectedPresetId: string;
  draftPlacement: DraftPlacement | null;
  onDraftPlacementChange: (patch: Partial<DraftPlacement>) => void;
  onCopyCurrentPreset: () => void;
  onSaveCurrentPreset: () => void;
  onResetCurrentPreset: () => void;
  onExportAllPresets: () => void;
  panelMessage: string;
  lastSavedAt: string | null;
  decalMaterialMode: 'texture' | 'solid_red';
  onDecalMaterialModeChange: (mode: 'texture' | 'solid_red') => void;
  onRunDepthScan: () => void;
  onRunFineScan: () => void;
  broadScanResult: DepthScanResult | null;
  fineScanResult: DepthScanResult | null;
  calibrationModeActive: boolean;
  calibrationPickTarget: 'A' | 'B' | null;
  calibrationPointA: Vec3 | null;
  calibrationPointB: Vec3 | null;
  calibrationReferenceLabel: string;
  calibrationRealDistanceCm: number;
  calibrationSceneDistanceUnits: number;
  calibrationDraftUnitsPerCm: number;
  defaultUnitsPerCm: number;
  savedModelCalibration: SavedAnatomicalCalibration | null;
  calibrationStatusLabel: string;
  hasTemporaryCalibrationFallback: boolean;
  calibrationMessage: string;
  onStartCalibrationMode: () => void;
  onStopCalibrationMode: () => void;
  onCalibrationReferenceLabelChange: (value: string) => void;
  onCalibrationRealDistanceCmChange: (value: number) => void;
  onRepickCalibrationPointA: () => void;
  onRepickCalibrationPointB: () => void;
  onSaveModelCalibration: () => void;
  onClearModelCalibration: () => void;
  onRestoreTemporaryCalibration: () => void;
  draftDisplay: Tattoo3DModelDisplayConfig | null;
  onDraftDisplayChange: (patch: Partial<Tattoo3DModelDisplayConfig>) => void;
  onSetPoseAsDefault: () => void;
  onSetViewAsFront: () => void;
  onSaveDisplayConfig: () => void;
  onResetDisplayConfig: () => void;
  displayMessage: string;
}

const formatNumber = (value: number): string => {
  if (!Number.isFinite(value)) return '0';
  return value.toFixed(4);
};

const formatDateTime = (isoTime: string | null): string => {
  if (!isoTime) return '尚未儲存';
  const date = new Date(isoTime);
  if (Number.isNaN(date.getTime())) return '尚未儲存';
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const AxisEditor: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}> = ({ label, value, min, max, step, onChange }) => {
  return (
    <div className="grid grid-cols-[56px_minmax(0,1fr)_90px] items-center gap-2">
      <span className="text-gray-300">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-black/30 border border-white/15 rounded px-2 py-1 text-gray-200"
      />
    </div>
  );
};

const Tattoo3DDebugPanel: React.FC<Tattoo3DDebugPanelProps> = ({
  debugInfo,
  selectedPresetId,
  draftPlacement,
  onDraftPlacementChange,
  onCopyCurrentPreset,
  onSaveCurrentPreset,
  onResetCurrentPreset,
  onExportAllPresets,
  panelMessage,
  lastSavedAt,
  decalMaterialMode,
  onDecalMaterialModeChange,
  onRunDepthScan,
  onRunFineScan,
  broadScanResult,
  fineScanResult,
  calibrationModeActive,
  calibrationPickTarget,
  calibrationPointA,
  calibrationPointB,
  calibrationReferenceLabel,
  calibrationRealDistanceCm,
  calibrationSceneDistanceUnits,
  calibrationDraftUnitsPerCm,
  defaultUnitsPerCm,
  savedModelCalibration,
  calibrationStatusLabel,
  hasTemporaryCalibrationFallback,
  calibrationMessage,
  onStartCalibrationMode,
  onStopCalibrationMode,
  onCalibrationReferenceLabelChange,
  onCalibrationRealDistanceCmChange,
  onRepickCalibrationPointA,
  onRepickCalibrationPointB,
  onSaveModelCalibration,
  onClearModelCalibration,
  onRestoreTemporaryCalibration,
  draftDisplay,
  onDraftDisplayChange,
  onSetPoseAsDefault,
  onSetViewAsFront,
  onSaveDisplayConfig,
  onResetDisplayConfig,
  displayMessage,
}) => {
  const placementJson = useMemo(() => {
    if (!draftPlacement) return '';
    return JSON.stringify(draftPlacement, null, 2);
  }, [draftPlacement]);

  if (!draftPlacement) {
    return (
      <section className="bg-card border border-white/10 rounded-xl p-4">
        <p className="text-sm text-gray-400">尚未選擇 Placement。</p>
      </section>
    );
  }

  return (
    <section className="bg-card border border-white/10 rounded-xl p-4 space-y-4">
      <h3 className="text-base font-semibold text-white">Developer Calibration Controls</h3>

      <div className="rounded border border-violet-500/30 bg-violet-950/20 p-3 space-y-3 text-xs">
        <p className="text-sm font-medium text-violet-100">Model Display Setup</p>
        <p className="text-gray-400">
          調整模型顯示姿勢與預設視角（不修改 OBJ）。以 modelId 存入 localStorage。
        </p>
        {draftDisplay ? (
          <>
            <div className="space-y-2">
              <p className="text-gray-300">Display Rotation（Deg）</p>
              <AxisEditor
                label="Rot X"
                value={draftDisplay.displayRotationDeg[0]}
                min={-180}
                max={180}
                step={1}
                onChange={(value) =>
                  onDraftDisplayChange({
                    displayRotationDeg: [
                      value,
                      draftDisplay.displayRotationDeg[1],
                      draftDisplay.displayRotationDeg[2],
                    ],
                  })
                }
              />
              <AxisEditor
                label="Rot Y"
                value={draftDisplay.displayRotationDeg[1]}
                min={-180}
                max={180}
                step={1}
                onChange={(value) =>
                  onDraftDisplayChange({
                    displayRotationDeg: [
                      draftDisplay.displayRotationDeg[0],
                      value,
                      draftDisplay.displayRotationDeg[2],
                    ],
                  })
                }
              />
              <AxisEditor
                label="Rot Z"
                value={draftDisplay.displayRotationDeg[2]}
                min={-180}
                max={180}
                step={1}
                onChange={(value) =>
                  onDraftDisplayChange({
                    displayRotationDeg: [
                      draftDisplay.displayRotationDeg[0],
                      draftDisplay.displayRotationDeg[1],
                      value,
                    ],
                  })
                }
              />
            </div>
            <div className="rounded border border-white/10 bg-black/30 p-2 space-y-1 text-gray-200">
              <p>
                Default Camera Pos：[
                {draftDisplay.defaultCameraPosition.map((v) => formatNumber(v)).join(', ')}]
              </p>
              <p>
                Default Camera Target：[
                {draftDisplay.defaultCameraTarget.map((v) => formatNumber(v)).join(', ')}]
              </p>
              <p>Front Azimuth：{formatNumber(draftDisplay.frontAzimuth)} rad</p>
              <p>Front Polar：{formatNumber(draftDisplay.frontPolar)} rad</p>
              <p>
                Customer Zoom：{formatNumber(draftDisplay.customerMinDistance)} –{' '}
                {formatNumber(draftDisplay.customerMaxDistance)}
              </p>
              <p>Last Saved：{formatDateTime(draftDisplay.savedAt || null)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onSetPoseAsDefault}
                className="px-2 py-1 rounded border border-violet-500/50 bg-violet-900/30 text-violet-100"
              >
                將目前姿勢設為預設
              </button>
              <button
                type="button"
                onClick={onSetViewAsFront}
                className="px-2 py-1 rounded border border-violet-500/50 bg-violet-900/30 text-violet-100"
              >
                將目前視角設為正面
              </button>
              <button
                type="button"
                onClick={onSaveDisplayConfig}
                className="px-2 py-1 rounded border border-emerald-500/50 bg-emerald-900/30 text-emerald-100"
              >
                儲存模型顯示設定
              </button>
              <button
                type="button"
                onClick={onResetDisplayConfig}
                className="px-2 py-1 rounded border border-white/20 bg-black/30 text-gray-200"
              >
                恢復預設
              </button>
            </div>
            {displayMessage ? <p className="text-emerald-300">{displayMessage}</p> : null}
          </>
        ) : (
          <p className="text-gray-400">載入模型後可設定 Display Config。</p>
        )}
      </div>

      <div className="rounded border border-cyan-500/30 bg-cyan-950/20 p-3 space-y-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-cyan-100">人體尺寸校正模式</p>
          <span className="text-gray-300">
            Calibration：{calibrationStatusLabel}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {!calibrationModeActive ? (
            <button
              type="button"
              onClick={onStartCalibrationMode}
              className="px-2 py-1 rounded border border-cyan-500/50 bg-cyan-900/30 text-cyan-100"
            >
              開始尺寸校正
            </button>
          ) : (
            <button
              type="button"
              onClick={onStopCalibrationMode}
              className="px-2 py-1 rounded border border-white/15 bg-black/30 text-gray-200"
            >
              結束尺寸校正
            </button>
          )}
          <button
            type="button"
            onClick={onRepickCalibrationPointA}
            disabled={!calibrationModeActive}
            className="px-2 py-1 rounded border border-white/15 bg-black/30 disabled:opacity-40"
          >
            重選 A
          </button>
          <button
            type="button"
            onClick={onRepickCalibrationPointB}
            disabled={!calibrationModeActive}
            className="px-2 py-1 rounded border border-white/15 bg-black/30 disabled:opacity-40"
          >
            重選 B
          </button>
          <button
            type="button"
            onClick={onSaveModelCalibration}
            className="px-2 py-1 rounded border border-emerald-500/50 bg-emerald-900/30 text-emerald-200"
          >
            儲存模型尺寸校正
          </button>
          <button
            type="button"
            onClick={onClearModelCalibration}
            className="px-2 py-1 rounded border border-amber-500/50 bg-amber-900/30 text-amber-200"
          >
            清除校正
          </button>
          <button
            type="button"
            onClick={onRestoreTemporaryCalibration}
            className="px-2 py-1 rounded border border-amber-500/50 bg-amber-900/30 text-amber-200"
          >
            {hasTemporaryCalibrationFallback ? '恢復暫定70cm' : '恢復未校正狀態'}
          </button>
        </div>

        {calibrationModeActive ? (
          <p className="text-cyan-200">
            {calibrationPickTarget === 'A'
              ? '請在 3D 模型表面點選 Point A'
              : calibrationPickTarget === 'B'
                ? '請在 3D 模型表面點選 Point B'
                : 'A/B 已選完，可調整 Reference Label 與 Real Distance Cm'}
          </p>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-gray-300">Reference Label</span>
            <input
              type="text"
              value={calibrationReferenceLabel}
              onChange={(e) => onCalibrationReferenceLabelChange(e.target.value)}
              placeholder="例如：手腕皺褶 → 手肘"
              className="w-full bg-black/30 border border-white/15 rounded px-2 py-1 text-gray-200"
            />
          </label>
          <label className="space-y-1">
            <span className="text-gray-300">Real Distance Cm</span>
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={Number.isFinite(calibrationRealDistanceCm) ? calibrationRealDistanceCm : 0}
              onChange={(e) => onCalibrationRealDistanceCmChange(Number(e.target.value))}
              className="w-full bg-black/30 border border-white/15 rounded px-2 py-1 text-gray-200"
            />
          </label>
        </div>

        <div className="rounded border border-white/10 bg-black/30 p-2 space-y-1 text-gray-200">
          <p>
            Point A：[
            {calibrationPointA ? calibrationPointA.map((v) => formatNumber(v)).join(', ') : 'N/A'}]
          </p>
          <p>
            Point B：[
            {calibrationPointB ? calibrationPointB.map((v) => formatNumber(v)).join(', ') : 'N/A'}]
          </p>
          <p>Scene Distance：{formatNumber(calibrationSceneDistanceUnits)} units</p>
          <p>Real Distance：{formatNumber(calibrationRealDistanceCm)} cm</p>
          <p>unitsPerCm（Draft）：{formatNumber(calibrationDraftUnitsPerCm)}</p>
          <p>
            舊 Calibration（暫定70cm）：{formatNumber(defaultUnitsPerCm)} units/cm
          </p>
          <p>
            新 Calibration（Draft）：{formatNumber(calibrationDraftUnitsPerCm)} units/cm
          </p>
          {savedModelCalibration ? (
            <p>
              已儲存 Calibration：{formatNumber(savedModelCalibration.unitsPerCm)} units/cm（
              {formatDateTime(savedModelCalibration.savedAt)}）
            </p>
          ) : null}
          {calibrationMessage ? <p className="text-emerald-300">{calibrationMessage}</p> : null}
        </div>
      </div>

      <div className="rounded border border-white/10 bg-black/30 p-2 text-xs text-gray-200 space-y-1">
        <p>Last Saved：{formatDateTime(lastSavedAt)}</p>
        {panelMessage ? <p className="text-emerald-300">{panelMessage}</p> : null}
      </div>
      <div className="rounded border border-white/10 bg-black/30 p-2 text-xs text-gray-200 space-y-1">
        <p>Selected Preset ID：{selectedPresetId}</p>
        <p>Resolved Placement ID：{draftPlacement.id}</p>
        <p>
          LIVE RENDER POSITION：[
          {(debugInfo?.renderInput.position ?? [0, 0, 0])
            .map((v) => formatNumber(v))
            .join(', ')}
          ]
        </p>
        <p>
          LIVE RENDER ROTATION（Deg）：[
          {(debugInfo?.renderInput.rotation ?? [0, 0, 0])
            .map((v) => formatNumber((v * 180) / Math.PI))
            .join(', ')}
          ]
        </p>
        <p>
          LIVE RENDER ROTATION（Rad）：[
          {(debugInfo?.renderInput.rotation ?? [0, 0, 0])
            .map((v) => formatNumber(v))
            .join(', ')}
          ]
        </p>
        <p>
          LIVE RENDER DEPTH：
          {formatNumber(debugInfo?.renderInput.size?.[2] ?? 0)}
        </p>
        <p>
          LIVE RENDER SIZE：[
          {(debugInfo?.renderInput.size ?? [0, 0, 0])
            .map((v) => formatNumber(v))
            .join(', ')}
          ]
        </p>
      </div>

      <div className="space-y-2 text-xs">
        <p className="text-gray-300">Decal Material</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onDecalMaterialModeChange('texture')}
            className={`px-3 py-1.5 rounded border ${
              decalMaterialMode === 'texture'
                ? 'bg-primary text-black border-primary'
                : 'bg-black/30 text-gray-200 border-white/15'
            }`}
          >
            Texture
          </button>
          <button
            type="button"
            onClick={() => onDecalMaterialModeChange('solid_red')}
            className={`px-3 py-1.5 rounded border ${
              decalMaterialMode === 'solid_red'
                ? 'bg-primary text-black border-primary'
                : 'bg-black/30 text-gray-200 border-white/15'
            }`}
          >
            Solid Red
          </button>
        </div>
      </div>

      <div className="space-y-2 text-xs">
        <p className="text-gray-300">Position（Centered Scene Coordinates）</p>
        <p className="text-gray-500">X：沿手臂長軸，Y：上下，Z：前後／表面深度方向</p>
        <AxisEditor
          label="Pos X"
          value={draftPlacement.position[0]}
          min={-350}
          max={350}
          step={0.5}
          onChange={(value) =>
            onDraftPlacementChange({
              position: [value, draftPlacement.position[1], draftPlacement.position[2]],
            })
          }
        />
        <div className="flex gap-2">
          {[-10, -1, 1, 10].map((delta) => (
            <button
              key={`x-${delta}`}
              type="button"
              onClick={() =>
                onDraftPlacementChange({
                  position: [
                    draftPlacement.position[0] + delta,
                    draftPlacement.position[1],
                    draftPlacement.position[2],
                  ],
                })
              }
              className="px-2 py-1 rounded border border-white/15 bg-black/30"
            >
              {delta > 0 ? `+${delta}` : `${delta}`}
            </button>
          ))}
        </div>
        <AxisEditor
          label="Pos Y"
          value={draftPlacement.position[1]}
          min={-120}
          max={120}
          step={0.5}
          onChange={(value) =>
            onDraftPlacementChange({
              position: [draftPlacement.position[0], value, draftPlacement.position[2]],
            })
          }
        />
        <div className="flex gap-2">
          {[-10, -1, 1, 10].map((delta) => (
            <button
              key={`y-${delta}`}
              type="button"
              onClick={() =>
                onDraftPlacementChange({
                  position: [
                    draftPlacement.position[0],
                    draftPlacement.position[1] + delta,
                    draftPlacement.position[2],
                  ],
                })
              }
              className="px-2 py-1 rounded border border-white/15 bg-black/30"
            >
              {delta > 0 ? `+${delta}` : `${delta}`}
            </button>
          ))}
        </div>
        <AxisEditor
          label="Pos Z"
          value={draftPlacement.position[2]}
          min={-120}
          max={120}
          step={0.5}
          onChange={(value) =>
            onDraftPlacementChange({
              position: [draftPlacement.position[0], draftPlacement.position[1], value],
            })
          }
        />
        <div className="flex gap-2">
          {[-10, -1, 1, 10].map((delta) => (
            <button
              key={`z-${delta}`}
              type="button"
              onClick={() =>
                onDraftPlacementChange({
                  position: [
                    draftPlacement.position[0],
                    draftPlacement.position[1],
                    draftPlacement.position[2] + delta,
                  ],
                })
              }
              className="px-2 py-1 rounded border border-white/15 bg-black/30"
            >
              {delta > 0 ? `+${delta}` : `${delta}`}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 text-xs">
        <p className="text-gray-300">Rotation（Degree）</p>
        <AxisEditor
          label="Rot X"
          value={draftPlacement.rotationDeg[0]}
          min={-180}
          max={180}
          step={1}
          onChange={(value) =>
            onDraftPlacementChange({
              rotationDeg: [
                value,
                draftPlacement.rotationDeg[1],
                draftPlacement.rotationDeg[2],
              ],
            })
          }
        />
        <div className="flex gap-2">
          {[-90, -15, -5, 5, 15, 90].map((delta) => (
            <button
              key={`rx-${delta}`}
              type="button"
              onClick={() =>
                onDraftPlacementChange({
                  rotationDeg: [
                    draftPlacement.rotationDeg[0] + delta,
                    draftPlacement.rotationDeg[1],
                    draftPlacement.rotationDeg[2],
                  ],
                })
              }
              className="px-2 py-1 rounded border border-white/15 bg-black/30"
            >
              {delta > 0 ? `+${delta}` : `${delta}`}°
            </button>
          ))}
        </div>
        <AxisEditor
          label="Rot Y"
          value={draftPlacement.rotationDeg[1]}
          min={-180}
          max={180}
          step={1}
          onChange={(value) =>
            onDraftPlacementChange({
              rotationDeg: [
                draftPlacement.rotationDeg[0],
                value,
                draftPlacement.rotationDeg[2],
              ],
            })
          }
        />
        <div className="flex gap-2">
          {[-90, -15, -5, 5, 15, 90].map((delta) => (
            <button
              key={`ry-${delta}`}
              type="button"
              onClick={() =>
                onDraftPlacementChange({
                  rotationDeg: [
                    draftPlacement.rotationDeg[0],
                    draftPlacement.rotationDeg[1] + delta,
                    draftPlacement.rotationDeg[2],
                  ],
                })
              }
              className="px-2 py-1 rounded border border-white/15 bg-black/30"
            >
              {delta > 0 ? `+${delta}` : `${delta}`}°
            </button>
          ))}
        </div>
        <AxisEditor
          label="Rot Z"
          value={draftPlacement.rotationDeg[2]}
          min={-180}
          max={180}
          step={1}
          onChange={(value) =>
            onDraftPlacementChange({
              rotationDeg: [
                draftPlacement.rotationDeg[0],
                draftPlacement.rotationDeg[1],
                value,
              ],
            })
          }
        />
        <div className="flex gap-2">
          {[-90, -15, -5, 5, 15, 90].map((delta) => (
            <button
              key={`rz-${delta}`}
              type="button"
              onClick={() =>
                onDraftPlacementChange({
                  rotationDeg: [
                    draftPlacement.rotationDeg[0],
                    draftPlacement.rotationDeg[1],
                    draftPlacement.rotationDeg[2] + delta,
                  ],
                })
              }
              className="px-2 py-1 rounded border border-white/15 bg-black/30"
            >
              {delta > 0 ? `+${delta}` : `${delta}`}°
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 text-xs">
        <p className="text-gray-300">Preset Actions</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onCopyCurrentPreset}
            className="px-2 py-1 rounded border border-white/15 bg-black/30"
          >
            複製目前Preset
          </button>
          <button
            type="button"
            onClick={onSaveCurrentPreset}
            className="px-2 py-1 rounded border border-emerald-500/50 bg-emerald-900/30 text-emerald-200"
          >
            儲存目前Preset
          </button>
          <button
            type="button"
            onClick={onResetCurrentPreset}
            className="px-2 py-1 rounded border border-amber-500/50 bg-amber-900/30 text-amber-200"
          >
            恢復預設值
          </button>
          <button
            type="button"
            onClick={onExportAllPresets}
            className="px-2 py-1 rounded border border-blue-500/50 bg-blue-900/30 text-blue-200"
          >
            匯出所有已校正Preset
          </button>
        </div>
      </div>

      <div className="space-y-2 text-xs">
        <AxisEditor
          label="Scale"
          value={draftPlacement.scaleMultiplier}
          min={0.2}
          max={3}
          step={0.01}
          onChange={(value) => onDraftPlacementChange({ scaleMultiplier: value })}
        />
        <AxisEditor
          label="Depth"
          value={draftPlacement.depth}
          min={1}
          max={120}
          step={0.5}
          onChange={(value) => onDraftPlacementChange({ depth: value })}
        />
      </div>

      <div className="space-y-2 text-xs">
        <p className="text-gray-300">Depth Scan</p>
        <div className="flex gap-2">
          <button type="button" onClick={onRunDepthScan} className="px-3 py-1.5 rounded border border-white/15 bg-black/30">
            Scan Depth
          </button>
          <button type="button" onClick={onRunFineScan} className="px-3 py-1.5 rounded border border-white/15 bg-black/30">
            Fine Scan
          </button>
        </div>
        {broadScanResult && (
          <div className="rounded border border-white/10 bg-black/30 p-2">
            <p className="mb-1 text-gray-300">Broad Scan</p>
            {broadScanResult.entries.map((entry) => (
              <p key={`b-${entry.depth}`}>
                {entry.depth} → {entry.vertexCount}
              </p>
            ))}
            <p className="mt-1 text-emerald-300">
              First Intersection Depth: {broadScanResult.firstIntersectionDepth ?? 'N/A'}
            </p>
          </div>
        )}
        {fineScanResult && (
          <div className="rounded border border-white/10 bg-black/30 p-2">
            <p className="mb-1 text-gray-300">Fine Scan</p>
            {fineScanResult.entries.map((entry) => (
              <p key={`f-${entry.depth}`}>
                {entry.depth} → {entry.vertexCount}
              </p>
            ))}
            <p className="mt-1 text-emerald-300">
              Minimum Intersect Depth: {fineScanResult.firstIntersectionDepth ?? 'N/A'}
            </p>
          </div>
        )}
      </div>

      {debugInfo && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-200 border-t border-white/10 pt-3">
          <div className="space-y-1">
            <p>目前 Placement：{debugInfo.placementId}</p>
            <p>
              Position：[{
                debugInfo.placementPosition.map((v) => formatNumber(v)).join(', ')
              }]
            </p>
            <p>
              Rotation：[{
                debugInfo.placementRotation.map((v) => formatNumber(v)).join(', ')
              }]
            </p>
            <p>
              Rotation Deg：[{
                draftPlacement.rotationDeg.map((v) => formatNumber(v)).join(', ')
              }]
            </p>
            <p>Scale Multiplier：{formatNumber(draftPlacement.scaleMultiplier)}</p>
            <p>Depth：{formatNumber(draftPlacement.depth)}</p>
            <p>Tattoo：{debugInfo.tattooLongEdgeCm} cm</p>
            <p>unitsPerCm：{formatNumber(debugInfo.unitsPerCm)}</p>
            <p>Tattoo Width Units：{formatNumber(debugInfo.tattooWidthUnits)}</p>
            <p>Tattoo Height Units：{formatNumber(debugInfo.tattooHeightUnits)}</p>
            <p>
              Texture：{debugInfo.textureWidth} × {debugInfo.textureHeight}
            </p>
            <p>Aspect Ratio：{formatNumber(debugInfo.textureAspectRatio)}</p>
            <p>
              Rotation Degrees：[
              {debugInfo.placementRotation
                .map((v) => formatNumber((v * 180) / Math.PI))
                .join(', ')}
              ]
            </p>
            <p>Decal Vertex Count：{debugInfo.decalVertexCount}</p>
            <p>Decal Index Count：{debugInfo.decalIndexCount}</p>
            <p>Minimum Intersection Depth：{debugInfo.minimumIntersectDepth ?? 'N/A'}</p>
          </div>
          <div className="space-y-1">
            <p>
              Calibration：{debugInfo.calibrationMode} / {debugInfo.referenceLabel}
            </p>
            <p>
              Reference：{debugInfo.realReferenceLengthCm} cm ={' '}
              {formatNumber(debugInfo.sceneReferenceLengthUnits)} units
            </p>
            <p>
              Raw BBox Size X/Y/Z：[{
                debugInfo.rawBoundingBoxSize.map((v) => formatNumber(v)).join(', ')
              }]
            </p>
            <p>
              Raw BBox Min：[{
                debugInfo.rawBoundingBoxMin.map((v) => formatNumber(v)).join(', ')
              }]
            </p>
            <p>
              Raw BBox Max：[{
                debugInfo.rawBoundingBoxMax.map((v) => formatNumber(v)).join(', ')
              }]
            </p>
            <p>
              Raw Center：[{
                debugInfo.rawBoundingBoxCenter.map((v) => formatNumber(v)).join(', ')
              }]
            </p>
            <p>
              Centered BBox Size X/Y/Z：[{
                debugInfo.centeredBoundingBoxSize.map((v) => formatNumber(v)).join(', ')
              }]
            </p>
            <p>
              Centered Center：[{
                debugInfo.centeredBoundingBoxCenter.map((v) => formatNumber(v)).join(', ')
              }]
            </p>
            <p>
              Centering Offset：[{
                debugInfo.centeringOffset.map((v) => formatNumber(v)).join(', ')
              }]
            </p>
            <p>
              Target Mesh：{debugInfo.targetMeshName ?? '(none)'} / V
              {debugInfo.targetMeshVertexCount} / T{debugInfo.targetMeshTriangleCount}
            </p>
            <p>Target Mesh UUID：{debugInfo.targetMeshUUID ?? 'N/A'}</p>
            <p>Rendered Mesh：{debugInfo.renderedMeshName ?? 'N/A'}</p>
            <p>Rendered Mesh UUID：{debugInfo.renderedMeshUUID ?? 'N/A'}</p>
            <p>
              Total Mesh Data：Vertices {debugInfo.totalVertices} / Triangles{' '}
              {debugInfo.totalTriangles}
            </p>
            <p>matrixWorld updated：{debugInfo.matrixWorldUpdated ? 'YES' : 'NO'}</p>
            <p>
              Diagnostic Input：mesh {debugInfo.diagnosticInput.targetMeshName ?? 'N/A'} /{' '}
              {debugInfo.diagnosticInput.targetMeshUUID ?? 'N/A'}
            </p>
            <p>
              Diagnostic Position：[
              {debugInfo.diagnosticInput.position.map((v) => formatNumber(v)).join(', ')}]
            </p>
            <p>
              Diagnostic Rotation：[
              {debugInfo.diagnosticInput.rotation.map((v) => formatNumber(v)).join(', ')}]
            </p>
            <p>
              Diagnostic Size：[
              {debugInfo.diagnosticInput.size.map((v) => formatNumber(v)).join(', ')}]
            </p>
            <p>
              Render Input：mesh {debugInfo.renderInput.targetMeshName ?? 'N/A'} /{' '}
              {debugInfo.renderInput.targetMeshUUID ?? 'N/A'}
            </p>
            <p>
              Render Position：[
              {debugInfo.renderInput.position.map((v) => formatNumber(v)).join(', ')}]
            </p>
            <p>
              Render Rotation：[
              {debugInfo.renderInput.rotation.map((v) => formatNumber(v)).join(', ')}]
            </p>
            <p>
              Render Size：[
              {debugInfo.renderInput.size.map((v) => formatNumber(v)).join(', ')}]
            </p>
            <p>
              Camera Fit：distance {formatNumber(debugInfo.cameraDistance)} / near{' '}
              {formatNumber(debugInfo.cameraNear)} / far {formatNumber(debugInfo.cameraFar)}
            </p>
            <p>
              Orbit Distance：min {formatNumber(debugInfo.controlMinDistance)} / max{' '}
              {formatNumber(debugInfo.controlMaxDistance)}
            </p>
            <p>
              Decal BBox Min：{debugInfo.decalBoundingBoxMin
                ? `[${debugInfo.decalBoundingBoxMin.map((v) => formatNumber(v)).join(', ')}]`
                : 'N/A'}
            </p>
            <p>
              Decal BBox Max：{debugInfo.decalBoundingBoxMax
                ? `[${debugInfo.decalBoundingBoxMax.map((v) => formatNumber(v)).join(', ')}]`
                : 'N/A'}
            </p>
            <p>
              Decal BBox Size：{debugInfo.decalBoundingBoxSize
                ? `[${debugInfo.decalBoundingBoxSize.map((v) => formatNumber(v)).join(', ')}]`
                : 'N/A'}
            </p>
          </div>
          <div className="md:col-span-2">
            <p className="mb-1 text-gray-300">Mesh 列表（name / vertex / triangle）</p>
            <div className="max-h-32 overflow-auto rounded border border-white/10 bg-black/30 px-2 py-2">
              {debugInfo.meshList.map((mesh, index) => (
                <p key={`${mesh.name}-${index}`} className="text-gray-300">
                  {mesh.name} / {mesh.vertexCount} / {mesh.triangleCount}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      <div>
        <p className="text-xs text-gray-300 mb-1">Copy placement config（手動複製）</p>
        <textarea
          readOnly
          value={placementJson}
          rows={12}
          className="w-full bg-black/30 border border-white/15 rounded p-2 text-xs text-gray-200"
        />
      </div>
    </section>
  );
};

export default Tattoo3DDebugPanel;
