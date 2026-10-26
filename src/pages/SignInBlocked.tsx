import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { AuthBackground } from '@/components/layout/AuthBackground';
import { SUPPORT_HREF } from '@/lib/support';

/**
 * v20 — shown instead of the portal when the email is linked to two or more firms and the
 * login does NOT have allowStraddlingException. Never names the firms involved.
 */
export const SignInBlocked = () => {
  const navigate = useNavigate();
  const { logout } = useApp();

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  return (
    <AuthBackground>
      <div className="w-full max-w-[440px] animate-fade-in">
        <div className="bg-card border rounded-xl shadow-2xl p-8 space-y-5" role="alert">
          <div className="text-center space-y-2">
            <div className="mx-auto h-11 w-11 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">We can't sign you in yet</h1>
            <p className="text-sm text-muted-foreground">
              Your email address is linked to more than one customer account, which isn't allowed for your
              account. Please contact support and we'll fix it.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button asChild className="w-full h-10 font-medium">
              <a href={SUPPORT_HREF}>Contact support</a>
            </Button>
            <Button type="button" variant="outline" onClick={handleSignOut} className="w-full h-10 font-medium">
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </AuthBackground>
  );
};
