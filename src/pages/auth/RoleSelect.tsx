import { useNavigate } from 'react-router-dom';
import { Building2, Users, Wrench, LogOut } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';
import { UserRole } from '../../types';
import HHLogo from '../../components/brand/HHLogo';
import Footer from '../../components/shared/Footer';

const roleConfig: Record<UserRole, { label: string; desc: string; icon: typeof Building2; color: string; bg: string }> = {
  landlord: {
    label: 'Homeowner',
    desc: 'Manage your properties, habitants, rent, and maintenance.',
    icon: Building2,
    color: '#D4972A',
    bg: '#0D1F2D',
  },
  tenant: {
    label: 'Habitant',
    desc: 'View your lease, pay rent, and submit repair requests.',
    icon: Users,
    color: '#00C8BB',
    bg: '#12202E',
  },
  handyman: {
    label: 'Handyman',
    desc: 'Find jobs, manage your profile, and grow your reputation.',
    icon: Wrench,
    color: '#34D399',
    bg: '#1B3A2F',
  },
};

export default function RoleSelect() {
  const navigate = useNavigate();
  const { roles, setActiveRole, signOut, profile } = useAuthStore();

  const availableRoles = roles.map((r) => r.role).filter((r, i, arr) => arr.indexOf(r) === i) as UserRole[];

  function selectRole(role: UserRole) {
    setActiveRole(role);
    navigate(`/${role}`, { replace: true });
  }

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-[#0D1F2D] flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-lg">
          <div className="flex justify-center mb-8">
            <HHLogo variant="full" theme="dark" size={52} />
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <h1 className="font-display text-2xl font-bold text-gray-900 mb-1">
              Welcome{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
            </h1>
            <p className="text-sm text-gray-500 mb-6">
              {availableRoles.length > 0 ? 'Choose which portal to enter today' : 'Account setup in progress'}
            </p>

            <div className="space-y-3">
              {availableRoles.map((role) => {
                const cfg = roleConfig[role];
                return (
                  <button
                    key={role}
                    onClick={() => selectRole(role)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-transparent hover:border-gray-200 hover:bg-gray-50 transition-all text-left group"
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: cfg.bg }}
                    >
                      <cfg.icon className="w-6 h-6" style={{ color: cfg.color }} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 group-hover:text-gray-700">{cfg.label}</p>
                      <p className="text-sm text-gray-500">{cfg.desc}</p>
                    </div>
                    <span className="text-gray-300 group-hover:text-gray-500 transition-colors">→</span>
                  </button>
                );
              })}
            </div>

            {availableRoles.length === 0 && (
              <div className="text-center py-6">
                <p className="text-sm text-gray-700 font-medium mb-1">No roles assigned yet</p>
                <p className="text-sm text-gray-500">
                  If you just signed up, please confirm your email then sign in again.
                  Need help?{' '}
                  <a href="mailto:support@happyhomeshub.com" className="font-medium text-[#0D1F2D] hover:underline">
                    support@happyhomeshub.com
                  </a>
                </p>
              </div>
            )}

            <button
              onClick={handleSignOut}
              className="mt-6 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
