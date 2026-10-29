import { useEffect } from 'react';

const SITE = 'https://happyhomeshub.com';
const DEFAULT_TITLE = 'HappyHomesHub — Property Management Software for Landlords & Tenants';

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function upsertCanonical(href: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

/**
 * Sets per-route SEO tags for the SPA. Critically, it rewrites the canonical URL
 * to the current path — the static index.html canonical points every route at the
 * homepage, which stops sub-pages (blog, contact, faq) from being indexed.
 * Googlebot renders JS, so these client-set tags are picked up.
 *
 * @param path absolute path beginning with "/", e.g. "/blog/rent-prices-by-city"
 */
export function usePageMeta(title: string, description: string, path: string) {
  useEffect(() => {
    document.title = title || DEFAULT_TITLE;
    const canonical = `${SITE}${path === '/' ? '' : path}`;
    upsertCanonical(canonical);
    if (description) {
      upsertMeta('name', 'description', description);
      upsertMeta('property', 'og:description', description);
    }
    upsertMeta('property', 'og:title', title || DEFAULT_TITLE);
    upsertMeta('property', 'og:url', canonical);
  }, [title, description, path]);
}
