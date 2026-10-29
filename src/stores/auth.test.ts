import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase before importing the store
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      signOut: vi.fn().mockResolvedValue({}),
    },
  },
}));

import { useAuthStore } from './auth';
import { supabase } from '../lib/supabase';

const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

function makeSelect(returnData: unknown) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: returnData, error: null }),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  };
  return chain;
}

beforeEach(() => {
  // Reset store to initial state before each test
  useAuthStore.setState({
    session: null,
    supabaseUser: null,
    profile: null,
    roles: [],
    activeRole: null,
    isLoading: true,
  });
  vi.clearAllMocks();
});

describe('hasRole', () => {
  it('returns true when role is present', () => {
    useAuthStore.setState({
      roles: [{ id: '1', user_id: 'u1', role: 'landlord', created_at: '' }],
    });
    expect(useAuthStore.getState().hasRole('landlord')).toBe(true);
  });

  it('returns false when role is absent', () => {
    useAuthStore.setState({
      roles: [{ id: '1', user_id: 'u1', role: 'landlord', created_at: '' }],
    });
    expect(useAuthStore.getState().hasRole('tenant')).toBe(false);
  });

  it('returns false when roles array is empty', () => {
    useAuthStore.setState({ roles: [] });
    expect(useAuthStore.getState().hasRole('handyman')).toBe(false);
  });
});

describe('setActiveRole', () => {
  it('updates activeRole in state', () => {
    useAuthStore.getState().setActiveRole('tenant');
    expect(useAuthStore.getState().activeRole).toBe('tenant');
  });

  it('can switch between roles', () => {
    useAuthStore.getState().setActiveRole('landlord');
    useAuthStore.getState().setActiveRole('handyman');
    expect(useAuthStore.getState().activeRole).toBe('handyman');
  });
});

describe('setSession', () => {
  it('clears state when session is null', () => {
    useAuthStore.setState({
      profile: { id: 'u1', email: 'a@b.com', full_name: 'Test', phone: null, business_name: null, avatar_url: null, created_at: '', updated_at: '' },
      roles: [{ id: '1', user_id: 'u1', role: 'landlord', created_at: '' }],
      activeRole: 'landlord',
    });

    useAuthStore.getState().setSession(null);

    const state = useAuthStore.getState();
    expect(state.profile).toBeNull();
    expect(state.roles).toEqual([]);
    expect(state.activeRole).toBeNull();
    expect(state.isLoading).toBe(false);
  });
});

describe('signOut', () => {
  it('clears all auth state', async () => {
    useAuthStore.setState({
      session: { access_token: 'tok' } as never,
      supabaseUser: { id: 'u1' } as never,
      profile: { id: 'u1', email: 'a@b.com', full_name: 'Test', phone: null, business_name: null, avatar_url: null, created_at: '', updated_at: '' },
      roles: [{ id: '1', user_id: 'u1', role: 'landlord', created_at: '' }],
      activeRole: 'landlord',
    });

    await useAuthStore.getState().signOut();

    const state = useAuthStore.getState();
    expect(state.session).toBeNull();
    expect(state.supabaseUser).toBeNull();
    expect(state.profile).toBeNull();
    expect(state.roles).toEqual([]);
    expect(state.activeRole).toBeNull();
    expect(supabase.auth.signOut).toHaveBeenCalledOnce();
  });
});

describe('updateProfile', () => {
  it('returns error message if not authenticated', async () => {
    useAuthStore.setState({ supabaseUser: null });
    const result = await useAuthStore.getState().updateProfile({ full_name: 'New Name' });
    expect(result).toBe('Not authenticated');
  });

  it('returns null and updates state on success', async () => {
    useAuthStore.setState({
      supabaseUser: { id: 'u1' } as never,
      profile: { id: 'u1', email: 'a@b.com', full_name: 'Old Name', phone: null, business_name: null, avatar_url: null, created_at: '', updated_at: '' },
    });

    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    mockFrom.mockReturnValue(updateChain);

    const result = await useAuthStore.getState().updateProfile({ full_name: 'New Name' });
    expect(result).toBeNull();
    expect(useAuthStore.getState().profile?.full_name).toBe('New Name');
  });

  it('returns error message on supabase error', async () => {
    useAuthStore.setState({
      supabaseUser: { id: 'u1' } as never,
      profile: { id: 'u1', email: 'a@b.com', full_name: 'Old', phone: null, business_name: null, avatar_url: null, created_at: '', updated_at: '' },
    });

    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
    };
    mockFrom.mockReturnValue(updateChain);

    const result = await useAuthStore.getState().updateProfile({ full_name: 'x' });
    expect(result).toBe('DB error');
  });
});

describe('loadRoles', () => {
  it('auto-sets activeRole when only one role returned', async () => {
    useAuthStore.setState({ supabaseUser: { id: 'u1' } as never, activeRole: null });

    const chain = makeSelect([{ id: '1', user_id: 'u1', role: 'handyman', created_at: '' }]);
    chain.eq = vi.fn().mockResolvedValue({ data: [{ id: '1', user_id: 'u1', role: 'handyman', created_at: '' }], error: null });
    mockFrom.mockReturnValue({ ...chain, select: vi.fn().mockReturnValue(chain) });

    await useAuthStore.getState().loadRoles();

    expect(useAuthStore.getState().activeRole).toBe('handyman');
    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});
