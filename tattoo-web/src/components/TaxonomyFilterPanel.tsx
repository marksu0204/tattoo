import React from 'react';
import type { ArtworkTagGroup, ArtworkTaxonomyTag } from '../types';
import { ARTWORK_TAG_GROUP_LABELS, ARTWORK_TAG_GROUPS, toggleTaxonomyTagId } from '../utils/artworkTaxonomy';

interface TaxonomyFilterPanelProps {
  tagsByGroup: Record<ArtworkTagGroup, ArtworkTaxonomyTag[]>;
  draftTagIds: number[];
  onChange: (next: number[]) => void;
  onClear: () => void;
  onApply: () => void;
  resultCount?: number;
  isLoadingCount?: boolean;
}

const TaxonomyFilterPanel: React.FC<TaxonomyFilterPanelProps> = ({
  tagsByGroup,
  draftTagIds,
  onChange,
  onClear,
  onApply,
  resultCount,
  isLoadingCount = false,
}) => (
  <div className="space-y-5" onClick={(e) => e.stopPropagation()}>
    {ARTWORK_TAG_GROUPS.map((groupKey) => {
      const tags = tagsByGroup[groupKey] ?? [];
      if (tags.length === 0) return null;
      return (
        <div key={groupKey}>
          <p className="text-sm font-semibold text-white mb-2">{ARTWORK_TAG_GROUP_LABELS[groupKey]}</p>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const selected = draftTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => onChange(toggleTaxonomyTagId(draftTagIds, tag.id))}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                    selected
                      ? 'bg-primary text-black border-primary font-semibold'
                      : 'bg-dark border-white/10 text-gray-300 hover:border-white/20'
                  }`}
                >
                  {tag.displayName}
                </button>
              );
            })}
          </div>
        </div>
      );
    })}

    <div className="flex items-center gap-2 pt-2 border-t border-white/10">
      <button
        type="button"
        onClick={onClear}
        className="px-3 py-2 rounded-lg text-sm border border-gray-700 text-gray-300 hover:text-white"
      >
        清除條件
      </button>
      <button
        type="button"
        onClick={onApply}
        className="flex-1 px-3 py-2 rounded-lg text-sm bg-primary text-black font-bold hover:bg-primary/90 disabled:opacity-60"
        disabled={isLoadingCount}
      >
        {isLoadingCount
          ? '計算中...'
          : typeof resultCount === 'number'
            ? `查看 ${resultCount} 件作品`
            : '套用篩選'}
      </button>
    </div>
  </div>
);

export default TaxonomyFilterPanel;
