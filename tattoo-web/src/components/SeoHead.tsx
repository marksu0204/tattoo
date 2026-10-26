import React from 'react';
import type { DocumentMetaParams } from '../utils/pageMeta';
import { usePageSeo } from '../hooks/usePageSeo';

type SeoHeadProps = DocumentMetaParams;

/** Declarative SEO wrapper; all metadata is applied through the shared pageMeta utility. */
const SeoHead: React.FC<SeoHeadProps> = (meta) => {
  usePageSeo(meta);
  return null;
};

export default SeoHead;
