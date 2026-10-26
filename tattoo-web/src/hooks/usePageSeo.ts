import { useEffect } from 'react';
import {
  clearRuntimeDocumentMeta,
  setDocumentMeta,
  type DocumentMetaParams,
} from '../utils/pageMeta';

export function usePageSeo(meta: DocumentMetaParams) {
  const {
    title,
    description,
    robots,
    canonicalUrl,
    imageUrl,
    ogType,
    siteName,
  } = meta;

  useEffect(() => {
    setDocumentMeta({
      title,
      description,
      robots,
      canonicalUrl,
      imageUrl,
      ogType,
      siteName,
    });

    return () => {
      clearRuntimeDocumentMeta();
    };
  }, [title, description, robots, canonicalUrl, imageUrl, ogType, siteName]);
}
