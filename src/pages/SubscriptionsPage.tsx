import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, Subscription } from '@/contexts/AppContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  CreditCard,
  Eye,
  Edit,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Check,
  Minus,
  Plus,
  ShoppingCart,
} from 'lucide-react';

export const SubscriptionsPage = () => {
  const navigate = useNavigate();
  const {
    currentCompany,
    getCompanySubscriptions,
    getAssignedLicenseCount,
    updateSubscriptionSeats,
    hasAccess,
  } = useApp();
  const { toast } = useToast();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [billingFilter, setBillingFilter] = useState<string>('all');
  const [renewalFrom, setRenewalFrom] = useState<Date>();
  const [renewalTo, setRenewalTo] = useState<Date>();

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modals
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [modifyOpen, setModifyOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [newSeatCount, setNewSeatCount] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');

  const subscriptions = getCompanySubscriptions();
  const canModify = hasAccess(['owner', 'billing']);

  // Filter subscriptions
  const filteredSubscriptions = subscriptions.filter(sub => {
    const matchesSearch = sub.product.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;
    const matchesBilling = billingFilter === 'all' || sub.term === billingFilter;

    let matchesRenewal = true;
    if (renewalFrom) {
      matchesRenewal = new Date(sub.renewalDate) >= renewalFrom;
    }
    if (renewalTo && matchesRenewal) {
      matchesRenewal = new Date(sub.renewalDate) <= renewalTo;
    }

    return matchesSearch && matchesStatus && matchesBilling && matchesRenewal;
  });

  // Pagination
  const totalPages = Math.ceil(filteredSubscriptions.length / pageSize);
  const paginatedSubscriptions = filteredSubscriptions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setBillingFilter('all');
    setRenewalFrom(undefined);
    setRenewalTo(undefined);
    setCurrentPage(1);
  };

  const openDetails = (sub: Subscription) => {
    setSelectedSubscription(sub);
    setDetailsOpen(true);
  };

  const openModify = (sub: Subscription) => {
    setSelectedSubscription(sub);
    setNewSeatCount(sub.purchasedSeats);
    setModifyOpen(true);
  };

  const handleModifySeats = () => {
    if (!selectedSubscription) return;

    const assignedCount = getAssignedLicenseCount(selectedSubscription.product);
    
    if (newSeatCount < assignedCount) {
      navigate('/licenses/reduce', { 
        state: { 
          subscriptionId: selectedSubscription.id,
          newSeatCount,
          currentSeats: selectedSubscription.purchasedSeats,
          assignedCount,
          product: selectedSubscription.product,
        } 
      });
      setModifyOpen(false);
      return;
    }

    setModifyOpen(false);
    setPaymentOpen(true);
  };

  const handlePayment = async () => {
    setPaymentStatus('processing');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (Math.random() > 0.1) {
      setPaymentStatus('success');
      
      if (selectedSubscription) {
        updateSubscriptionSeats(selectedSubscription.id, newSeatCount);
      }
      
      toast({
        title: 'Subscription Updated',
        description: `License count changed to ${newSeatCount} seats.`,
      });
      
      setTimeout(() => {
        setPaymentOpen(false);
        setPaymentStatus('idle');
        navigate('/licenses');
      }, 1500);
    } else {
      setPaymentStatus('error');
    }
  };

  const getSeatDifference = () => {
    if (!selectedSubscription) return 0;
    return newSeatCount - selectedSubscription.purchasedSeats;
  };

  const getPriceChange = () => {
    const diff = getSeatDifference();
    return diff * 299;
  };

  const columns: DataTableColumn<Subscription>[] = [
    {
      key: 'product',
      header: 'Product',
      render: (sub) => <span className="font-medium">{sub.product}</span>,
    },
    {
      key: 'term',
      header: 'Term',
      render: (sub) => <span className="capitalize">{sub.term}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (sub) => (
        <Badge variant="outline" className="status-active">
          {sub.status}
        </Badge>
      ),
    },
    {
      key: 'renewalDate',
      header: 'Renewal Date',
      render: (sub) => new Date(sub.renewalDate).toLocaleDateString(),
    },
    {
      key: 'purchasedSeats',
      header: 'Purchased Seats',
      render: (sub) => sub.purchasedSeats,
    },
    {
      key: 'assigned',
      header: 'Assigned',
      render: (sub) => {
        const assignedCount = getAssignedLicenseCount(sub.product);
        return `${assignedCount} / ${sub.purchasedSeats}`;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (sub) => (
        <div className="flex justify-end gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => openDetails(sub)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {canModify && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => openModify(sub)}
            >
              <Edit className="h-4 w-4 mr-1" />
              Modify
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <ListingPageHeader
          title="Subscriptions"
          description={`Manage subscriptions for ${currentCompany?.name}`}
          primaryAction={
            canModify && (
              <Button onClick={() => navigate('/signup')}>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Buy Subscription
              </Button>
            )
          }
        />

        {/* Search & Filters */}
        <SearchFilterCard
          searchValue={searchQuery}
          onSearchChange={(v) => { setSearchQuery(v); setCurrentPage(1); }}
          searchPlaceholder="Search by product name..."
          onReset={resetFilters}
          filters={
            <>
              <FilterField
                label="Status"
                value={statusFilter}
                onChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}
                options={[
                  { value: 'all', label: 'All Status' },
                  { value: 'active', label: 'Active' },
                  { value: 'expiring', label: 'Expiring' },
                  { value: 'cancelled', label: 'Cancelled' },
                ]}
              />
              <FilterField
                label="Billing Frequency"
                value={billingFilter}
                onChange={(v) => { setBillingFilter(v); setCurrentPage(1); }}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'annual', label: 'Annual' },
                  { value: 'monthly', label: 'Monthly' },
                ]}
              />
              <FilterField
                label="Renewal"
                type="dateRange"
                dateFromValue={renewalFrom}
                dateToValue={renewalTo}
                onDateFromChange={(d) => { setRenewalFrom(d); setCurrentPage(1); }}
                onDateToChange={(d) => { setRenewalTo(d); setCurrentPage(1); }}
              />
            </>
          }
        />

        {/* Data Table */}
        {subscriptions.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Subscriptions</h3>
              <p className="text-muted-foreground mb-4">
                You don't have any active subscriptions yet.
              </p>
              <Button onClick={() => navigate('/signup')}>
                Get Started
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div>
            <DataTable
              columns={columns}
              data={paginatedSubscriptions}
              keyExtractor={(sub) => sub.id}
              emptyMessage="No subscriptions found matching your criteria."
            />
            <Card className="rounded-t-none border-t-0">
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalRecords={filteredSubscriptions.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
              />
            </Card>
          </div>
        )}
      </div>

      {/* Subscription Details Modal */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Subscription Details</DialogTitle>
          </DialogHeader>
          {selectedSubscription && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Product</p>
                  <p className="font-medium">{selectedSubscription.product}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Term</p>
                  <p className="font-medium capitalize">{selectedSubscription.term}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant="outline" className="status-active">
                    {selectedSubscription.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Renewal Date</p>
                  <p className="font-medium">
                    {new Date(selectedSubscription.renewalDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Purchased Seats</p>
                  <p className="font-medium">{selectedSubscription.purchasedSeats}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Price per Seat</p>
                  <p className="font-medium">${selectedSubscription.pricePerSeat}/year</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Annual Cost</p>
                  <p className="font-medium text-lg text-primary">
                    ${(selectedSubscription.purchasedSeats * selectedSubscription.pricePerSeat).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            {canModify && (
              <Button 
                variant="outline" 
                onClick={() => {
                  setDetailsOpen(false);
                  openModify(selectedSubscription!);
                }}
              >
                Change License Quantity
              </Button>
            )}
            <Button onClick={() => setDetailsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modify Seats Modal */}
      <Dialog open={modifyOpen} onOpenChange={setModifyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change License Quantity</DialogTitle>
            <DialogDescription>
              Adjust the number of seats for {selectedSubscription?.product}
            </DialogDescription>
          </DialogHeader>
          {selectedSubscription && (
            <div className="space-y-6">
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setNewSeatCount(Math.max(1, newSeatCount - 1))}
                  disabled={newSeatCount <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={newSeatCount}
                  onChange={(e) => setNewSeatCount(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
                  className="w-24 text-center text-lg font-semibold"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setNewSeatCount(Math.min(500, newSeatCount + 1))}
                  disabled={newSeatCount >= 500}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current seats</span>
                  <span>{selectedSubscription.purchasedSeats}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">New seats</span>
                  <span>{newSeatCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Currently assigned</span>
                  <span>{getAssignedLicenseCount(selectedSubscription.product)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-medium">
                  <span>Change</span>
                  <span className={getSeatDifference() > 0 ? 'text-success' : getSeatDifference() < 0 ? 'text-destructive' : ''}>
                    {getSeatDifference() > 0 && <ArrowUpRight className="h-4 w-4 inline mr-1" />}
                    {getSeatDifference() < 0 && <ArrowDownRight className="h-4 w-4 inline mr-1" />}
                    {getSeatDifference() > 0 ? '+' : ''}{getSeatDifference()} seats
                  </span>
                </div>
                {getSeatDifference() !== 0 && (
                  <div className="flex justify-between font-medium">
                    <span>Price change</span>
                    <span className={getPriceChange() > 0 ? 'text-destructive' : 'text-success'}>
                      {getPriceChange() > 0 ? '+' : ''}${getPriceChange().toLocaleString()}/year
                    </span>
                  </div>
                )}
              </div>

              {newSeatCount < getAssignedLicenseCount(selectedSubscription.product) && (
                <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Reduction requires license reassignment</p>
                    <p className="text-sm text-muted-foreground">
                      You have {getAssignedLicenseCount(selectedSubscription.product)} licenses assigned 
                      but are reducing to {newSeatCount} seats.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModifyOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleModifySeats}
              disabled={newSeatCount === selectedSubscription?.purchasedSeats}
            >
              {newSeatCount < (getAssignedLicenseCount(selectedSubscription?.product || '') || 0)
                ? 'Manage Assignments'
                : 'Confirm Changes'
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      <Dialog open={paymentOpen} onOpenChange={(open) => {
        if (!open && paymentStatus !== 'processing') {
          setPaymentOpen(false);
          setPaymentStatus('idle');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {paymentStatus === 'success' ? 'Payment Successful' : 
               paymentStatus === 'error' ? 'Payment Failed' : 
               'Confirm Payment'}
            </DialogTitle>
          </DialogHeader>
          
          {paymentStatus === 'success' ? (
            <div className="text-center py-6">
              <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-success" />
              </div>
              <p className="text-lg font-medium">Subscription Updated!</p>
              <p className="text-muted-foreground mt-2">Redirecting to licenses...</p>
            </div>
          ) : paymentStatus === 'error' ? (
            <div className="text-center py-6">
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl text-destructive">✕</span>
              </div>
              <p className="text-lg font-medium text-destructive">Payment Failed</p>
              <p className="text-muted-foreground mt-2">Please try again.</p>
              <Button onClick={() => setPaymentStatus('idle')} className="mt-4">
                Retry
              </Button>
            </div>
          ) : paymentStatus === 'processing' ? (
            <div className="text-center py-6">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 animate-pulse-soft">
                <CreditCard className="h-8 w-8 text-primary" />
              </div>
              <p className="text-lg font-medium">Processing Payment...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Seat change</span>
                  <span>
                    {selectedSubscription?.purchasedSeats} → {newSeatCount}
                  </span>
                </div>
                <div className="flex justify-between font-medium text-lg border-t pt-2">
                  <span>Amount Due</span>
                  <span className="text-primary">
                    {getPriceChange() > 0 
                      ? `$${getPriceChange().toLocaleString()}`
                      : getPriceChange() < 0 
                        ? `Credit: $${Math.abs(getPriceChange()).toLocaleString()}`
                        : '$0'
                    }
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Card Number</Label>
                <Input placeholder="4242 4242 4242 4242" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Expiry</Label>
                  <Input placeholder="MM/YY" />
                </div>
                <div className="space-y-2">
                  <Label>CVC</Label>
                  <Input placeholder="123" />
                </div>
              </div>
            </div>
          )}

          {paymentStatus === 'idle' && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setPaymentOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handlePayment}>
                <CreditCard className="h-4 w-4 mr-2" />
                Pay Now
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};
