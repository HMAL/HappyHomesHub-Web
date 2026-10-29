import { useState } from 'react';
import { Languages } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useT } from '../../lib/i18n';

/**
 * Renders message text with a small "Translate" toggle. The original is always
 * shown by default; tapping translates it into the viewer's current app language
 * (auto-detecting the source) and lets them flip back to the original.
 */
export default function TranslatableText({ text, className = '' }: { text: string; className?: string }) {
  const { t, lang } = useT();
  const [translated, setTranslated] = useState<string | null>(null);
  const [showing, setShowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleClick() {
    if (translated) { setShowing((s) => !s); return; }
    setLoading(true);
    setFailed(false);
    try {
      const { data, error } = await supabase.functions.invoke('translate-text', {
        body: { text, target: lang },
      });
      if (error || !data?.translatedText) throw new Error('translate failed');
      setTranslated(data.translatedText as string);
      setShowing(true);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <p className={className}>{showing && translated ? translated : text}</p>
      {text.trim().length > 1 && (
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium opacity-70 hover:opacity-100 transition disabled:opacity-50"
        >
          <Languages className="w-3 h-3" />
          {loading ? t('msg.translating') : failed ? t('msg.translateError') : showing ? t('msg.showOriginal') : t('msg.translate')}
        </button>
      )}
    </>
  );
}
