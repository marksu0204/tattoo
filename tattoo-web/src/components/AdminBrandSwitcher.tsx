import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useAdminBrand } from '../context/AdminBrandContext';

const AdminBrandSwitcher: React.FC = () => {
  const { showBrandSwitcher, currentAdminBrand, accessibleBrands, switchAdminBrand } = useAdminBrand();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  if (!showBrandSwitcher || !currentAdminBrand) {
    return null;
  }

  const handleSelect = async (code: string) => {
    if (code === currentAdminBrand.code || switching) return;
    setSwitching(true);
    setOpen(false);
    try {
      await switchAdminBrand(code);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <span className="block text-xs text-gray-500 mb-1">目前品牌</span>
      <button
        type="button"
        disabled={switching}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 min-w-[160px] justify-between bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 rounded-lg hover:border-primary/50 disabled:opacity-60"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{currentAdminBrand.name}</span>
        <ChevronDown size={16} className="shrink-0 text-gray-400" />
      </button>
      {open && (
        <ul
          className="absolute z-50 mt-1 w-full min-w-[180px] bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden"
          role="listbox"
        >
          {accessibleBrands.map((brand) => (
            <li key={brand.code}>
              <button
                type="button"
                role="option"
                aria-selected={brand.code === currentAdminBrand.code}
                onClick={() => void handleSelect(brand.code)}
                className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-800 ${
                  brand.code === currentAdminBrand.code ? 'text-primary bg-gray-800/80' : 'text-gray-200'
                }`}
              >
                {brand.name}
                {!brand.isActive && (
                  <span className="ml-2 text-[10px] text-gray-500 uppercase">inactive</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AdminBrandSwitcher;
