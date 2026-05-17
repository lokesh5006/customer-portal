import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { AuthBackground } from '@/components/layout/AuthBackground';

export const Login = () => {
  const navigate = useNavigate();
  const { login, users, companies } = useApp();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    await new Promise(resolve => setTimeout(resolve, 400));

    const success = login(email, password);

    if (success) {
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      const userCompanies = companies.filter(c =>
        users.some(u => u.email.toLowerCase() === email.toLowerCase() && u.companyId === c.id)
      );

      if (userCompanies.length > 1) {
        navigate('/select-company');
      } else {
        toast({
          title: 'Welcome back!',
          description: `Signed in as ${user?.firstName} ${user?.lastName}`,
        });
        navigate('/dashboard');
      }
    } else {
      setError('Invalid email or password. Please try again.');
    }

    setIsLoading(false);
  };

  const handleForgotPassword = () => {
    toast({
      title: 'Password reset',
      description: 'Password reset is not yet available in this build. Please contact support@leimberg.com for assistance.',
    });
  };

  return (
    <AuthBackground>
      <div className="w-full max-w-md animate-fade-in">
        <div className="bg-white rounded-2xl shadow-2xl p-8 sm:p-10">
          <div className="text-center mb-6">
            <img
              src="/leimberg-logo.png"
              alt="Leimberg, LeClair & Lackner, Inc."
              className="h-10 mx-auto mb-3"
            />
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Sign in to the Customer Portal
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-slate-700 text-sm font-medium">
                Email / Username
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-11 bg-slate-50 border-slate-200 focus-visible:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-slate-700 text-sm font-medium">
                  Password
                </Label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-11 bg-slate-50 border-slate-200 pr-10 focus-visible:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(v) => setRememberMe(!!v)}
              />
              <Label htmlFor="remember" className="text-sm text-slate-600 cursor-pointer font-normal">
                Remember me
              </Label>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-md">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-medium"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              This is a demo. Any email and password will work.
            </p>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-white text-xs font-semibold tracking-[0.2em] text-slate-400">
                NEW HERE?
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/signup')}
            className="w-full h-11 border-blue-600 text-blue-600 hover:bg-blue-50 hover:text-blue-700 font-medium"
          >
            Create Account &amp; Buy Subscription
          </Button>
        </div>

        <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-blue-100/90">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Secure enterprise login</span>
        </div>
      </div>
    </AuthBackground>
  );
};
