export interface SeoConfig {
  title: string;
  description: string;
  robots: string;
  canonicalUrl?: string;
}

export const PUBLIC_MARKETING_SITE_URL: string;
export const INDEXABLE_ROUTE_CONFIG: Record<string, SeoConfig>;
export const NOINDEX_PREFIXES: string[];
export const LEGACY_REDIRECTS: Record<string, string>;
export function normalizePathname(pathname: string): string;
export function escapeHtml(value: string): string;
export function getSeoConfigForPath(pathname: string): SeoConfig;
export function injectSeoMeta(html: string, config: SeoConfig): string;
