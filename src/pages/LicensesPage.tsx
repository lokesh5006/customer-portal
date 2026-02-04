import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, User } from '@/contexts/AppContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  ListingPageHeader,
  SearchFilterCard,
  FilterField,
  DataTable,
  DataTableColumn,
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
import { useToast } from '@/hooks/use-toast';
import {
  Key,
  AlertTriangle,
  Check,
  Users,
} from 'lucide-react';
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

  // Filters
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [assignedFilter, setAssignedFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [utilizationFilter, setUtilizationFilter] = useState<string>('all');
  const [assignedFrom, setAssignedFrom] = useState<Date>();
  const [assignedTo, setAssignedTo] = useState<Date>();

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modal
  const [limitReachedOpen, setLimitReachedOpen] = useState(false);

  const subscriptions = getCompanySubscriptions();
  const users = getCompanyUsers();

  useEffect(() => {
    if (subscriptions.length > 0 && !selectedProduct) {
      setSelectedProduct(subscriptions[0].product);
    }
  }, [subscriptions, selectedProduct]);

  const currentSubscription = subscriptions.find(s => s.product === selectedProduct);
  const purchasedSeats = currentSubscription?.purchasedSeats || 0;
  const assignedSeats = getAssignedLicenseCount(selectedProduct);
  const availableSeats = purchasedSeats - assignedSeats;

  const isAssigned = (userId: string): boolean => {
    return licenses.some(l => l.userId === userId && l.productId === selectedProduct);
  };

  const getLicenseAssignedDate = (userId: string): Date | null => {
    const license = licenses.find(l => l.userId === userId && l.productId === selectedProduct);
    return license ? new Date(license.assignedAt) : null;
  };

  // Filter users
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

    let matchesAssignedDate = true;
    if (assignedFilter === 'assigned' || assignedFilter === 'all') {
      const assignedDate = getLicenseAssignedDate(user.id);
      if (assignedFrom && assignedDate) {
        matchesAssignedDate = assignedDate >= assignedFrom;
      }
      if (assignedTo && assignedDate && matchesAssignedDate) {
        matchesAssignedDate = assignedDate <= assignedTo;
      }
    }
    
    return matchesSearch && matchesAssigned && matchesStatus && matchesAssignedDate;
  });

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / pageSize);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const resetFilters = () => {
    setSearchQuery('');
    setAssignedFilter('all');
    setStatusFilter('all');
    setUtilizationFilter('all');
    setAssignedFrom(undefined);
    setAssignedTo(undefined);
    setCurrentPage(1);
  };

  const handleToggleLicense = (user: User) => {
    if (isAssigned(user.id)) {
      unassignLicense(user.id, selectedProduct);
      toast({
        title: 'License Unassigned',
        description: `License removed from ${user.firstName} ${user.lastName}`,
      });
    } else {
      if (availableSeats <= 0) {
        setLimitReachedOpen(true);
        return;
      }
      const success = assignLicense(user.id, selectedProduct);
      if (success) {
        toast({
          title: 'License Assigned',
          description: `License assigned to ${user.firstName} ${user.lastName}`,
        });
      }
    }
  };

  const canModify = hasAccess(['owner', 'billing']);

  const columns: DataTableColumn<User>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (user) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-xs font-medium text-primary">
              {user.firstName.charAt(0)}{user.lastName.charAt(0)}
            </span>
          </div>
          <span className="font-medium">
            {user.firstName} {user.lastName}
          </span>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (user) => (
        <span className="text-muted-foreground">{user.email}</span>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (user) => (
        <div className="flex flex-wrap gap-1">
          {user.roles.map(role => (
            <Badge key={role} variant="outline" className="text-xs">
              {roleLabels[role]}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (user) => (
        <Badge 
          variant="outline" 
          className={user.status === 'active' ? 'status-active' : 'status-inactive'}
        >
          {user.status}
        </Badge>
      ),
    },
    {
      key: 'license',
      header: 'License Assigned',
      className: 'text-center',
      render: (user) => {
        const assigned = isAssigned(user.id);
        return (
          <Switch
            checked={assigned}
            onCheckedChange={() => handleToggleLicense(user)}
            disabled={user.status === 'inactive'}
          />
        );
      },
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <ListingPageHeader
          title="Licenses"
          description={`Manage license assignments for ${currentCompany?.name}`}
        />

        {/* Product Selection */}
        {subscriptions.length > 1 && (
          <div className="flex gap-2">
            {subscriptions.map(sub => (
              <Button
                key={sub.id}
                variant={selectedProduct === sub.product ? 'default' : 'outline'}
                onClick={() => setSelectedProduct(sub.product)}
              >
                {sub.product}
              </Button>
            ))}
          </div>
        )}

        {/* License Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Purchased Seats</p>
                  <p className="text-2xl font-bold">{purchasedSeats}</p>
                </div>
                <Key className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Assigned Seats</p>
                  <p className="text-2xl font-bold">{assignedSeats}</p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card className={cn(availableSeats === 0 && 'border-warning')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Available</p>
                  <p className="text-2xl font-bold">{availableSeats}</p>
                </div>
                {availableSeats === 0 ? (
                  <AlertTriangle className="h-8 w-8 text-warning" />
                ) : (
                  <Check className="h-8 w-8 text-success" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filters */}
        <SearchFilterCard
          searchValue={searchQuery}
          onSearchChange={(v) => { setSearchQuery(v); setCurrentPage(1); }}
          searchPlaceholder="Search by name or email..."
          onReset={resetFilters}
          filters={
            <>
              <FilterField
                label="License Status"
                value={assignedFilter}
                onChange={(v) => { setAssignedFilter(v); setCurrentPage(1); }}
                options={[
                  { value: 'all', label: 'All Users' },
                  { value: 'assigned', label: 'Assigned' },
                  { value: 'not-assigned', label: 'Unassigned' },
                ]}
              />
              <FilterField
                label="User Status"
                value={statusFilter}
                onChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}
                options={[
                  { value: 'all', label: 'All Status' },
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
              />
              <FilterField
                label="Utilization"
                value={utilizationFilter}
                onChange={(v) => { setUtilizationFilter(v); setCurrentPage(1); }}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'available', label: 'Available' },
                  { value: 'fully-used', label: 'Fully Used' },
                ]}
              />
              <FilterField
                label="Assignment"
                type="dateRange"
                dateFromValue={assignedFrom}
                dateToValue={assignedTo}
                onDateFromChange={(d) => { setAssignedFrom(d); setCurrentPage(1); }}
                onDateToChange={(d) => { setAssignedTo(d); setCurrentPage(1); }}
              />
            </>
          }
        />

        {/* Data Table */}
        <div>
          <DataTable
            columns={columns}
            data={paginatedUsers}
            keyExtractor={(user) => user.id}
            emptyMessage="No users found matching your criteria."
          />
          <Card className="rounded-t-none border-t-0">
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalRecords={filteredUsers.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
            />
          </Card>
        </div>
      </div>

      {/* License Limit Reached Modal */}
      <Dialog open={limitReachedOpen} onOpenChange={setLimitReachedOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              License Limit Reached
            </DialogTitle>
            <DialogDescription>
              You have reached your license limit ({purchasedSeats}/{purchasedSeats}).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              To assign more licenses, you need to either:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>Unassign licenses from other users</li>
              <li>Add more licenses to your subscription</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLimitReachedOpen(false)}>
              Close
            </Button>
            {canModify && (
              <Button onClick={() => {
                setLimitReachedOpen(false);
                navigate('/subscriptions');
              }}>
                Add More Licenses
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};
