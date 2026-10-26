import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useApp, Subscription, SubscriptionProduct, ROLE_LABELS, ROLE_BADGE_CLASS, PRODUCT_CATALOG,
} from '@/contexts/AppContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Building2, LifeBuoy, ExternalLink, Download, ChevronDown, UserPlus, Mail, Phone, ArrowRight, Database,
} from 'lucide-react';
import { openProfileDrawer } from '@/lib/profileDrawer';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import { OverdueAlertBanner } from '@/components/dashboard/OverdueAlertBanner';
import { ManageLicensesDrawer } from '@/components/subscriptions/QuoteDialogs';

export const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    currentUser, currentCompany, hasAccess, licenses,
    getCompanySubscriptions, getCompanyUsers, getAssignedLicenseCount,
    getUserDataNetAccess, getDataNetUpdates,
  } = useApp();

  const [manageOpen, setManageOpen] = useState(false);
  const [manageSub, setManageSub] = useState<Subscription | null>(null);
  const [manageProd, setManageProd] = useState<SubscriptionProduct | null>(null);

  const openManageSeats = (sub: Subscription, prod: SubscriptionProduct) => {
    setManageSub(sub);
    setManageProd(prod);
    setManageOpen(true);
  };

  const isOwner = hasAccess(['account_owner']);
  const isBilling = hasAccess(['billing_admin']);
  const isLicenseAdmin = hasAccess(['license_admin']);
  const canManageLicenses = isOwner || isBilling || isLicenseAdmin;

  const firstName = currentUser?.firstName || 'Customer';
  const subscriptions = getCompanySubscriptions();
  const activeSub = subscriptions.find(s => s.status === 'active');
  const firmStatusLabel = activeSub
    ? 'Active'
    : subscriptions[0]?.status
      ? subscriptions[0].status.charAt(0).toUpperCase() + subscriptions[0].status.slice(1)
      : null;

  const companyUsersForContact = getCompanyUsers();
  const primaryContact = currentCompany?.mainContactUserId
    ? companyUsersForContact.find(u => u.id === currentCompany.mainContactUserId)
    : companyUsersForContact.find(u => u.status === 'active' && u.roles.includes('account_owner'));

  const addressLine = [
    currentCompany?.address?.line1,
    currentCompany?.address?.city,
    [currentCompany?.address?.state, currentCompany?.address?.postalCode].filter(Boolean).join(' '),
    currentCompany?.address?.country,
  ].filter(s => s && s.trim()).join(', ') || '—';

  // ---- Product Access (Section 3 rebuild) ----
  const seatProducts = subscriptions
    .filter(s => s.status === 'active')
    .flatMap(sub => sub.products.map(prod => ({ sub, prod })));

  const catalogFor = (name: string) => PRODUCT_CATALOG.find(c => c.name === name);

  const hasPersonalAccess = (sub: Subscription, prod: SubscriptionProduct): boolean => {
    if (prod.name === 'DataNet') return getUserDataNetAccess();
    if (!currentUser) return false;
    return licenses.some(l =>
      l.userId === currentUser.id && l.subscriptionId === sub.id && l.productId === prod.id && !l.deactivatedAt);
  };

  const runProductAction = (sub: Subscription, prod: SubscriptionProduct, action: () => void) => {
    if (!hasPersonalAccess(sub, prod) && isOwner) {
      toast({
        title: 'No personal license assigned',
        description: `You don't have a seat of ${prod.name} assigned to yourself. Opening in preview — assign yourself a seat from Manage Licenses to use it normally.`,
      });
    }
    action();
  };

  const handleOpenProduct = (sub: Subscription, prod: SubscriptionProduct) => {
    runProductAction(sub, prod, () => {
      if (prod.name === 'DataNet') {
        navigate('/datanet');
        return;
      }
      toast({ title: `Opening ${prod.name}`, description: 'A new tab would open here in production.' });
    });
  };

  const handleDownloadProduct = (sub: Subscription, prod: SubscriptionProduct) => {
    runProductAction(sub, prod, () => {
      toast({ title: 'Download started', description: `Downloading ${prod.name}...` });
    });
  };

  // ---- Account Contacts (Section 5/8 visibility rule) ----
  const isElevated = (roles: string[]) => roles.some(r => r !== 'registered_contact');
  const contacts = getCompanyUsers()
    .filter(u => u.status === 'active' && u.id !== currentUser?.id)
    .filter(u => canManageLicenses || isElevated(u.roles));

  const handleEmail = (email: string) => {
    window.location.href = `mailto:${email}`;
  };
  const handleCall = (phone?: string) => {
    if (phone) window.location.href = `tel:${phone}`;
    else toast({ title: 'No phone number on file for this contact.' });
  };

  // ---- DataNet card ----
  const dataNetUpdates = getDataNetUpdates();
  const latestUpdate = dataNetUpdates[0];

  return (
    <MainLayout>
      <PageHeader
        title={`Welcome back, ${firstName}!`}
        description="Here's your dashboard overview."
      />
      <div className="space-y-4">
        <OverdueAlertBanner />

        {/* Row 1: Company/Firm Info + Contact Support */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  Company/Firm Info
                </CardTitle>
                {firmStatusLabel && (
                  <Badge className="bg-success/10 text-success border-success/20 hover:bg-success/10">
                    {firmStatusLabel}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Your current account and organization details.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Company/Firm Name</div>
                  <div className="font-medium mt-0.5">{currentCompany?.name || '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Primary Contact</div>
                  <div className="font-medium mt-0.5">
                    {primaryContact ? `${primaryContact.firstName} ${primaryContact.lastName}` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Address</div>
                  <div className="font-medium mt-0.5">{addressLine}</div>
                </div>
              </div>
              <Button variant="outline" className="w-full" onClick={() => openProfileDrawer('profile')}>
                View Full Firm Profile
              </Button>
            </CardContent>
          </Card>

          {/* Contact Support — new panel type, no confirmed role restriction yet (see report) */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <LifeBuoy className="h-4 w-4 text-primary" />
                  Contact Support
                </CardTitle>
                <Badge variant="outline" className="text-muted-foreground">Upcoming</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Need help? Our team is ready to assist.</p>
            </CardHeader>
            <CardContent className="flex items-center justify-center h-full min-h-[100px]">
              <p className="text-sm text-muted-foreground">Support ticketing is coming soon.</p>
            </CardContent>
          </Card>
        </div>

        {/* Row 2: Product Access */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Product Access</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  View and manage your products, subscriptions, seats, and access downloads or open products.
                </p>
              </div>
              <Button variant="link" className="gap-1 text-primary" onClick={() => navigate('/subscriptions')}>
                View All Products <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {seatProducts.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No active products yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Subscription</TableHead>
                    <TableHead>Seat Usage</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {seatProducts.map(({ sub, prod }) => {
                    const isDataNet = prod.name === 'DataNet';
                    const catalog = catalogFor(prod.name);
                    const isDesktop = catalog?.type === 'desktop';
                    const assigned = isDataNet ? 0 : getAssignedLicenseCount(sub.id, prod.id);
                    const pct = !isDataNet && prod.licenseCount > 0 ? Math.round((assigned / prod.licenseCount) * 100) : 0;
                    const available = Math.max(0, prod.licenseCount - assigned);
                    const canUse = hasPersonalAccess(sub, prod) || isOwner;

                    return (
                      <TableRow key={`${sub.id}-${prod.id}`}>
                        <TableCell className="font-medium">{prod.name}</TableCell>
                        <TableCell>
                          <div className="text-sm">{sub.billingFrequency === 'annual' ? 'Annual Plan' : 'Monthly Plan'}</div>
                          <div className="text-xs text-muted-foreground">
                            Renews {new Date(sub.renewalDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[160px]">
                          {isDataNet ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <>
                              <div className="text-xs text-muted-foreground mb-1">
                                {assigned} of {prod.licenseCount} seats are occupied
                              </div>
                              <Progress value={pct} className="h-1.5" />
                            </>
                          )}
                        </TableCell>
                        <TableCell>
                          {isDataNet ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className="text-success text-sm font-medium">{available} Seats Available</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            {!isDataNet && canManageLicenses && (
                              <Button size="sm" variant="outline" onClick={() => openManageSeats(sub, prod)}>
                                Manage
                              </Button>
                            )}
                            {isDataNet || !isDesktop ? (
                              canUse ? (
                                <Button size="sm" onClick={() => handleOpenProduct(sub, prod)}>
                                  <ExternalLink className="h-3.5 w-3.5 mr-1" />Open
                                </Button>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span>
                                      <Button size="sm" disabled className="pointer-events-none">
                                        <ExternalLink className="h-3.5 w-3.5 mr-1" />Open
                                      </Button>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>You don't have a license assigned for this product.</TooltipContent>
                                </Tooltip>
                              )
                            ) : canUse ? (
                              <div className="flex">
                                <Button size="sm" className="rounded-r-none" onClick={() => handleDownloadProduct(sub, prod)}>
                                  <Download className="h-3.5 w-3.5 mr-1" />Download
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="sm" className="rounded-l-none border-l border-primary-foreground/20 px-2">
                                      <ChevronDown className="h-3 w-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => navigate('/downloads')}>
                                      View all formats
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Button size="sm" disabled className="pointer-events-none">
                                      <Download className="h-3.5 w-3.5 mr-1" />Download
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>You don't have a license assigned for this product.</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Row 3: Account Contacts + DataNet */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Account Contacts</CardTitle>
                <Button variant="link" className="gap-1 text-primary" onClick={() => navigate('/users')}>
                  View All Contact Account <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {contacts.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No contacts to show.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map(u => {
                      const elevatedRoles = u.roles.filter(r => r !== 'registered_contact');
                      return (
                        <TableRow key={u.id}>
                          <TableCell>
                            <div className="font-medium">{u.firstName} {u.lastName}</div>
                            <div className="text-xs text-muted-foreground">@{u.username}</div>
                          </TableCell>
                          <TableCell>
                            {elevatedRoles.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {elevatedRoles.map(r => (
                                  <Badge key={r} variant="outline" className={ROLE_BADGE_CLASS[r]}>
                                    {ROLE_LABELS[r]}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              <Button size="sm" variant="outline" onClick={() => handleEmail(u.email)}>
                                <Mail className="h-3.5 w-3.5 mr-1" />Email
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleCall(u.phone)}>
                                <Phone className="h-3.5 w-3.5 mr-1" />Call
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
              {canManageLicenses && (
                <div className="p-4 border-t">
                  <Button variant="outline" className="w-full" onClick={() => navigate('/users')}>
                    <UserPlus className="h-4 w-4 mr-2" />Invite Contact
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* DataNet — company-level, same for every role */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                DataNet
              </CardTitle>
              <p className="text-xs text-muted-foreground">Access the latest industry data and alerts from DataNet.</p>
            </CardHeader>
            <CardContent className="flex flex-col justify-between h-full gap-4">
              {latestUpdate ? (
                <div className="text-sm">
                  <div className="font-medium">{latestUpdate.monthName} {latestUpdate.year} — {latestUpdate.title}</div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{latestUpdate.summary}</p>
                </div>
              ) : (
                <div className="flex items-center justify-center min-h-[80px]">
                  <p className="text-sm text-muted-foreground">No DataNet editions published yet</p>
                </div>
              )}
              <Button variant="outline" className="w-full" onClick={() => navigate('/datanet')}>
                View All DataNet
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <ManageLicensesDrawer
        open={manageOpen}
        onOpenChange={setManageOpen}
        subscription={manageSub}
        product={manageProd}
      />
    </MainLayout>
  );
};
