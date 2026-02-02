import { useNavigate } from 'react-router-dom';
import { Building2, ArrowRight } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export const CompanySelection = () => {
  const navigate = useNavigate();
  const { companies, selectCompany, currentUser } = useApp();
  const { toast } = useToast();

  const handleSelectCompany = (companyId: string) => {
    selectCompany(companyId);
    toast({
      title: 'Company selected',
      description: `Now viewing ${companies.find(c => c.id === companyId)?.name}`,
    });
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6 animate-fade-in">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary mb-3">
            <span className="text-primary-foreground font-bold text-lg">NC</span>
          </div>
          <h1 className="text-xl font-semibold text-foreground">Welcome, {currentUser?.firstName}!</h1>
          <p className="text-muted-foreground mt-1">Select a company to continue</p>
        </div>

        {/* Company Cards */}
        <div className="space-y-3">
          {companies.map(company => (
            <Card 
              key={company.id}
              className="cursor-pointer card-hover transition-all hover:border-primary"
              onClick={() => handleSelectCompany(company.id)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{company.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Member since {new Date(company.createdAt).toLocaleDateString('en-US', { 
                        month: 'long', 
                        year: 'numeric' 
                      })}
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
