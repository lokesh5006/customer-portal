import { useNavigate } from 'react-router-dom';
import { ArrowRight, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const Welcome = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary mb-4">
            <span className="text-primary-foreground font-bold text-2xl">NC</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">NumberCruncher</h1>
          <p className="text-muted-foreground mt-2">Customer Portal</p>
        </div>

        {/* Options */}
        <Card className="shadow-elevated">
          <CardContent className="p-6 space-y-4">
            <Button
              className="w-full h-12 text-base gap-3"
              onClick={() => navigate('/login')}
            >
              Log In
              <ArrowRight className="h-4 w-4" />
            </Button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>
            
            <Button
              variant="outline"
              className="w-full h-12 text-base gap-3"
              onClick={() => navigate('/signup')}
            >
              <UserPlus className="h-4 w-4" />
              Create Account &amp; Start Subscription
            </Button>
          </CardContent>
        </Card>

        {/* Demo accounts info */}
        <Card className="bg-muted/50 border-dashed">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-foreground mb-2">Demo Accounts:</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>• john.smith@abcaccounting.com (Owner)</p>
              <p>• sarah.johnson@abcaccounting.com (Billing)</p>
              <p>• mike.williams@abcaccounting.com (Admin)</p>
              <p>• michael.chen@xyzconsulting.com (Owner)</p>
            </div>
            <p className="text-xs text-muted-foreground mt-2 italic">Any password works</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
