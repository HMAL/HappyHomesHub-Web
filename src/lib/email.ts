import { supabase } from './supabase';

/**
 * Returns true only when the email's domain is a known disposable/throwaway provider.
 * Calls the `check-disposable-email` Edge Function (the API key stays server-side).
 *
 * FAIL OPEN: any error returns false, so signup is never blocked by the checker being down.
 */
export async function isDisposableEmail(email: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('check-disposable-email', {
      body: { email },
    });
    if (error) return false;
    return data?.disposable === true;
  } catch {
    return false;
  }
}
