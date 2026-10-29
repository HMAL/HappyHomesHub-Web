import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuthStore } from '../stores/auth';

/**
 * True when the current landlord is on the Super Landlord tier. `is_premium` is
 * written by the Stripe webhook to mean "on Super" — it unlocks SMS, long photo
 * retention, expense tracking, in-app handyman payouts and analytics.
 */
export function useIsSuper(): { isSuper: boolean; loading: boolean } {
  const { supabaseUser } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: ['is-super', supabaseUser?.id],
    enabled: !!supabaseUser,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('users')
        .select('is_premium')
        .eq('id', supabaseUser!.id)
        .single();
      return !!data?.is_premium;
    },
  });
  return { isSuper: !!data, loading: isLoading };
}
