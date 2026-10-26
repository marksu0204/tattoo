import { SEO_SITE_NAME } from './seoConfig';

export type RobotsDirective = 'index, follow' | 'noindex, nofollow' | 'noindex, follow';

export type DocumentMetaParams = {
  title: string;
  description: string;
  robots: RobotsDirective;
  canonicalUrl?: string;
  imageUrl?: string;
  ogType?: string;
  siteName?: string;
};

const upsertMetaTag = (
  selector: string,
  attributeName: 'name' | 'property',
  attributeValue: string,
  content: string
) => {
  let meta = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attributeName, attributeValue);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
};

const removeMetaTag = (selector: string) => {
  document.head.querySelector(selector)?.remove();
};

const upsertCanonicalLink = (href: string) => {
  let canonical = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = href;
};

const removeCanonicalLink = () => {
  document.head.querySelector('link[rel="canonical"]')?.remove();
};

const RUNTIME_META_SELECTORS = [
  'meta[name="description"]',
  'meta[name="robots"]',
  'meta[property="og:title"]',
  'meta[property="og:description"]',
  'meta[property="og:url"]',
  'meta[property="og:type"]',
  'meta[property="og:site_name"]',
  'meta[property="og:image"]',
  'meta[name="twitter:card"]',
  'meta[name="twitter:title"]',
  'meta[name="twitter:description"]',
  'meta[name="twitter:image"]',
] as const;

/** Remove runtime-managed SEO tags so the next route cannot inherit stale metadata. */
export const clearRuntimeDocumentMeta = () => {
  for (const selector of RUNTIME_META_SELECTORS) {
    removeMetaTag(selector);
  }
  removeCanonicalLink();
};

export const setDocumentMeta = (params: DocumentMetaParams) => {
  const siteName = params.siteName ?? SEO_SITE_NAME;
  const ogType = params.ogType ?? 'website';

  document.title = params.title;
  upsertMetaTag('meta[name="description"]', 'name', 'description', params.description);
  upsertMetaTag('meta[name="robots"]', 'name', 'robots', params.robots);
  upsertMetaTag('meta[property="og:title"]', 'property', 'og:title', params.title);
  upsertMetaTag('meta[property="og:description"]', 'property', 'og:description', params.description);
  upsertMetaTag('meta[property="og:type"]', 'property', 'og:type', ogType);
  upsertMetaTag('meta[property="og:site_name"]', 'property', 'og:site_name', siteName);
  upsertMetaTag('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
  upsertMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', params.title);
  upsertMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', params.description);

  if (params.canonicalUrl) {
    upsertCanonicalLink(params.canonicalUrl);
    upsertMetaTag('meta[property="og:url"]', 'property', 'og:url', params.canonicalUrl);
  } else {
    removeCanonicalLink();
    removeMetaTag('meta[property="og:url"]');
  }

  if (params.imageUrl) {
    upsertMetaTag('meta[property="og:image"]', 'property', 'og:image', params.imageUrl);
    upsertMetaTag('meta[name="twitter:image"]', 'name', 'twitter:image', params.imageUrl);
  } else {
    removeMetaTag('meta[property="og:image"]');
    removeMetaTag('meta[name="twitter:image"]');
  }
};
