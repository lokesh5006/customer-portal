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
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useApp, Quote } from '@/contexts/AppContext';
import {
  FileSignature, Eye, Check, X, RefreshCw, Plus, MessageSquare, MoreVertical, Download, Search, Clock,
} from 'lucide-react';
import {
  AcceptQuoteDrawer, DeclineQuoteDialog, ViewNoteDialog, ViewDeclineReasonDialog, RequestQuoteDialog,
} from '@/components/subscriptions/QuoteDialogs';
import { useToast } from '@/hooks/use-toast';
import { useReadOnlyGuard, READ_ONLY_TOOLTIP } from '@/hooks/useReadOnlyGuard';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

const QUOTE_STATUS_ORDER: Record<Quote['status'], number> = {
  active: 0, accepted: 1, declined: 2, expired: 3,
};

const formatShortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const daysUntil = (iso: string) =>
  Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

export const QuotesPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getCompanyQuotes, getCompanyQuoteRequests, getCompanySubscriptions, hasAccess } = useApp();
  const { readOnly } = useReadOnlyGuard();
  const quotes = getCompanyQuotes();
  const quoteRequests = getCompanyQuoteRequests();
  const canAccept = hasAccess(['account_owner', 'billing_admin']) && !readOnly;
  const hasActivePaidSubscription = getCompanySubscriptions().some(s => s.status === 'active');

  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<SortState>({ key: null, direction: null });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [acceptQuote, setAcceptQuote] = useState<Quote | null>(null);
  const [declineQuote, setDeclineQuote] = useState<Quote | null>(null);
  const [noteQuote, setNoteQuote] = useState<Quote | null>(null);
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

  const statusColor = (s: Quote['status']) => {
    switch (s) {
      case 'active': return 'bg-info/10 text-info border-info/30';
      case 'accepted': return 'bg-success/10 text-success border-success/30';
      case 'declined': return 'text-muted-foreground border-muted-foreground/40';
      case 'expired': return 'bg-warning/10 text-warning border-warning/30';
    }
  };

  const handleRegenerate = (q: Quote) => {
    navigate('/checkout', { state: { fromQuote: q.id, lineItems: q.lineItems } });
  };

  const columns: DataTableColumn<Quote>[] = [
    {
      key: 'quoteNumber',
      header: <SortableHeader label="Quote ID" sortKey="quoteNumber" sort={sort} onSortChange={setSort} />,
      render: q => <span className="font-mono text-sm">{q.quoteNumber}</span>,
    },
    {
      key: 'products',
      header: <SortableHeader label="Products" sortKey="products" sort={sort} onSortChange={setSort} />,
      render: q => {
        const names = q.lineItems.map(l => l.productName);
        const label = names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
        return <div className="text-sm">{label}</div>;
      },
    },
    {
      key: 'createdDate',
      header: <SortableHeader label="Created Date" sortKey="createdDate" sort={sort} onSortChange={setSort} />,
      render: q => <span className="text-sm">{formatShortDate(q.createdDate)}</span>,
    },
    {
      key: 'expiryDate',
      header: <SortableHeader label="Expiry Date" sortKey="expiryDate" sort={sort} onSortChange={setSort} />,
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
      key: 'total',
      className: 'text-right',
      header: <SortableHeader label="Total" sortKey="total" sort={sort} onSortChange={setSort} align="right" />,
      render: q => <span className="font-medium">{formatCurrency(q.amount)}</span>,
    },
    {
      key: 'status',
      header: <SortableHeader label="Status" sortKey="status" sort={sort} onSortChange={setSort} />,
      render: q => <Badge variant="outline" className={statusColor(q.status)}>{q.status}</Badge>,
    },
    {
      key: 'actions', header: '', className: 'w-[50px] text-right',
      render: q => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setNoteQuote(q)}>
              <Eye className="h-4 w-4 mr-2" />View Quote
            </DropdownMenuItem>
            {q.note && (
              <DropdownMenuItem onClick={() => setNoteQuote(q)}>
                <Eye className="h-4 w-4 mr-2" />View Note
              </DropdownMenuItem>
            )}
            {q.status === 'declined' && q.declineReason && (
              <DropdownMenuItem onClick={() => setViewDeclineQuote(q)}>
                <MessageSquare className="h-4 w-4 mr-2" />View Decline Reason
              </DropdownMenuItem>
            )}
            {q.status === 'active' && canAccept && (
              <DropdownMenuItem onClick={() => setAcceptQuote(q)} disabled={readOnly}>
                <Check className="h-4 w-4 mr-2" />Accept Quote
              </DropdownMenuItem>
            )}
            {q.status === 'declined' && (
              <DropdownMenuItem onClick={() => handleRegenerate(q)} disabled={readOnly}>
                <RefreshCw className="h-4 w-4 mr-2" />Regenerate
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => toast({ title: 'PDF download coming soon', description: q.quoteNumber })}>
              <Download className="h-4 w-4 mr-2" />Download PDF
            </DropdownMenuItem>
            {q.status === 'active' && canAccept && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeclineQuote(q)} disabled={readOnly}>
                  <X className="h-4 w-4 mr-2" />Decline Quote
                </DropdownMenuItem>
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
          title="Quotes"
          description="Review, accept, or decline quotes for new subscriptions and changes."
          showCompanyContext={false}
          primaryAction={
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  {hasActivePaidSubscription ? (
                    <Button onClick={() => setRequestOpen(true)} disabled={readOnly}>
                      <MessageSquare className="h-4 w-4 mr-1" />Request Quote
                    </Button>
                  ) : (
                    <Button onClick={() => navigate('/checkout')} disabled={readOnly}>
                      <Plus className="h-4 w-4 mr-1" />New Quote
                    </Button>
                  )}
                </span>
              </TooltipTrigger>
              {readOnly && <TooltipContent>{READ_ONLY_TOOLTIP}</TooltipContent>}
            </Tooltip>
          }
        />

        {hasActivePaidSubscription && (
          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            You already have an active subscription. To modify or add products/licenses, please request a quote.
          </div>
        )}

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
                emptyMessage="No quotes available." emptyIcon={<FileSignature className="h-12 w-12 text-muted-foreground" />}
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

      <AcceptQuoteDrawer open={!!acceptQuote} onOpenChange={(v) => !v && setAcceptQuote(null)} quote={acceptQuote} />
      <DeclineQuoteDialog open={!!declineQuote} onOpenChange={(v) => !v && setDeclineQuote(null)} quote={declineQuote} />
      <ViewNoteDialog open={!!noteQuote} onOpenChange={(v) => !v && setNoteQuote(null)} quote={noteQuote} />
      <ViewDeclineReasonDialog open={!!viewDeclineQuote} onOpenChange={(v) => !v && setViewDeclineQuote(null)} quote={viewDeclineQuote} />
      <RequestQuoteDialog open={requestOpen} onOpenChange={setRequestOpen} />
    </MainLayout>
  );
};

export default QuotesPage;
