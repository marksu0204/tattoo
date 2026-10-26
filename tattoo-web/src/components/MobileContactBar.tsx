import React from 'react';

interface MobileContactBarProps {
  primaryLabel: string;
  onPrimaryClick: () => void;
}

const MobileContactBar: React.FC<MobileContactBarProps> = ({
  primaryLabel,
  onPrimaryClick,
}) => {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[120] md:hidden border-t border-white/10 bg-dark/95 backdrop-blur-md px-4 pt-3"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
    >
      <button
        type="button"
        onClick={onPrimaryClick}
        className="w-full rounded-xl bg-primary text-black font-bold py-3.5 text-base shadow-lg"
      >
        {primaryLabel}
      </button>
    </div>
  );
};

export default MobileContactBar;
