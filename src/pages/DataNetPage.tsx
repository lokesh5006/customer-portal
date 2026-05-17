import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { PaginationControls } from '@/components/listing';
import { useApp, DataNetUpdate } from '@/contexts/AppContext';
import { Database, Eye, MoreVertical, Search } from 'lucide-react';

export const DataNetPage = () => {
  const navigate = useNavigate();
  const { getDataNetUpdates, getCompanySubscriptions } = useApp();

  const subs = getCompanySubscriptions();
  const hasDataNet = subs.some(
    s => s.status === 'active' && s.products.some(p => p.name === 'DataNet')
  );

  const all = getDataNetUpdates();

  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [viewUpdate, setViewUpdate] = useState<DataNetUpdate | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter(u =>
      String(u.year).includes(q) ||
      u.monthName.toLowerCase().includes(q) ||
      u.title.toLowerCase().includes(q)
    );
  }, [all, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showPagination = filtered.length > 12;

  return (
    <MainLayout>
      <PageHeader
        title="DataNet"
        description="Monthly industry data updates and alerts."
      />

      <Card>
        <CardContent className="p-6">
          {!hasDataNet ? (
            <div className="flex flex-col items-center text-center py-12 px-6">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Database className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-base font-semibold mb-2">
                DataNet is not included in your subscription
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mb-6">
                DataNet provides monthly industry data and alerts. Subscribe to unlock access.
              </p>
              <Button onClick={() => navigate('/checkout', { state: { prefillProduct: 'DataNet' } })}>
                Subscribe to DataNet
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by year, month, or title..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                    className="pl-9"
                  />
                </div>
                {/* Reserved right slot for future filters — keeps the row balanced */}
                <div className="shrink-0" />
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Year
                      </TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Month
                      </TableHead>
                      <TableHead className="w-[60px] text-right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-sm text-muted-foreground">
                          No DataNet updates match your search.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paged.map(u => (
                        <TableRow key={u.id}>
                          <TableCell className="text-sm">{u.year}</TableCell>
                          <TableCell className="text-sm">{u.monthName}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Open menu">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => setViewUpdate(u)}>
                                  <Eye className="h-4 w-4 mr-2" /> View
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                {showPagination && (
                  <PaginationControls
                    currentPage={currentPage}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    totalRecords={filtered.length}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
                    pageSizeOptions={[12, 24, 48]}
                  />
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewUpdate} onOpenChange={(open) => !open && setViewUpdate(null)}>
        <DialogContent className="max-w-lg">
          {viewUpdate && (
            <>
              <DialogHeader>
                <DialogTitle>DataNet — {viewUpdate.monthName} {viewUpdate.year}</DialogTitle>
                <p className="text-sm text-muted-foreground">{viewUpdate.title}</p>
              </DialogHeader>
              <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
                {viewUpdate.body.split('\n\n').map((para, i) => (
                  <p key={i} className="text-sm leading-relaxed">{para}</p>
                ))}
              </div>
              <DialogFooter>
                <Button onClick={() => setViewUpdate(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default DataNetPage;
