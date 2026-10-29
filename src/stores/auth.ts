import { create } from 'zustand';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User, UserRole, RoleAssignment } from '../types';

interface AuthState {
  session: Session | null;
  supabaseUser: SupabaseUser | null;
  profile: User | null;
  roles: RoleAssignment[];
  activeRole: UserRole | null;
  isLoading: boolean;
  setSession: (session: Session | null) => void;
  setActiveRole: (role: UserRole) => void;
  loadProfile: () => Promise<void>;
  loadRoles: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
  updateProfile: (updates: { full_name?: string; phone?: string }) => Promise<string | null>;
  setLanguage: (language: 'en' | 'es') => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  supabaseUser: null,
  profile: null,
  roles: [],
  activeRole: null,
  isLoading: true,

  setSession: (session) => {
    set({ session, supabaseUser: session?.user ?? null, isLoading: !!session });
    if (session) {
      Promise.all([get().loadProfile(), get().loadRoles()]).catch(() => {
        set({ isLoading: false });
      });
    } else {
      set({ profile: null, roles: [], activeRole: null, isLoading: false });
    }
  },

  setActiveRole: (role) => set({ activeRole: role }),

  hasRole: (role) => get().roles.some((r) => r.role === role),

  loadProfile: async () => {
    const { supabaseUser } = get();
    if (!supabaseUser) return;
    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, phone, business_name, avatar_url, language, created_at, updated_at')
      .eq('id', supabaseUser.id)
      .single();
    if (data) {
      set({ profile: data as User });
      return;
    }
    // PGRST116 = row not found — expected on first sign-in before trigger fires
    if (error && error.code !== 'PGRST116') {
      console.error('[auth] loadProfile error:', error.message);
      return;
    }
    // No profile row — trigger may not have fired at signup. Create it now.
    const fullName =
      (supabaseUser.user_metadata?.full_name as string | undefined) ??
      supabaseUser.email?.split('@')[0] ??
      'User';
    const { data: created, error: createError } = await supabase
      .from('users')
      .insert({ id: supabaseUser.id, email: supabaseUser.email!, full_name: fullName })
      .select('id, email, full_name, phone, business_name, avatar_url, language, created_at, updated_at')
      .single();
    if (createError) {
      console.error('[auth] profile fallback create failed:', createError.message);
      return;
    }
    if (created) set({ profile: created as User });
  },

  loadRoles: async () => {
    const { supabaseUser } = get();
    if (!supabaseUser) return;
    const { data, error } = await supabase
      .from('role_assignments')
      .select('*')
      .eq('user_id', supabaseUser.id);
    if (error) console.error('[auth] loadRoles error:', error.message);
    const roles = (data as RoleAssignment[]) ?? [];
    set({ roles, isLoading: false });
    if (roles.length === 1 && !get().activeRole) {
      set({ activeRole: roles[0].role });
    }
  },

  updateProfile: async (updates) => {
    const { supabaseUser, profile } = get();
    if (!supabaseUser) return 'Not authenticated';
    const sanitized = {
      ...(updates.full_name !== undefined && { full_name: updates.full_name.trim().slice(0, 100) }),
      ...(updates.phone !== undefined && { phone: updates.phone.trim().slice(0, 20) }),
    };
    const { error } = await supabase.from('users').update(sanitized).eq('id', supabaseUser.id);
    if (error) return error.message;
    set({ profile: { ...profile!, ...sanitized } });
    return null;
  },

  setLanguage: async (language) => {
    const { supabaseUser, profile } = get();
    if (profile) set({ profile: { ...profile, language } }); // optimistic
    if (!supabaseUser) return;
    const { error } = await supabase.from('users').update({ language }).eq('id', supabaseUser.id);
    if (error) console.error('[auth] setLanguage error:', error.message);
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, supabaseUser: null, profile: null, roles: [], activeRole: null });
  },
}));
