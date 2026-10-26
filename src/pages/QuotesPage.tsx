import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ListingPageHeader, DataTable, DataTableColumn, PaginationControls, SortableHeader, SortState,
} from '@/components/listing';
import { useApp, Quote } from '@/contexts/AppContext';
import {
  FileSignature, MessageSquare, Download, Search, Clock, RefreshCw, Trash2,
  FileText, ClipboardCheck, Hourglass, Timer,
} from 'lucide-react';
import {
  AcceptQuoteDrawer, DeclineQuoteDialog, QuoteDetailsDrawer, ViewDeclineReasonDialog, RequestQuoteDialog,
} from '@/components/subscriptions/QuoteDialogs';
import { useToast } from '@/hooks/use-toast';
import { useReadOnlyGuard, READ_ONLY_TOOLTIP } from '@/hooks/useReadOnlyGuard';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

const QUOTE_STATUS_ORDER: Record<Quote['status'], number> = {
  requested: 0, active: 1, accepted: 2, declined: 3, expired: 4,
};

const REQUESTED_TOOLTIP =
  "Awaiting sales team response. You'll see the formal quote here when it's ready.";

const formatShortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const daysUntil = (iso: string) =>
  Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

export const QuotesPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getCompanyQuotes, getCompanyQuoteRequests, hasAccess, cancelQuoteRequest } = useApp();
  const { readOnly } = useReadOnlyGuard();
  const quotes = getCompanyQuotes();
  const quoteRequests = getCompanyQuoteRequests();
  const canAccept = hasAccess(['account_owner', 'billing_admin']) && !readOnly;

  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<SortState>({ key: null, direction: null });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [acceptQuote, setAcceptQuote] = useState<Quote | null>(null);
  const [declineQuote, setDeclineQuote] = useState<Quote | null>(null);
  const [detailsQuote, setDetailsQuote] = useState<Quote | null>(null);
  const [viewDeclineQuote, setViewDeclineQuote] = useState<Quote | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);

  // Search across documented fields: quoteNumber/id, line item product names, note, declineReason.
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return quotes;
    return quotes.filter(qq => {
      const haystack: string[] = [
        qq.quoteNumber, qq.id, qq.note || '', qq.declineReason || '',
        ...qq.lineItems.map(l => l.productName || ''),
      ];
      return haystack.some(v => v.toLowerCase().includes(q));
    });
  }, [quotes, searchQuery]);

  const sorted = useMemo(() => {
    if (!sort.key || !sort.direction) return filtered;
    const dir = sort.direction === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let av: string | number = '', bv: string | number = '';
      switch (sort.key) {
        case 'quoteNumber': av = a.quoteNumber.toLowerCase(); bv = b.quoteNumber.toLowerCase(); break;
        case 'products': av = (a.lineItems[0]?.productName || '').toLowerCase(); bv = (b.lineItems[0]?.productName || '').toLowerCase(); break;
        case 'createdDate': av = a.createdDate; bv = b.createdDate; break;
        case 'expiryDate': av = a.expiryDate; bv = b.expiryDate; break;
        case 'total': av = a.amount; bv = b.amount; break;
        case 'status': av = QUOTE_STATUS_ORDER[a.status] ?? 99; bv = QUOTE_STATUS_ORDER[b.status] ?? 99; break;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // The reference labels a formally-issued quote awaiting the customer's decision
  // as "Pending" (our internal status for that state is 'active').
  const statusLabel = (s: Quote['status']) => s === 'active' ? 'Pending' : s === 'requested' ? 'Requested' : s;
  const statusColor = (s: Quote['status']) => {
    switch (s) {
      case 'requested': return 'bg-warning/10 text-warning border-warning/30';
      case 'active': return 'bg-warning/10 text-warning border-warning/30';
      case 'accepted': return 'bg-success/10 text-success border-success/30';
      case 'declined': return 'text-muted-foreground border-muted-foreground/40';
      case 'expired': return 'bg-warning/10 text-warning border-warning/30';
    }
  };

  const totalQuotes = quotes.length;
  const acceptedCount = quotes.filter(q => q.status === 'accepted').length;
  const pendingCount = quotes.filter(q => q.status === 'active').length;
  const expiredCount = quotes.filter(q => q.status === 'expired').length;
  const acceptanceRate = totalQuotes > 0 ? Math.round((acceptedCount / totalQuotes) * 100) : 0;

  const handleCancelRequest = (q: Quote) => {
    cancelQuoteRequest(q.id);
    toast({ title: 'Quote request cancelled.', description: q.quoteNumber });
  };

  const handleRegenerate = (q: Quote) => {
    navigate('/checkout', { state: { fromQuote: q.id, lineItems: q.lineItems } });
  };

  const columns: DataTableColumn<Quote>[] = [
    {
      key: 'quoteNumber',
      header: <SortableHeader label="Quote #" sortKey="quoteNumber" sort={sort} onSortChange={setSort} />,
      render: q => <span className="font-mono text-sm">{q.quoteNumber}</span>,
    },
    {
      key: 'createdDate',
      header: <SortableHeader label="Date" sortKey="createdDate" sort={sort} onSortChange={setSort} />,
      render: q => <span className="text-sm">{formatShortDate(q.createdDate)}</span>,
    },
    {
      key: 'expiryDate',
      header: <SortableHeader label="Valid Until" sortKey="expiryDate" sort={sort} onSortChange={setSort} />,
      render: q => {
        const expiresIn = daysUntil(q.expiryDate);
        const isExpiringSoon = q.status === 'active' && expiresIn >= 0 && expiresIn <= 3;
        return (
          <span className={cn('text-sm inline-flex items-center gap-1', isExpiringSoon && 'text-warning font-medium')}>
            {isExpiringSoon && <Clock className="h-3.5 w-3.5" />}
            {formatShortDate(q.expiryDate)}
          </span>
        );
      },
    },
    {
      key: 'products',
      header: <SortableHeader label="Product & Plan" sortKey="products" sort={sort} onSortChange={setSort} />,
      render: q => {
        const names = q.lineItems.map(l => l.productName);
        const label = names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
        const seats = q.lineItems.reduce((a, l) => a + (l.licenseCount || 0), 0);
        return (
          <div>
            <div className="text-sm font-medium">{label}</div>
            <div className="text-xs text-muted-foreground">{seats} Seats</div>
          </div>
        );
      },
    },
    {
      key: 'total',
      className: 'text-right',
      header: <SortableHeader label="Amount" sortKey="total" sort={sort} onSortChange={setSort} align="right" />,
      render: q => <span className="font-medium">{formatCurrency(q.amount)}</span>,
    },
    {
      key: 'status',
      header: <SortableHeader label="Status" sortKey="status" sort={sort} onSortChange={setSort} />,
      render: q => {
        const pill = (
          <Badge variant="outline" className={statusColor(q.status)}>{statusLabel(q.status)}</Badge>
        );
        if (q.status !== 'requested') return pill;
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>{pill}</span>
            </TooltipTrigger>
            <TooltipContent>{REQUESTED_TOOLTIP}</TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      key: 'actions', header: 'Action', className: 'text-right',
      render: q => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => toast({ title: 'PDF download coming soon', description: q.quoteNumber })}
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDetailsQuote(q)}>View Detail</Button>
          {q.status === 'active' && canAccept && (
            <Button size="sm" onClick={() => setAcceptQuote(q)} disabled={readOnly}>Accept</Button>
          )}
          {q.status === 'declined' && (
            <Button size="sm" variant="outline" onClick={() => handleRegenerate(q)} disabled={readOnly}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />Regenerate
            </Button>
          )}
          {q.status === 'requested' && (
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleCancelRequest(q)} disabled={readOnly}>
              <Trash2 className="h-3.5 w-3.5 mr-1" />Cancel
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <ListingPageHeader
          title="Quotes"
          description="Review pricing quotes, compare subscription proposals, and track their status before purchase."
          showCompanyContext={false}
          primaryAction={
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <Button onClick={() => setRequestOpen(true)} disabled={readOnly}>
                    <MessageSquare className="h-4 w-4 mr-1" />Request Quote
                  </Button>
                </span>
              </TooltipTrigger>
              {readOnly && <TooltipContent>{READ_ONLY_TOOLTIP}</TooltipContent>}
            </Tooltip>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total Quotes</div>
              <div className="text-lg font-semibold">{totalQuotes}</div>
              <div className="text-xs text-primary">All Time Quotes</div>
            </div>
          </Card>
          <Card className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <ClipboardCheck className="h-5 w-5 text-success" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Accepted Quotes</div>
              <div className="text-lg font-semibold">{acceptedCount}</div>
              <div className="text-xs text-success">{acceptanceRate}% Acceptance Rate</div>
            </div>
          </Card>
          <Card className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Timer className="h-5 w-5 text-warning" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Pending Quotes</div>
              <div className="text-lg font-semibold">{pendingCount}</div>
              <div className="text-xs text-warning">Awaiting response</div>
            </div>
          </Card>
          <Card className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Hourglass className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Expired Quotes</div>
              <div className="text-lg font-semibold">{expiredCount}</div>
              <div className="text-xs text-muted-foreground">Past expiration date</div>
            </div>
          </Card>
        </div>

        <Card className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search quotes..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="pl-9"
            />
          </div>
        </Card>

        <div>
          {sorted.length === 0 && searchQuery ? (
            <Card className="p-12 flex flex-col items-center gap-2 text-center">
              <FileSignature className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No quotes match your search.</p>
              <Button variant="outline" size="sm" onClick={() => setSearchQuery('')}>Clear search</Button>
            </Card>
          ) : (
            <>
              <DataTable columns={columns} data={paginated} keyExtractor={q => q.id}
                emptyMessage="No Quotes yet. Quotes will appear here once they are available."
                emptyIcon={<FileSignature className="h-12 w-12 text-muted-foreground" />}
              />
              <Card className="rounded-t-none border-t-0">
                <PaginationControls
                  currentPage={currentPage} totalPages={totalPages} pageSize={pageSize}
                  totalRecords={sorted.length}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
                />
              </Card>
            </>
          )}
        </div>

        {quoteRequests.length > 0 && (
          <Card className="p-4 space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2"><MessageSquare className="h-4 w-4" />Quote Requests</h4>
            <div className="space-y-2">
              {quoteRequests.map(r => (
                <div key={r.id} className="border rounded-md p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{r.products.map(p => `${p.productName} (${p.desiredLicenseCount})`).join(', ')}</div>
                    <Badge variant="outline" className="status-invited">{r.status.replace('_', ' ')}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{new Date(r.createdDate).toLocaleDateString()}</div>
                  <div className="text-xs mt-1">{r.note}</div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <QuoteDetailsDrawer
        open={!!detailsQuote}
        onOpenChange={(v) => !v && setDetailsQuote(null)}
        quote={detailsQuote}
        canAccept={canAccept}
        onAccept={(q) => { setDetailsQuote(null); setAcceptQuote(q); }}
        onDecline={(q) => { setDetailsQuote(null); setDeclineQuote(q); }}
      />
      <AcceptQuoteDrawer open={!!acceptQuote} onOpenChange={(v) => !v && setAcceptQuote(null)} quote={acceptQuote} />
      <DeclineQuoteDialog open={!!declineQuote} onOpenChange={(v) => !v && setDeclineQuote(null)} quote={declineQuote} />
      <ViewDeclineReasonDialog open={!!viewDeclineQuote} onOpenChange={(v) => !v && setViewDeclineQuote(null)} quote={viewDeclineQuote} />
      <RequestQuoteDialog open={requestOpen} onOpenChange={setRequestOpen} />
    </MainLayout>
  );
};

export default QuotesPage;
