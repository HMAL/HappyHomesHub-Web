import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useT } from '../../lib/i18n';

/** Slim banner shown while the browser is offline, so a network blip is obvious
 *  instead of silently failing mid-action. */
export default function OfflineBanner() {
  const { t } = useT();
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-0 inset-x-0 z-50 flex items-center justify-center gap-2 bg-gray-900 text-white text-sm py-2 px-4"
    >
      <WifiOff className="w-4 h-4" />
      {t('cmp.offline')}
    </div>
  );
}
