import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { en } from '../locales/en';
import { es } from '../locales/es';
import { useAuthStore } from '../stores/auth';
import { setUtilsLang } from './utils';

export type Lang = 'en' | 'es';

const catalogs: Record<Lang, Record<string, string>> = { en, es };
const STORAGE_KEY = 'hhh_lang';

// Resolution before a profile loads: saved choice → browser language → English.
function resolveInitial(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'es') return stored;
  } catch { /* ignore */ }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nCtx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(resolveInitial);
  const profileLang = useAuthStore((s) => s.profile?.language);
  const persistLanguage = useAuthStore((s) => s.setLanguage);

  // Once a signed-in user's saved language loads, the app switches to it.
  useEffect(() => {
    if (profileLang === 'en' || profileLang === 'es') {
      setLangState(profileLang);
      try { localStorage.setItem(STORAGE_KEY, profileLang); } catch { /* ignore */ }
    }
  }, [profileLang]);

  // Keep the framework-free helpers (dates, greetings) in sync. Set during render so
  // children that call formatDate/timeAgo/getGreeting use the right language immediately.
  setUtilsLang(lang);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
    persistLanguage(l); // best-effort save to profile when signed in
  }, [persistLanguage]);

  const t = useCallback((key: string, vars?: Record<string, string | number>) => {
    let str = catalogs[lang][key] ?? catalogs.en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) str = str.split(`{${k}}`).join(String(v));
    return str;
  }, [lang]);

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useT(): I18nCtx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT must be used within <LanguageProvider>');
  return ctx;
}
