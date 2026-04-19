import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, User, Subscription, SubscriptionProduct } from '@/contexts/AppContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  ListingPageHeader,
  SearchFilterCard,
  FilterField,
  PaginationControls,
} from '@/components/listing';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { Key, AlertTriangle, Check, Users, ChevronDown, ChevronUp, Minus, Plus, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const roleLabels: Record<string, string> = {
  owner: 'Account Owner',
  billing: 'Billing User',
  admin: 'Firm Admin',
  standard: 'Standard User',
};

type RemovalType = 'now' | 'eoy' | null;

export const LicensesPage = () => {
  const navigate = useNavigate();
  const {
    currentCompany,
    getCompanySubscriptions,
    getCompanyUsers,
    getAssignedLicenseCount,
    assignLicense,
    unassignLicense,
    updateProductLicenseCount,
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

  // Manage seats flyout state
  const [manageOpen, setManageOpen] = useState(false);
  const [manageSub, setManageSub] = useState<Subscription | null>(null);
  const [manageProd, setManageProd] = useState<SubscriptionProduct | null>(null);
  const [newSeatCount, setNewSeatCount] = useState(0);

  // Seat reduction modal
  const [reductionOpen, setReductionOpen] = useState(false);
  const [removals, setRemovals] = useState<Record<string, RemovalType>>({});

  const subscriptions = getCompanySubscriptions();
  const users = getCompanyUsers();
  const canModify = hasAccess(['owner', 'admin']);

  // Auto-select first sub/product if none selected
  if (subscriptions.length > 0 && !selectedSubId) {
    const first = subscriptions[0];
    if (first.products.length > 0) {
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

  // Manage seats
  const openManageSeats = (sub: Subscription, prod: SubscriptionProduct) => {
    setManageSub(sub);
    setManageProd(prod);
    setNewSeatCount(prod.licenseCount);
    setManageOpen(true);
  };

  const handleApplySeats = () => {
    if (!manageSub || !manageProd) return;
    const assigned = getAssignedLicenseCount(manageSub.id, manageProd.id);

    if (newSeatCount < assigned) {
      // Need to open reduction modal
      const assignedUsers = users.filter(u =>
        licenses.some(l => l.userId === u.id && l.subscriptionId === manageSub.id && l.productId === manageProd.id)
      );
      setRemovals({});
      setManageOpen(false);
      setReductionOpen(true);
      return;
    }

    updateProductLicenseCount(manageSub.id, manageProd.id, newSeatCount);
    toast({ title: 'Seats Updated', description: `${manageProd.name} updated to ${newSeatCount} seats.` });
    setManageOpen(false);
  };

  const manageSeatDelta = manageProd ? newSeatCount - manageProd.licenseCount : 0;
  const managePriceChange = manageProd ? manageSeatDelta * manageProd.pricePerLicense : 0;
  const manageAssigned = manageSub && manageProd ? getAssignedLicenseCount(manageSub.id, manageProd.id) : 0;

  // Reduction logic
  const assignedUsersForReduction = manageSub && manageProd
    ? users.filter(u => licenses.some(l => l.userId === u.id && l.subscriptionId === manageSub.id && l.productId === manageProd.id))
    : [];
  const requiredRemovals = manageProd ? manageAssigned - newSeatCount : 0;
  const selectedRemovalCount = Object.values(removals).filter(v => v !== null).length;

  const handleRemovalChange = (userId: string, type: RemovalType) => {
    setRemovals(prev => {
      const updated = { ...prev };
      if (updated[userId] === type) {
        updated[userId] = null;
      } else {
        updated[userId] = type;
      }
      return updated;
    });
  };

  const handleConfirmReduction = () => {
    if (selectedRemovalCount < requiredRemovals) return;
    if (!manageSub || !manageProd) return;

    // Unassign "now" users
    Object.entries(removals).forEach(([userId, type]) => {
      if (type === 'now') {
        unassignLicense(userId, manageSub.id, manageProd.id);
      }
    });

    updateProductLicenseCount(manageSub.id, manageProd.id, newSeatCount);
    toast({ title: 'Seats Reduced', description: `${manageProd.name} reduced to ${newSeatCount} seats.` });
    setReductionOpen(false);
  };

  // Aggregate summary across all subscriptions/products
  const totalSeats = subscriptions.reduce((a, s) => a + s.products.reduce((b, p) => b + p.licenseCount, 0), 0);
  const totalAssigned = subscriptions.reduce(
    (a, s) => a + s.products.reduce((b, p) => b + getAssignedLicenseCount(s.id, p.id), 0),
    0
  );
  const totalAvailable = totalSeats - totalAssigned;
  const productsWithOpenSeats = subscriptions.reduce(
    (a, s) => a + s.products.filter(p => p.licenseCount - getAssignedLicenseCount(s.id, p.id) > 0).length,
    0
  );

  const summaryCards = [
    { label: 'Total Seats', value: totalSeats, icon: Key, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Assigned Seats', value: totalAssigned, icon: Users, color: 'text-info', bg: 'bg-info/10' },
    { label: 'Available Seats', value: totalAvailable, icon: Check, color: 'text-success', bg: 'bg-success/10' },
    { label: 'Products with Open Seats', value: productsWithOpenSeats, icon: Settings, color: 'text-warning', bg: 'bg-warning/10' },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <ListingPageHeader
          title="License Assignments"
          description="Manage product seats, assigned users, and available licenses."
        />

        {/* Top summary cards */}
        <div className="grid gap-4 md:grid-cols-4">
          {summaryCards.map(s => (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold mt-1">{s.value}</p>
                </div>
                <div className={`h-10 w-10 rounded-lg ${s.bg} flex items-center justify-center`}>
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* License Assignments Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead className="text-center">Seats Assigned</TableHead>
                <TableHead className="text-center">Seats Available</TableHead>
                <TableHead>Renewal Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.flatMap(sub =>
                sub.products.map(prod => {
                  const assigned = getAssignedLicenseCount(sub.id, prod.id);
                  const avail = prod.licenseCount - assigned;
                  const isSelected = selectedSubId === sub.id && selectedProdId === prod.id;
                  return (
                    <TableRow
                      key={`${sub.id}-${prod.id}`}
                      className={cn('cursor-pointer', isSelected && 'bg-primary/5')}
                      onClick={() => selectProduct(sub.id, prod.id)}
                    >
                      <TableCell className="font-medium">{prod.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{sub.name} · {sub.planType}</TableCell>
                      <TableCell className="text-center font-medium">{assigned}/{prod.licenseCount}</TableCell>
                      <TableCell className="text-center">
                        <span className={cn('font-semibold', avail === 0 ? 'text-destructive' : 'text-success')}>
                          {avail}/{prod.licenseCount}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{new Date(sub.renewalDate).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={avail === 0 ? 'status-overdue' : 'status-active'}>
                          {avail === 0 ? 'Full' : 'Active'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {canModify && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); openManageSeats(sub, prod); }}
                          >
                            <Settings className="h-4 w-4 mr-1" />Manage
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>

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
                  <FilterField label="Assignment" value={assignedFilter}
                    onChange={(v) => { setAssignedFilter(v); setCurrentPage(1); }}
                    options={[
                      { value: 'all', label: 'All Users' },
                      { value: 'assigned', label: 'Assigned' },
                      { value: 'not-assigned', label: 'Unassigned' },
                    ]}
                  />
                  <FilterField label="Status" value={statusFilter}
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

      {/* License Limit Reached */}
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

      {/* Manage Seats Flyout */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Seats</DialogTitle>
            <DialogDescription>
              {manageProd?.name} &middot; {manageSub?.name} &middot; {manageSub?.planType}
            </DialogDescription>
          </DialogHeader>
          {manageProd && manageSub && (
            <div className="space-y-6">
              {/* Seat counter */}
              <div className="flex items-center justify-center gap-4">
                <Button variant="outline" size="icon" onClick={() => setNewSeatCount(Math.max(1, newSeatCount - 1))} disabled={newSeatCount <= 1}>
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number" min={1} max={500} value={newSeatCount}
                  onChange={(e) => setNewSeatCount(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
                  className="w-24 text-center text-lg font-semibold"
                />
                <Button variant="outline" size="icon" onClick={() => setNewSeatCount(Math.min(500, newSeatCount + 1))}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Summary */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Current seats</span><span>{manageProd.licenseCount}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">New seats</span><span>{newSeatCount}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Currently assigned</span><span>{manageAssigned}</span></div>
                {manageSeatDelta !== 0 && (
                  <>
                    <div className="border-t pt-2 flex justify-between font-medium">
                      <span>Seats delta</span>
                      <span className={manageSeatDelta > 0 ? 'text-success' : 'text-destructive'}>
                        {manageSeatDelta > 0 ? '+' : ''}{manageSeatDelta}
                      </span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Price change</span>
                      <span className={managePriceChange > 0 ? 'text-destructive' : 'text-success'}>
                        {managePriceChange > 0 ? '+' : ''}${managePriceChange.toLocaleString()}/year
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Per-seat annual cost</span>
                      <span>${manageProd.pricePerLicense}/seat</span>
                    </div>
                  </>
                )}
              </div>

              {/* Assigned users list */}
              <div>
                <p className="text-sm font-medium mb-2">{manageAssigned} of {manageProd.licenseCount} seats assigned</p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {users.filter(u => licenses.some(l => l.userId === u.id && l.subscriptionId === manageSub.id && l.productId === manageProd.id)).map(u => (
                    <div key={u.id} className="flex items-center gap-3 p-2 bg-muted/30 rounded-md">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-medium text-primary">{u.firstName.charAt(0)}{u.lastName.charAt(0)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{u.firstName} {u.lastName}</div>
                        <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                      </div>
                      <Badge variant="outline" className={`text-xs ${u.status === 'active' ? 'status-active' : 'status-inactive'}`}>
                        {u.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {newSeatCount < manageAssigned && (
                <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
                  <p className="text-sm">
                    Reducing to {newSeatCount} seats requires removing {manageAssigned - newSeatCount} assignment(s).
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageOpen(false)}>Cancel</Button>
            <Button onClick={handleApplySeats} disabled={newSeatCount === manageProd?.licenseCount}>
              {manageProd && newSeatCount < manageAssigned ? 'Select Removals' : 'Apply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Seat Reduction / Required Removals Modal */}
      <Dialog open={reductionOpen} onOpenChange={setReductionOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Seats – Required Removals</DialogTitle>
            <DialogDescription>
              {manageProd?.name} &middot; Reducing from {manageProd?.licenseCount} to {newSeatCount} seats
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Licenses already paid for last through the end of the year. Select users to remove now or let their access expire at end of year.
            </p>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead className="text-center">Remove Now</TableHead>
                  <TableHead className="text-center">Expire End of Year</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignedUsersForReduction.map(u => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-medium text-primary">{u.firstName.charAt(0)}{u.lastName.charAt(0)}</span>
                        </div>
                        <div>
                          <div className="text-sm font-medium">{u.firstName} {u.lastName}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <input
                        type="radio"
                        name={`removal-${u.id}`}
                        checked={removals[u.id] === 'now'}
                        onChange={() => handleRemovalChange(u.id, 'now')}
                        className="h-4 w-4 accent-destructive"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <input
                        type="radio"
                        name={`removal-${u.id}`}
                        checked={removals[u.id] === 'eoy'}
                        onChange={() => handleRemovalChange(u.id, 'eoy')}
                        className="h-4 w-4"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <p className={cn(
              'text-sm font-medium',
              selectedRemovalCount >= requiredRemovals ? 'text-success' : 'text-muted-foreground'
            )}>
              {selectedRemovalCount} of {requiredRemovals} required removals selected
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReductionOpen(false); setManageOpen(true); }}>Back</Button>
            <Button onClick={handleConfirmReduction} disabled={selectedRemovalCount < requiredRemovals}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};
