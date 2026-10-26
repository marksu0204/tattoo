import React, { useState } from 'react';
import { Users } from 'lucide-react';

/** LINE profile URL 常失效；onError 後不再重試同一 URL */
const SafeAvatar: React.FC<{
  src?: string | null;
  alt?: string;
  className?: string;
  iconSize?: number;
}> = ({ src, alt = '', className = 'w-10 h-10 rounded-full object-cover flex-shrink-0', iconSize = 16 }) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={`bg-gray-700 flex items-center justify-center flex-shrink-0 ${className}`}>
        <Users size={iconSize} className="text-gray-400" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
};

export default SafeAvatar;
