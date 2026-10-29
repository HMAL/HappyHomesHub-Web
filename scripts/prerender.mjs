// Post-build prerender: writes dist/<route>/index.html with correct per-route
// <title>, description, canonical, and OG/Twitter tags. Fixes the SPA problem
// where the raw HTML claims the homepage canonical on every route (Google may
// use the raw-HTML canonical over the JS-injected one).
//
// Cloudflare Pages serves static assets before _redirects, so these files take
// priority over the SPA fallback; the React app still hydrates identically.
//
// Run via: node --experimental-strip-types scripts/prerender.mjs  (after vite build)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { en } from '../src/locales/en.ts';
import { POSTS } from '../src/pages/blog/posts.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://happyhomeshub.com';

const routes = [
  { path: '/for-landlords', title: en['rl.landlord_metaTitle'], desc: en['rl.landlord_metaDesc'] },
  { path: '/for-tenants', title: en['rl.tenant_metaTitle'], desc: en['rl.tenant_metaDesc'] },
  { path: '/for-handymen', title: en['rl.handyman_metaTitle'], desc: en['rl.handyman_metaDesc'] },
  { path: '/faq', title: en['faq.metaTitle'], desc: en['faq.metaDesc'] },
  { path: '/contact', title: en['ct.metaTitle'], desc: en['ct.metaDesc'] },
  { path: '/accessibility', title: en['acc.metaTitle'], desc: en['acc.metaDesc'] },
  { path: '/blog', title: en['blog.metaTitle'], desc: en['blog.metaDesc'] },
  { path: '/login', title: 'Sign In — HappyHomesHub', desc: 'Sign in to your HappyHomesHub account to manage rent, repairs, and documents.' },
  { path: '/signup', title: 'Create Your Free Account — HappyHomesHub', desc: 'Sign up free as a landlord, tenant, or handyman. First property free — no credit card required.' },
  { path: '/forgot-password', title: 'Reset Password — HappyHomesHub', desc: 'Request a password reset link for your HappyHomesHub account.' },
  { path: '/legal/terms', title: 'Terms of Service — HappyHomesHub', desc: 'The terms that govern your use of HappyHomesHub.' },
  { path: '/legal/privacy', title: 'Privacy Policy — HappyHomesHub', desc: 'How HappyHomesHub collects, uses, and protects your data.' },
  ...POSTS.map((p) => ({
    path: `/blog/${p.slug}`,
    title: `${p.title.en} | HappyHomesHub Blog`,
    desc: p.excerpt.en,
  })),
];

const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const escText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const template = readFileSync(resolve(root, 'dist/index.html'), 'utf8');

let count = 0;
for (const r of routes) {
  const url = `${SITE}${r.path}`;
  // Replacement callbacks, not template strings — titles/descriptions contain
  // "$7"/"$10", which String.replace would otherwise parse as group references.
  const sub = (value) => (_m, pre, post) => pre + value + post;
  const html = template
    .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escText(r.title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, sub(escAttr(r.desc)))
    .replace(/(<link rel="canonical" href=")[^"]*(")/, sub(escAttr(url)))
    .replace(/(<meta property="og:title" content=")[^"]*(")/, sub(escAttr(r.title)))
    .replace(/(<meta property="og:description" content=")[^"]*(")/, sub(escAttr(r.desc)))
    .replace(/(<meta property="og:url" content=")[^"]*(")/, sub(escAttr(url)))
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, sub(escAttr(r.title)))
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, sub(escAttr(r.desc)));

  const out = resolve(root, `dist${r.path}/index.html`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  count++;
}
console.log(`prerender: wrote ${count} route pages`);
