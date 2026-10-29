import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
const PROMPTED_KEY = 'hhh_push_prompted';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Registers the service worker (PWA + push). Safe to call on every load. */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('/sw.js');
  } catch { /* ignore registration errors */ }
}

function supported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC_KEY;
}

/** Subscribes the current device to Web Push and stores it for the signed-in user. */
export async function subscribeToPush(): Promise<boolean> {
  if (!supported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!) as BufferSource,
    });

    const json = sub.toJSON();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !json.keys) return false;

    await supabase.from('push_subscriptions').upsert(
      { user_id: user.id, endpoint: sub.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
      { onConflict: 'endpoint' },
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Asks for notification permission — but only once, and intended to be called
 * AFTER a meaningful first action (submitting a repair, paying rent) rather than
 * on first load, where opt-in rates collapse.
 */
export async function maybePromptForPush(): Promise<void> {
  if (!supported()) return;
  if (Notification.permission !== 'default') {
    if (Notification.permission === 'granted') await subscribeToPush();
    return;
  }
  if (localStorage.getItem(PROMPTED_KEY)) return;
  localStorage.setItem(PROMPTED_KEY, '1');
  const result = await Notification.requestPermission();
  if (result === 'granted') await subscribeToPush();
}
