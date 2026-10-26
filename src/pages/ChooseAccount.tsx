import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Building2 } from 'lucide-react';
import { useApp, Role, ROLE_LABELS, User } from '@/contexts/AppContext';
import { useDirectory } from '@/hooks/useDirectory';
import { AuthBackground } from '@/components/layout/AuthBackground';
import { normalizeEmail } from '@/lib/directory';

/** All roles the user holds at a firm, across its Sites. */
const firmRoles = (user: User): Role[] => {
  const all = [...user.roles, ...Object.values(user.siteRoles ?? {}).flat()];
  return Array.from(new Set(all));
};

/**
 * v20 — shown after sign-in when the email is linked to two or more firms AND the login
 * has allowStraddlingException. Choosing a firm signs in to that firm's record.
 */
export const ChooseAccount = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { users, login } = useApp();
  const directory = useDirectory();

  const email = (location.state as { email?: string } | null)?.email ?? '';
  const firms = email ? directory.findFirmsByEmail(email) : [];
  if (firms.length < 2 || !directory.hasStraddlingException(email)) {
    return <Navigate to="/login" replace />;
  }

  const recordFor = (firmId: string) =>
    users.find(u => u.companyId === firmId && normalizeEmail(u.email) === normalizeEmail(email));

  const handleChoose = (firmId: string) => {
    if (login(email, '', firmId)) navigate('/dashboard');
  };

  return (
    <AuthBackground>
      <div className="w-full max-w-[480px] animate-fade-in">
        <div className="bg-card border rounded-xl shadow-2xl p-8">
          <div className="text-center mb-6">
            <img
              src="/leimberg-logo.png"
              alt="Leimberg, LeClair & Lackner, Inc."
              className="h-9 mx-auto mb-4"
            />
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Choose an account</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Your email address is linked to more than one customer. Choose the one you want to open.
            </p>
          </div>

          <div className="space-y-3">
            {firms.map(firm => {
              const record = recordFor(firm.id);
              const roles = record ? firmRoles(record) : [];
              const disabled = !record || record.status === 'inactive' || record.hasPortalLogin === false;
              return (
                <button
                  key={firm.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleChoose(firm.id)}
                  className="w-full text-left rounded-lg border p-4 flex items-center justify-between gap-3 transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{firm.name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {roles.length ? roles.map(r => ROLE_LABELS[r]).join(', ') : 'No role assigned'}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="block mx-auto mt-5 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
          >
            Back to sign in
          </button>
        </div>
      </div>
    </AuthBackground>
  );
};
