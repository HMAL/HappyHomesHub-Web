import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';
import { UserRole } from '../../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { session, isLoading, activeRole, roles } = useAuthStore();
  const [slowLoad, setSlowLoad] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setSlowLoad(false);
      return;
    }
    // After 3s, surface a "still loading" message + manual Retry — but never
    // auto-dump the user to /login on a slow connection; let them choose.
    const slowTimer = setTimeout(() => setSlowLoad(true), 3000);
    return () => clearTimeout(slowTimer);
  }, [isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin mx-auto mb-3" />
          {slowLoad ? (
            <>
              <p className="text-sm text-gray-700 font-medium">Still loading…</p>
              <p className="text-xs text-gray-400 mt-1">This is taking longer than usual.</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:bg-gray-700 transition"
              >
                Retry
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-500">Loading…</p>
          )}
        </div>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  if (requiredRole) {
    const hasRole = roles.some((r) => r.role === requiredRole);
    if (!hasRole) {
      const redirect = activeRole ? `/${activeRole}` : '/role-select';
      return <Navigate to={redirect} replace />;
    }
  }

  return <>{children}</>;
}
