import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ListingPageHeader, DataTable, DataTableColumn, PaginationControls, SortableHeader, SortState,
} from '@/components/listing';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { useApp, Invoice } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { FileText, Eye, CreditCard, Download, MoreVertical, RefreshCw, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RenewalFlyout } from '@/components/billing/RenewalFlyout';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

const formatShortDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
};

const deriveDescription = (inv: Invoice): string => {
  if (inv.description) return inv.description;
  if (inv.source === 'renewal' || inv.invoiceType === 'Renewal Invoice') return 'Annual renewal';
  if (inv.source === 'license_change') return 'License adjustment';
  if (inv.source === 'checkout' || inv.invoiceType === 'Initial Invoice') return 'Initial subscription purchase';
  if (inv.source === 'quote_acceptance') return 'Accepted quote';
  return 'Invoice';
};

const invoiceTotal = (inv: Invoice) => inv.totalAmount ?? inv.amount;

// Enum order — actionable statuses sort to the top when ascending.
const STATUS_ORDER: Record<Invoice['status'], number> = {
  awaiting_payment: 0,
  overdue: 1,
  upcoming: 2,
  payment_terms_applied: 3,
  unpaid: 4,
  pending: 5,
  paid: 6,
};

const StatusPill = ({ inv, termsLabel }: { inv: Invoice; termsLabel: string }) => {
  if (inv.status === 'paid') {
    return (
      <div>
        <Badge variant="outline" className="bg-success/10 text-success border-success/30">Paid</Badge>
        {inv.paidAt && (
          <div className="text-[11px] text-muted-foreground mt-1">Paid {formatShortDate(inv.paidAt)}</div>
        )}
      </div>
    );
  }
  if (inv.status === 'awaiting_payment') {
    return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">Awaiting Payment</Badge>;
  }
  if (inv.status === 'payment_terms_applied') {
    return <Badge variant="outline" className="bg-info/10 text-info border-info/30">{termsLabel}</Badge>;
  }
  if (inv.status === 'overdue') {
    return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">Overdue</Badge>;
  }
  if (inv.status === 'upcoming') {
    return <Badge variant="outline" className="text-muted-foreground border-muted-foreground/40">Upcoming</Badge>;
  }
  if (inv.status === 'unpaid') {
    return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">Unpaid</Badge>;
  }
  return <Badge variant="outline">{inv.status}</Badge>;
};

export const BillingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { getCompanyInvoices, getCompanyConfig } = useApp();
  const { toast } = useToast();
  const invoices = getCompanyInvoices();
  const config = getCompanyConfig();
  const termsLabel = config.terms || 'Net 30';

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState<SortState>({ key: null, direction: null });
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [renewalOpen, setRenewalOpen] = useState(false);
  const [renewalSubId, setRenewalSubId] = useState<string>('');
  const [renewalInvoiceId, setRenewalInvoiceId] = useState<string | undefined>(undefined);

  // Search filters across documented fields: invoiceNumber/id, description, poNumber,
  // subscriptionName, and any line item product name.
  const filteredInvoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter(inv => {
      const haystack: string[] = [
        inv.invoiceNumber,
        inv.id,
        deriveDescription(inv),
        inv.poNumber || '',
        inv.subscriptionName || '',
        ...inv.lineItems.map(l => l.product || ''),
      ];
      return haystack.some(v => v.toLowerCase().includes(q));
    });
  }, [invoices, searchQuery]);

  const sortedInvoices = useMemo(() => {
    if (!sort.key || !sort.direction) return filteredInvoices;
    const dir = sort.direction === 'asc' ? 1 : -1;
    const list = [...filteredInvoices];
    list.sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      switch (sort.key) {
        case 'invoiceNumber':
          av = a.invoiceNumber.toLowerCase();
          bv = b.invoiceNumber.toLowerCase();
          break;
        case 'date':
          av = a.date;
          bv = b.date;
          break;
        case 'dueDate':
          av = a.dueDate;
          bv = b.dueDate;
          break;
        case 'total':
          av = invoiceTotal(a);
          bv = invoiceTotal(b);
          break;
        case 'status':
          av = STATUS_ORDER[a.status] ?? 99;
          bv = STATUS_ORDER[b.status] ?? 99;
          break;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return list;
  }, [filteredInvoices, sort]);

  const totalPages = Math.max(1, Math.ceil(sortedInvoices.length / pageSize));
  const paginatedInvoices = sortedInvoices.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const isPayable = (inv: Invoice) =>
    inv.status === 'awaiting_payment' || inv.status === 'overdue' || inv.status === 'upcoming' || inv.status === 'unpaid';

  const handlePay = (inv: Invoice) => {
    const subtotal = inv.subtotal ?? invoiceTotal(inv);
    const tax = inv.tax ?? 0;
    navigate('/pay', {
      state: {
        source: 'invoice',
        invoiceId: inv.id,
        subtotal,
        tax,
        totalAmount: invoiceTotal(inv),
        returnTo: location.pathname,
      },
    });
  };

  const handleRenew = (inv: Invoice) => {
    setRenewalSubId(inv.subscriptionId);
    setRenewalInvoiceId(inv.id);
    setRenewalOpen(true);
  };

  const columns: DataTableColumn<Invoice>[] = [
    {
      key: 'invoiceNumber',
      header: <SortableHeader label="Invoice ID" sortKey="invoiceNumber" sort={sort} onSortChange={setSort} />,
      render: (inv) => (
        <div className="flex flex-col leading-tight">
          <span className="font-mono text-sm">{inv.invoiceNumber}</span>
          {inv.poNumber && (
            <span className="text-xs text-muted-foreground">PO #{inv.poNumber}</span>
          )}
        </div>
      ),
    },
    {
      key: 'date',
      header: <SortableHeader label="Invoice Created" sortKey="date" sort={sort} onSortChange={setSort} />,
      render: (inv) => <span className="text-sm">{formatShortDate(inv.date)}</span>,
    },
    {
      key: 'dueDate',
      header: <SortableHeader label="Due Date" sortKey="dueDate" sort={sort} onSortChange={setSort} />,
      render: (inv) => (
        <span className={cn('text-sm', inv.paidAt && 'text-muted-foreground')}>
          {formatShortDate(inv.dueDate)}
        </span>
      ),
    },
    {
      key: 'total',
      className: 'text-right',
      header: <SortableHeader label="Total" sortKey="total" sort={sort} onSortChange={setSort} align="right" />,
      render: (inv) => <span className="font-medium">{formatCurrency(invoiceTotal(inv))}</span>,
    },
    {
      key: 'status',
      header: <SortableHeader label="Status" sortKey="status" sort={sort} onSortChange={setSort} />,
      render: (inv) => (
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill inv={inv} termsLabel={termsLabel} />
          {(inv.status === 'awaiting_payment' || inv.status === 'unpaid') && (
            <Button size="sm" className="h-7 px-2" onClick={() => handlePay(inv)}>
              Pay Now
            </Button>
          )}
          {inv.status === 'overdue' && (
            <Button size="sm" variant="destructive" className="h-7 px-2" onClick={() => handlePay(inv)}>
              Pay Now
            </Button>
          )}
          {inv.status === 'upcoming' && inv.source === 'renewal' && (
            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => handleRenew(inv)}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />Renew
            </Button>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-[50px] text-right',
      render: (inv) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setSelectedInvoice(inv); setDetailsOpen(true); }}>
              <Eye className="h-4 w-4 mr-2" />View Invoice
            </DropdownMenuItem>
            {isPayable(inv) && (
              <DropdownMenuItem onClick={() => handlePay(inv)}>
                <CreditCard className="h-4 w-4 mr-2" />Pay
              </DropdownMenuItem>
            )}
            {inv.source === 'renewal' && (
              <DropdownMenuItem onClick={() => handleRenew(inv)}>
                <RefreshCw className="h-4 w-4 mr-2" />Renew
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => toast({ title: 'PDF download coming soon', description: inv.invoiceNumber })}>
              <Download className="h-4 w-4 mr-2" />Download PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <ListingPageHeader
          title="Invoices"
          description="View and pay invoices for your subscription."
          showCompanyContext={false}
          secondaryAction={<Button variant="outline"><Download className="h-4 w-4 mr-2" />Export</Button>}
        />

        {/* Search input — replaces the old SearchFilterCard with a simpler bar. */}
        <Card className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search invoices..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="pl-9"
            />
          </div>
        </Card>

        <div>
          {sortedInvoices.length === 0 && searchQuery ? (
            <Card className="p-12 flex flex-col items-center gap-2 text-center">
              <FileText className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No invoices match your search.</p>
              <Button variant="outline" size="sm" onClick={() => setSearchQuery('')}>Clear search</Button>
            </Card>
          ) : (
            <>
              <DataTable
                columns={columns}
                data={paginatedInvoices}
                keyExtractor={(inv) => inv.id}
                emptyMessage="No invoices found."
                emptyIcon={<FileText className="h-12 w-12 text-muted-foreground" />}
              />
              <Card className="rounded-t-none border-t-0">
                <PaginationControls
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalRecords={sortedInvoices.length}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
                />
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Invoice Details Modal */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Invoice {selectedInvoice?.invoiceNumber}</DialogTitle></DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Description:</span> <span className="font-medium">{deriveDescription(selectedInvoice)}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <StatusPill inv={selectedInvoice} termsLabel={termsLabel} /></div>
                <div><span className="text-muted-foreground">Date:</span> {formatShortDate(selectedInvoice.date)}</div>
                <div><span className="text-muted-foreground">Due:</span> {formatShortDate(selectedInvoice.dueDate)}</div>
                {selectedInvoice.poNumber && (
                  <div className="col-span-2"><span className="text-muted-foreground">PO Number:</span> <span className="font-medium">{selectedInvoice.poNumber}</span></div>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedInvoice.lineItems.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell>{item.product}</TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className={cn('border-t pt-2 flex justify-between font-medium')}>
                <span>Total</span><span>{formatCurrency(invoiceTotal(selectedInvoice))}</span>
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={() => setDetailsOpen(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <RenewalFlyout
        open={renewalOpen}
        onOpenChange={setRenewalOpen}
        subscriptionId={renewalSubId}
        invoiceId={renewalInvoiceId}
      />
    </MainLayout>
  );
};
