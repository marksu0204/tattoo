import React from 'react';

const UnsupportedBrand: React.FC = () => (
  <div className="min-h-screen bg-dark text-gray-300 flex items-center justify-center px-4">
    <div className="max-w-md text-center">
      <p className="text-primary font-bold text-lg mb-2">Unsupported Site</p>
      <h1 className="text-2xl font-bold text-white mb-3">此網址尚未啟用</h1>
      <p className="text-gray-500 text-sm">
        請確認您造訪的網址是否正確。
      </p>
    </div>
  </div>
);

export default UnsupportedBrand;
