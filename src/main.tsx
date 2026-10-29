import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { LanguageProvider } from './lib/i18n';
import { initMonitoring, logError } from './lib/monitoring';
import { registerServiceWorker } from './lib/push';

initMonitoring();
registerServiceWorker();

// Capture errors that escape React's tree (async callbacks, event handlers,
// rejected promises) into error_log so the team sees bugs users won't report.
window.addEventListener('error', (e) => {
  logError(e.error ?? e.message, 'window_onerror', { filename: e.filename, lineno: e.lineno, colno: e.colno });
});
window.addEventListener('unhandledrejection', (e) => {
  logError(e.reason, 'unhandled_rejection');
});

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  document.body.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:sans-serif;background:#f9fafb;padding:24px;">
      <div style="max-width:420px;text-align:center;">
        <h1 style="font-size:20px;font-weight:700;color:#111;margin-bottom:8px;">Configuration required</h1>
        <p style="font-size:14px;color:#6b7280;margin-bottom:16px;">
          Missing <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;">VITE_SUPABASE_URL</code> or
          <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;">VITE_SUPABASE_ANON_KEY</code> in your
          <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;">.env.local</code> file.
        </p>
        <p style="font-size:13px;color:#9ca3af;">Copy these values from your Supabase project settings or the mobile app's .env file.</p>
      </div>
    </div>`;
  throw new Error('Missing required environment variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
);
