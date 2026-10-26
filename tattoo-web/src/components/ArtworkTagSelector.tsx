import React from 'react';
import type { ArtworkTagGroup, ArtworkTaxonomyTag } from '../types';
import { ARTWORK_TAG_GROUP_LABELS, ARTWORK_TAG_GROUPS } from '../utils/artworkTaxonomy';

interface ArtworkTagSelectorProps {
  tagsByGroup: Record<ArtworkTagGroup, ArtworkTaxonomyTag[]>;
  selectedTagIds: number[];
  onChange: (next: number[]) => void;
  activeOnly?: boolean;
}

const ArtworkTagSelector: React.FC<ArtworkTagSelectorProps> = ({
  tagsByGroup,
  selectedTagIds,
  onChange,
  activeOnly = false,
}) => {
  const toggle = (tagId: number) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onChange([...selectedTagIds, tagId]);
    }
  };

  return (
    <div className="space-y-4">
      {ARTWORK_TAG_GROUPS.map((groupKey) => {
        const tags = (tagsByGroup[groupKey] ?? []).filter((tag) => !activeOnly || tag.isActive);
        if (tags.length === 0) return null;
        return (
          <div key={groupKey}>
            <p className="text-xs font-semibold text-gray-400 mb-2">{ARTWORK_TAG_GROUP_LABELS[groupKey]}</p>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const selected = selectedTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggle(tag.id)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                      selected
                        ? 'bg-primary/15 border-primary text-primary'
                        : 'bg-dark border-white/10 text-gray-300 hover:border-white/20'
                    }`}
                  >
                    {selected ? '✓ ' : ''}{tag.displayName}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ArtworkTagSelector;
