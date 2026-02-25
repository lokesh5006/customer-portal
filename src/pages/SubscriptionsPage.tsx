import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, Subscription, SubscriptionProduct, PRODUCT_CATALOG } from '@/contexts/AppContext';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  CreditCard,
  Eye,
  MoreHorizontal,
  Plus,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Check,
  ShoppingCart,
  PackagePlus,
  XCircle,
} from 'lucide-react';

export const SubscriptionsPage = () => {
  const navigate = useNavigate();
  const {
    currentCompany,
    getCompanySubscriptions,
    getAssignedLicenseCount,
    updateProductLicenseCount,
    addProductToSubscription,
    hasAccess,
  } = useApp();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modals
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [modifyOpen, setModifyOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<SubscriptionProduct | null>(null);
  const [newLicenseCount, setNewLicenseCount] = useState(0);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [newProducts, setNewProducts] = useState<{ name: string; count: number; price: number }[]>([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');

  const subscriptions = getCompanySubscriptions();
  const canModify = hasAccess(['owner', 'billing']);
  const isOwner = hasAccess(['owner']);

  const filteredSubscriptions = subscriptions.filter(sub => {
    const matchesSearch = sub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.products.some(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredSubscriptions.length / pageSize);
  const paginated = filteredSubscriptions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setCurrentPage(1);
  };

  const openDetails = (sub: Subscription) => {
    setSelectedSub(sub);
    setDetailsOpen(true);
  };

  const openModifyProduct = (sub: Subscription, prod: SubscriptionProduct) => {
    setSelectedSub(sub);
    setSelectedProduct(prod);
    setNewLicenseCount(prod.licenseCount);
    setModifyOpen(true);
  };

  const handleModifyLicenses = () => {
    if (!selectedSub || !selectedProduct) return;
    const assigned = getAssignedLicenseCount(selectedSub.id, selectedProduct.id);

    if (newLicenseCount < assigned) {
      navigate('/licenses/reduce', {
        state: {
          subscriptionId: selectedSub.id,
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          newLicenseCount,
          currentLicenses: selectedProduct.licenseCount,
          assignedCount: assigned,
          subscriptionName: selectedSub.name,
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
      if (selectedSub && selectedProduct) {
        updateProductLicenseCount(selectedSub.id, selectedProduct.id, newLicenseCount);
      }
      toast({ title: 'Subscription Updated', description: `License count changed to ${newLicenseCount}.` });
      setTimeout(() => {
        setPaymentOpen(false);
        setPaymentStatus('idle');
      }, 1500);
    } else {
      setPaymentStatus('error');
    }
  };

  const handleAddProduct = () => {
    if (!selectedSub || newProducts.length === 0) return;
    newProducts.forEach(np => {
      const prod: SubscriptionProduct = {
        id: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: np.name,
        licenseCount: np.count,
        pricePerLicense: np.price,
        status: 'active',
      };
      addProductToSubscription(selectedSub.id, prod);
    });
    toast({ title: 'Products Added', description: `${newProducts.length} product(s) added to ${selectedSub.name}.` });
    setAddProductOpen(false);
    setNewProducts([]);
  };

  const getLicenseDiff = () => {
    if (!selectedProduct) return 0;
    return newLicenseCount - selectedProduct.licenseCount;
  };

  const getPriceChange = () => {
    if (!selectedProduct) return 0;
    return getLicenseDiff() * selectedProduct.pricePerLicense;
  };

  const columns: DataTableColumn<Subscription>[] = [
    {
      key: 'name',
      header: 'Subscription',
      render: (sub) => (
        <div>
          <span className="font-medium">{sub.name}</span>
          <div className="text-xs text-muted-foreground">{sub.planType} · {sub.billingFrequency}</div>
        </div>
      ),
    },
    {
      key: 'startDate',
      header: 'Start Date',
      render: (sub) => new Date(sub.startDate).toLocaleDateString(),
    },
    {
      key: 'renewalDate',
      header: 'Renewal Date',
      render: (sub) => new Date(sub.renewalDate).toLocaleDateString(),
    },
    {
      key: 'status',
      header: 'Status',
      render: (sub) => (
        <Badge variant="outline" className={`status-${sub.status === 'active' ? 'active' : sub.status === 'pending' ? 'invited' : 'inactive'}`}>
          {sub.status}
        </Badge>
      ),
    },
    {
      key: 'products',
      header: 'Products',
      render: (sub) => sub.products.length,
    },
    {
      key: 'licenses',
      header: 'Total Licenses',
      render: (sub) => {
        const total = sub.products.reduce((a, p) => a + p.licenseCount, 0);
        const assigned = sub.products.reduce((a, p) => a + getAssignedLicenseCount(sub.id, p.id), 0);
        return `${assigned} / ${total}`;
      },
    },
    {
      key: 'actions',
      header: '',
      className: 'w-[50px] text-right',
      render: (sub) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openDetails(sub)}>
              <Eye className="h-4 w-4 mr-2" />View Details
            </DropdownMenuItem>
            {canModify && (
              <>
                <DropdownMenuItem onClick={() => { setSelectedSub(sub); setNewProducts([]); setAddProductOpen(true); }}>
                  <PackagePlus className="h-4 w-4 mr-2" />Add Product
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {isOwner && (
                  <DropdownMenuItem className="text-destructive" onClick={() => toast({ title: 'Cancel Subscription', description: 'This feature is coming soon.' })}>
                    <XCircle className="h-4 w-4 mr-2" />Cancel Subscription
                  </DropdownMenuItem>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <ListingPageHeader
          title="Subscriptions"
          description={`Manage subscriptions for ${currentCompany?.name}`}
          primaryAction={
            canModify && (
              <Button onClick={() => navigate('/signup')}>
                <ShoppingCart className="h-4 w-4 mr-2" />Buy Subscription
              </Button>
            )
          }
        />

        <SearchFilterCard
          searchValue={searchQuery}
          onSearchChange={(v) => { setSearchQuery(v); setCurrentPage(1); }}
          searchPlaceholder="Search subscriptions or products..."
          onReset={resetFilters}
          filters={
            <FilterField
              label="Status"
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'active', label: 'Active' },
                { value: 'pending', label: 'Pending' },
                { value: 'cancelled', label: 'Cancelled' },
                { value: 'expired', label: 'Expired' },
              ]}
            />
          }
        />

        {subscriptions.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Subscriptions</h3>
              <p className="text-muted-foreground mb-4">You don't have any active subscriptions yet.</p>
              <Button onClick={() => navigate('/signup')}>Get Started</Button>
            </CardContent>
          </Card>
        ) : (
          <div>
            <DataTable columns={columns} data={paginated} keyExtractor={(sub) => sub.id} emptyMessage="No subscriptions found." />
            <Card className="rounded-t-none border-t-0">
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalRecords={filteredSubscriptions.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
              />
            </Card>
          </div>
        )}
      </div>

      {/* Subscription Details Modal */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Subscription Details</DialogTitle></DialogHeader>
          {selectedSub && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-sm text-muted-foreground">Name</p><p className="font-medium">{selectedSub.name}</p></div>
                <div><p className="text-sm text-muted-foreground">Plan Type</p><p className="font-medium">{selectedSub.planType}</p></div>
                <div><p className="text-sm text-muted-foreground">Billing</p><p className="font-medium capitalize">{selectedSub.billingFrequency}</p></div>
                <div><p className="text-sm text-muted-foreground">Renewal</p><p className="font-medium">{new Date(selectedSub.renewalDate).toLocaleDateString()}</p></div>
                <div><p className="text-sm text-muted-foreground">Status</p><Badge variant="outline" className="status-active">{selectedSub.status}</Badge></div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Products</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-center">Licenses</TableHead>
                      <TableHead className="text-center">Assigned</TableHead>
                      <TableHead className="text-center">Available</TableHead>
                      <TableHead className="text-right">Price/License</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      {canModify && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedSub.products.map(prod => {
                      const assigned = getAssignedLicenseCount(selectedSub.id, prod.id);
                      return (
                        <TableRow key={prod.id}>
                          <TableCell className="font-medium">{prod.name}</TableCell>
                          <TableCell className="text-center">{prod.licenseCount}</TableCell>
                          <TableCell className="text-center">{assigned}</TableCell>
                          <TableCell className="text-center">{prod.licenseCount - assigned}</TableCell>
                          <TableCell className="text-right">${prod.pricePerLicense}</TableCell>
                          <TableCell className="text-right">${(prod.licenseCount * prod.pricePerLicense).toLocaleString()}</TableCell>
                          {canModify && (
                            <TableCell className="text-right">
                              <Button variant="outline" size="sm" onClick={() => { setDetailsOpen(false); openModifyProduct(selectedSub, prod); }}>
                                Modify
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setDetailsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modify License Count Modal */}
      <Dialog open={modifyOpen} onOpenChange={setModifyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change License Quantity</DialogTitle>
            <DialogDescription>
              {selectedProduct?.name} under {selectedSub?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedProduct && selectedSub && (
            <div className="space-y-6">
              <div className="flex items-center justify-center gap-4">
                <Button variant="outline" size="icon" onClick={() => setNewLicenseCount(Math.max(1, newLicenseCount - 1))} disabled={newLicenseCount <= 1}>
                  <Minus className="h-4 w-4" />
                </Button>
                <Input type="number" min={1} max={500} value={newLicenseCount}
                  onChange={(e) => setNewLicenseCount(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
                  className="w-24 text-center text-lg font-semibold" />
                <Button variant="outline" size="icon" onClick={() => setNewLicenseCount(Math.min(500, newLicenseCount + 1))} disabled={newLicenseCount >= 500}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Current</span><span>{selectedProduct.licenseCount}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">New</span><span>{newLicenseCount}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Assigned</span><span>{getAssignedLicenseCount(selectedSub.id, selectedProduct.id)}</span></div>
                {getLicenseDiff() !== 0 && (
                  <>
                    <div className="border-t pt-2 flex justify-between font-medium">
                      <span>Change</span>
                      <span className={getLicenseDiff() > 0 ? 'text-success' : 'text-destructive'}>
                        {getLicenseDiff() > 0 ? '+' : ''}{getLicenseDiff()} licenses
                      </span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Price change</span>
                      <span className={getPriceChange() > 0 ? 'text-destructive' : 'text-success'}>
                        {getPriceChange() > 0 ? '+' : ''}${getPriceChange().toLocaleString()}/year
                      </span>
                    </div>
                  </>
                )}
              </div>
              {newLicenseCount < getAssignedLicenseCount(selectedSub.id, selectedProduct.id) && (
                <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Reduction requires license reassignment</p>
                    <p className="text-sm text-muted-foreground">
                      You have {getAssignedLicenseCount(selectedSub.id, selectedProduct.id)} licenses assigned but are reducing to {newLicenseCount}.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModifyOpen(false)}>Cancel</Button>
            <Button onClick={handleModifyLicenses} disabled={newLicenseCount === selectedProduct?.licenseCount}>
              {selectedProduct && newLicenseCount < getAssignedLicenseCount(selectedSub?.id || '', selectedProduct.id)
                ? 'Manage Assignments'
                : 'Confirm Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Product Modal */}
      <Dialog open={addProductOpen} onOpenChange={setAddProductOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Product to {selectedSub?.name}</DialogTitle>
            <DialogDescription>Select products and set license quantities.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {PRODUCT_CATALOG.filter(cat =>
              !selectedSub?.products.some(p => p.name === cat.name)
            ).map(cat => {
              const selected = newProducts.find(np => np.name === cat.name);
              return (
                <div key={cat.name} className="flex items-center gap-3 p-3 border rounded-lg">
                  <Checkbox
                    checked={!!selected}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setNewProducts([...newProducts, { name: cat.name, count: 1, price: cat.defaultPrice }]);
                      } else {
                        setNewProducts(newProducts.filter(np => np.name !== cat.name));
                      }
                    }}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{cat.name}</div>
                    <div className="text-xs text-muted-foreground">{cat.description} · ${cat.defaultPrice}/license</div>
                  </div>
                  {selected && (
                    <Input
                      type="number" min={1} max={100}
                      value={selected.count}
                      onChange={(e) => setNewProducts(newProducts.map(np =>
                        np.name === cat.name ? { ...np, count: Math.max(1, parseInt(e.target.value) || 1) } : np
                      ))}
                      className="w-20 text-center"
                    />
                  )}
                </div>
              );
            })}
            {PRODUCT_CATALOG.filter(cat => !selectedSub?.products.some(p => p.name === cat.name)).length === 0 && (
              <p className="text-sm text-muted-foreground">All available products are already added to this subscription.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddProductOpen(false)}>Cancel</Button>
            <Button onClick={handleAddProduct} disabled={newProducts.length === 0}>Add Products</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      <Dialog open={paymentOpen} onOpenChange={(open) => { if (!open && paymentStatus !== 'processing') { setPaymentOpen(false); setPaymentStatus('idle'); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{paymentStatus === 'success' ? 'Payment Successful' : paymentStatus === 'error' ? 'Payment Failed' : 'Confirm Payment'}</DialogTitle>
          </DialogHeader>
          {paymentStatus === 'success' ? (
            <div className="text-center py-6">
              <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-success" />
              </div>
              <p className="text-lg font-medium">Subscription Updated!</p>
            </div>
          ) : paymentStatus === 'error' ? (
            <div className="text-center py-6">
              <p className="text-lg font-medium text-destructive">Payment Failed</p>
              <Button onClick={() => setPaymentStatus('idle')} className="mt-4">Retry</Button>
            </div>
          ) : paymentStatus === 'processing' ? (
            <div className="text-center py-6">
              <CreditCard className="h-8 w-8 text-primary mx-auto mb-4 animate-pulse" />
              <p>Processing...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">License change</span><span>{selectedProduct?.licenseCount} → {newLicenseCount}</span></div>
                <div className="flex justify-between font-medium text-lg border-t pt-2">
                  <span>Amount Due</span>
                  <span className="text-primary">{getPriceChange() > 0 ? `$${getPriceChange().toLocaleString()}` : getPriceChange() < 0 ? `Credit: $${Math.abs(getPriceChange()).toLocaleString()}` : '$0'}</span>
                </div>
              </div>
              <div className="space-y-2"><Label>Card Number</Label><Input placeholder="4242 4242 4242 4242" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Expiry</Label><Input placeholder="MM/YY" /></div>
                <div className="space-y-2"><Label>CVC</Label><Input placeholder="123" /></div>
              </div>
            </div>
          )}
          {paymentStatus === 'idle' && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setPaymentOpen(false)}>Cancel</Button>
              <Button onClick={handlePayment}><CreditCard className="h-4 w-4 mr-2" />Pay Now</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};
