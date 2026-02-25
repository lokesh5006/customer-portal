import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, User, Subscription, SubscriptionProduct } from '@/contexts/AppContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  ListingPageHeader,
  SearchFilterCard,
  FilterField,
  PaginationControls,
} from '@/components/listing';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { Key, AlertTriangle, Check, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const roleLabels: Record<string, string> = {
  owner: 'Account Owner',
  billing: 'Billing User',
  admin: 'Firm Admin',
  standard: 'Standard User',
};

export const LicensesPage = () => {
  const navigate = useNavigate();
  const {
    currentCompany,
    getCompanySubscriptions,
    getCompanyUsers,
    getAssignedLicenseCount,
    assignLicense,
    unassignLicense,
    licenses,
    hasAccess,
  } = useApp();
  const { toast } = useToast();

  const [selectedSubId, setSelectedSubId] = useState<string>('');
  const [selectedProdId, setSelectedProdId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [assignedFilter, setAssignedFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedSubs, setExpandedSubs] = useState<string[]>([]);
  const [limitReachedOpen, setLimitReachedOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const subscriptions = getCompanySubscriptions();
  const users = getCompanyUsers();
  const canModify = hasAccess(['owner', 'admin']);

  // Auto-select first sub/product if none selected
  if (subscriptions.length > 0 && !selectedSubId) {
    const first = subscriptions[0];
    if (first.products.length > 0) {
      // Set in next tick to avoid setState during render
      setTimeout(() => {
        setSelectedSubId(first.id);
        setSelectedProdId(first.products[0].id);
        setExpandedSubs([first.id]);
      }, 0);
    }
  }

  const currentSub = subscriptions.find(s => s.id === selectedSubId);
  const currentProduct = currentSub?.products.find(p => p.id === selectedProdId);
  const purchasedLicenses = currentProduct?.licenseCount || 0;
  const assignedLicenses = selectedSubId && selectedProdId ? getAssignedLicenseCount(selectedSubId, selectedProdId) : 0;
  const availableLicenses = purchasedLicenses - assignedLicenses;

  const isAssigned = (userId: string): boolean => {
    return licenses.some(l => l.userId === userId && l.subscriptionId === selectedSubId && l.productId === selectedProdId);
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const userAssigned = isAssigned(user.id);
    const matchesAssigned =
      assignedFilter === 'all' ||
      (assignedFilter === 'assigned' && userAssigned) ||
      (assignedFilter === 'not-assigned' && !userAssigned);
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    return matchesSearch && matchesAssigned && matchesStatus;
  });

  const totalPages = Math.ceil(filteredUsers.length / pageSize);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleToggleLicense = (user: User) => {
    if (isAssigned(user.id)) {
      unassignLicense(user.id, selectedSubId, selectedProdId);
      toast({ title: 'License Unassigned', description: `License removed from ${user.firstName} ${user.lastName}` });
    } else {
      if (availableLicenses <= 0) {
        setLimitReachedOpen(true);
        return;
      }
      const success = assignLicense(user.id, selectedSubId, selectedProdId);
      if (success) {
        toast({ title: 'License Assigned', description: `License assigned to ${user.firstName} ${user.lastName}` });
      }
    }
  };

  const selectProduct = (subId: string, prodId: string) => {
    setSelectedSubId(subId);
    setSelectedProdId(prodId);
    setCurrentPage(1);
  };

  const toggleExpandSub = (subId: string) => {
    setExpandedSubs(prev => prev.includes(subId) ? prev.filter(id => id !== subId) : [...prev, subId]);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <ListingPageHeader
          title="Licenses"
          description={`Manage license assignments for ${currentCompany?.name}`}
        />

        {/* Subscription → Product Hierarchy */}
        <div className="space-y-2">
          {subscriptions.map(sub => (
            <Card key={sub.id}>
              <Collapsible open={expandedSubs.includes(sub.id)} onOpenChange={() => toggleExpandSub(sub.id)}>
                <CollapsibleTrigger className="w-full">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{sub.name}</span>
                      <Badge variant="outline" className="text-xs">{sub.products.length} products</Badge>
                    </div>
                    {expandedSubs.includes(sub.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CardContent>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-3 pb-3 space-y-1">
                    {sub.products.map(prod => {
                      const assigned = getAssignedLicenseCount(sub.id, prod.id);
                      const isSelected = selectedSubId === sub.id && selectedProdId === prod.id;
                      return (
                        <div
                          key={prod.id}
                          className={cn(
                            'flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors',
                            isSelected ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted/50'
                          )}
                          onClick={() => selectProduct(sub.id, prod.id)}
                        >
                          <span className="text-sm font-medium">{prod.name}</span>
                          <span className="text-sm text-muted-foreground">{assigned}/{prod.licenseCount} assigned</span>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </div>

        {currentProduct && (
          <>
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div><p className="text-sm text-muted-foreground">Purchased</p><p className="text-2xl font-bold">{purchasedLicenses}</p></div>
                    <Key className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div><p className="text-sm text-muted-foreground">Assigned</p><p className="text-2xl font-bold">{assignedLicenses}</p></div>
                    <Users className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
              <Card className={cn(availableLicenses === 0 && 'border-warning')}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div><p className="text-sm text-muted-foreground">Available</p><p className="text-2xl font-bold">{availableLicenses}</p></div>
                    {availableLicenses === 0 ? <AlertTriangle className="h-8 w-8 text-warning" /> : <Check className="h-8 w-8 text-success" />}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <SearchFilterCard
              searchValue={searchQuery}
              onSearchChange={(v) => { setSearchQuery(v); setCurrentPage(1); }}
              searchPlaceholder="Search by name or email..."
              onReset={() => { setSearchQuery(''); setAssignedFilter('all'); setStatusFilter('all'); setCurrentPage(1); }}
              filters={
                <>
                  <FilterField label="License Status" value={assignedFilter}
                    onChange={(v) => { setAssignedFilter(v); setCurrentPage(1); }}
                    options={[
                      { value: 'all', label: 'All Users' },
                      { value: 'assigned', label: 'Assigned' },
                      { value: 'not-assigned', label: 'Unassigned' },
                    ]}
                  />
                  <FilterField label="User Status" value={statusFilter}
                    onChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}
                    options={[
                      { value: 'all', label: 'All Status' },
                      { value: 'active', label: 'Active' },
                      { value: 'inactive', label: 'Inactive' },
                    ]}
                  />
                </>
              }
            />

            {/* Users Table */}
            <div>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">License</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedUsers.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No users found.</TableCell></TableRow>
                    ) : (
                      paginatedUsers.map(user => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-xs font-medium text-primary">{user.firstName.charAt(0)}{user.lastName.charAt(0)}</span>
                              </div>
                              <span className="font-medium">{user.firstName} {user.lastName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{user.email}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {user.roles.map(role => (
                                <Badge key={role} variant="outline" className="text-xs">{roleLabels[role]}</Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={user.status === 'active' ? 'status-active' : 'status-inactive'}>
                              {user.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={isAssigned(user.id)}
                              onCheckedChange={() => handleToggleLicense(user)}
                              disabled={user.status === 'inactive'}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
              <Card className="rounded-t-none border-t-0">
                <PaginationControls
                  currentPage={currentPage} totalPages={totalPages} pageSize={pageSize}
                  totalRecords={filteredUsers.length} onPageChange={setCurrentPage}
                  onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
                />
              </Card>
            </div>
          </>
        )}
      </div>

      <Dialog open={limitReachedOpen} onOpenChange={setLimitReachedOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />License Limit Reached
            </DialogTitle>
            <DialogDescription>You have reached your license limit ({purchasedLicenses}/{purchasedLicenses}).</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">To assign more licenses, you need to either:</p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>Unassign licenses from other users</li>
              <li>Add more licenses to your subscription</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLimitReachedOpen(false)}>Close</Button>
            {canModify && (
              <Button onClick={() => { setLimitReachedOpen(false); navigate('/subscriptions'); }}>Add More Licenses</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};
