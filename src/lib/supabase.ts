import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Show a visible error in the page so it's clear what's wrong
  document.body.style.cssText = 'font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0D1F2D;margin:0';
  document.body.innerHTML = `
    <div style="text-align:center;color:#fff;padding:32px;max-width:480px">
      <div style="font-size:48px;margin-bottom:16px">⚠️</div>
      <h1 style="font-size:22px;font-weight:700;margin-bottom:8px">Missing environment variables</h1>
      <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;margin-bottom:20px">
        The deployment is missing <code style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px">VITE_SUPABASE_URL</code>
        and/or <code style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px">VITE_SUPABASE_ANON_KEY</code>.<br/><br/>
        Add them in Cloudflare Pages → Settings → Environment Variables, then trigger a new deployment.
      </p>
    </div>`;
  throw new Error('[HappyHomesHub] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set before building.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
