import React from 'react';

export interface FilterChipOption {
  value: string;
  label: string;
  selected: boolean;
}

export interface FilterChipGroup {
  key: string;
  label: string;
  options: FilterChipOption[];
  /** 沒有選項時顯示的提示；未提供則整組隱藏 */
  emptyText?: string;
}

interface Props {
  groups: FilterChipGroup[];
  /** 點選即套用 */
  onToggle: (groupKey: string, value: string) => void;
  onClear: () => void;
  onDone: () => void;
  hasSelection: boolean;
  resultCount: number;
  isLoading?: boolean;
}

/**
 * 分類／篩選共用的膠囊選項面板：點選後立即套用，不需再按確認。
 * 底部「完成」只負責收起面板，並顯示目前結果件數。
 */
const FilterChipPanel: React.FC<Props> = ({
  groups,
  onToggle,
  onClear,
  onDone,
  hasSelection,
  resultCount,
  isLoading = false,
}) => (
  <div className="space-y-5" onClick={(e) => e.stopPropagation()}>
    {groups.map((group) => {
      if (group.options.length === 0 && !group.emptyText) return null;
      return (
        <div key={group.key}>
          <p className="text-sm font-semibold text-white mb-2">{group.label}</p>
          {group.options.length === 0 ? (
            <p className="text-xs text-gray-500">{group.emptyText}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {group.options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={option.selected}
                  onClick={() => onToggle(group.key, option.value)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                    option.selected
                      ? 'bg-primary text-black border-primary font-semibold'
                      : 'bg-dark border-white/10 text-gray-300 hover:border-white/20'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    })}

    <div className="flex items-center gap-2 pt-3 border-t border-white/10">
      <button
        type="button"
        onClick={onClear}
        disabled={!hasSelection}
        className="px-3 py-2 rounded-lg text-sm border border-gray-700 text-gray-300 hover:text-white disabled:opacity-40"
      >
        清除條件
      </button>
      <button
        type="button"
        onClick={onDone}
        className="flex-1 px-3 py-2 rounded-lg text-sm bg-primary text-black font-bold hover:bg-primary/90"
      >
        {isLoading ? '更新中…' : `完成・共 ${resultCount} 件`}
      </button>
    </div>
  </div>
);

export default FilterChipPanel;
