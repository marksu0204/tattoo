import React from 'react';
import { Link } from 'react-router-dom';
import { useBrand } from '../context/BrandContext';
import { usePageSeo } from '../hooks/usePageSeo';
import { buildNotFoundSeo } from '../utils/seoConfig';

const NotFound: React.FC = () => {
  const { brand } = useBrand();
  usePageSeo(buildNotFoundSeo(brand));
  return (
    <div className="max-w-3xl mx-auto px-4 py-20 text-center">
      <p className="text-primary font-bold text-lg mb-2">404</p>
      <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">找不到此頁面</h1>
      <p className="text-gray-400 mb-8">你要查看的作品可能不存在，或連結已變更。</p>
      <Link
        to="/"
        className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-primary text-black font-bold hover:bg-yellow-500 transition-colors"
      >
        返回首頁
      </Link>
    </div>
  );
};

export default NotFound;
