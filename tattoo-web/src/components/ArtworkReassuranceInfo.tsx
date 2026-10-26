import React from 'react';

const REASSURANCE_ITEMS = [
  '可刷卡付款',
  '尺寸可討論調整',
  '大型作品可分次施作，依每次施作進度收費',
] as const;

const ArtworkReassuranceInfo: React.FC = () => (
  <ul className="text-sm text-gray-400 space-y-1">
    {REASSURANCE_ITEMS.map((item) => (
      <li key={item} className="flex items-start gap-2">
        <span className="text-primary shrink-0">✓</span>
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

export default ArtworkReassuranceInfo;
