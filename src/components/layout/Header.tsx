import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, User, LogOut, Building2, Settings, AlertTriangle } from 'lucide-react';
import { useApp, UserRole } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const roleLabels: Record<UserRole, string> = {
  owner: 'Account Owner',
  billing: 'Billing User',
  admin: 'Firm Admin',
  standard: 'Standard User',
};

const roleColors: Record<UserRole, string> = {
  owner: 'badge-owner',
  billing: 'badge-billing',
  admin: 'badge-admin',
  standard: 'badge-standard',
};

export const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    currentUser,
    currentCompany,
    companies,
    selectCompany,
    logout,
    demoRoles,
    setDemoRoles,
    billingHasAdminAccess,
    setBillingHasAdminAccess,
    isProxySession,
    proxiedUser,
    endProxySession,
    hasAccess,
  } = useApp();

  const handleCompanyChange = (companyId: string) => {
    selectCompany(companyId);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleRoleToggle = (role: UserRole) => {
    if (demoRoles.includes(role)) {
      if (demoRoles.length > 1) {
        setDemoRoles(demoRoles.filter(r => r !== role));
      }
    } else {
      setDemoRoles([...demoRoles, role]);
    }
  };

  // Check if current page is accessible with new roles
  const checkPageAccess = (newRoles: UserRole[]) => {
    const pageAccess: Record<string, UserRole[]> = {
      '/dashboard': ['owner', 'billing', 'admin', 'standard'],
      '/users': ['owner', 'admin'],
      '/subscriptions': ['owner', 'billing', 'admin'],
      '/licenses': ['owner', 'admin'],
      '/billing': ['owner', 'billing'],
      '/downloads': ['owner', 'billing', 'admin', 'standard'],
      '/support': ['owner', 'billing', 'admin', 'standard'],
      '/profile': ['owner', 'billing', 'admin', 'standard'],
    };

    const currentPath = location.pathname;
    const requiredRoles = pageAccess[currentPath] || [];
    
    let effectiveRoles = [...newRoles];
    if (billingHasAdminAccess && newRoles.includes('billing') && !newRoles.includes('admin')) {
      effectiveRoles.push('admin');
    }
    
    const hasPageAccess = requiredRoles.some(role => effectiveRoles.includes(role));
    
    if (!hasPageAccess && currentPath !== '/dashboard') {
      navigate('/dashboard');
    }
  };

  const displayUser = isProxySession ? proxiedUser : currentUser;

  return (
    <>
      {/* Proxy Session Banner */}
      {isProxySession && proxiedUser && (
        <div className="proxy-banner px-4 py-2 flex items-center justify-between bg-warning/10 border-b border-warning/30">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <span className="text-sm font-medium text-foreground">
              Proxy session: You are viewing as{' '}
              <strong>{proxiedUser.firstName} {proxiedUser.lastName}</strong>
              {' '}(Roles: {proxiedUser.roles.map(r => roleLabels[r]).join(', ')})
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={endProxySession}
            className="border-warning/50 text-warning hover:bg-warning/10"
          >
            End Proxy
          </Button>
        </div>
      )}
      
      <header className="h-14 border-b bg-card flex items-center justify-between px-4 sticky top-0 z-40">
        <div className="flex items-center gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">NC</span>
            </div>
            <span className="font-semibold text-foreground hidden sm:inline">NumberCruncher</span>
          </div>

          {/* Company Switcher */}
          {currentCompany && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground">
                  <Building2 className="h-4 w-4" />
                  <span className="hidden sm:inline">{currentCompany.name}</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Switch Company</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {companies.map(company => (
                  <DropdownMenuItem
                    key={company.id}
                    onClick={() => handleCompanyChange(company.id)}
                    className={company.id === currentCompany.id ? 'bg-accent' : ''}
                  >
                    <Building2 className="h-4 w-4 mr-2" />
                    {company.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Role Switcher (Demo) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Role Demo</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Demo Role Switcher</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(['owner', 'billing', 'admin', 'standard'] as UserRole[]).map(role => (
                <DropdownMenuCheckboxItem
                  key={role}
                  checked={demoRoles.includes(role)}
                  onCheckedChange={() => {
                    const newRoles = demoRoles.includes(role)
                      ? demoRoles.filter(r => r !== role)
                      : [...demoRoles, role];
                    if (newRoles.length > 0) {
                      setDemoRoles(newRoles);
                      checkPageAccess(newRoles);
                    }
                  }}
                >
                  <Badge variant="outline" className={`mr-2 ${roleColors[role]}`}>
                    {roleLabels[role]}
                  </Badge>
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <div className="px-2 py-2 flex items-center justify-between">
                <Label htmlFor="billing-admin" className="text-xs text-muted-foreground">
                  Billing + Admin Access
                </Label>
                <Switch
                  id="billing-admin"
                  checked={billingHasAdminAccess}
                  onCheckedChange={(checked) => {
                    setBillingHasAdminAccess(checked);
                  }}
                />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Current Roles Display */}
          <div className="hidden md:flex items-center gap-1">
            {demoRoles.slice(0, 2).map(role => (
              <Badge key={role} variant="outline" className={roleColors[role]}>
                {roleLabels[role]}
              </Badge>
            ))}
            {demoRoles.length > 2 && (
              <Badge variant="outline" className="badge-standard">
                +{demoRoles.length - 2}
              </Badge>
            )}
          </div>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <span className="hidden sm:inline text-sm">
                  {displayUser?.firstName} {displayUser?.lastName}
                </span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>{displayUser?.firstName} {displayUser?.lastName}</span>
                  <span className="text-xs text-muted-foreground font-normal">{displayUser?.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <User className="h-4 w-4 mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </>
  );
};
