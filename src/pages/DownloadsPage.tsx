import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ListingPageHeader,
  SearchFilterCard,
  FilterField,
  DataTable,
  DataTableColumn,
  PaginationControls,
} from '@/components/listing';
import { useToast } from '@/hooks/use-toast';
import { Download, FileText, Package } from 'lucide-react';

interface DownloadItem {
  id: string;
  name: string;
  size: string;
  product?: string;
  version?: string;
  date?: string;
  type: string;
}

const downloads: DownloadItem[] = [
  { id: '1', name: 'NumberCruncher Desktop v5.2', size: '245 MB', product: 'Desktop', version: '5.2', date: '2024-01-15', type: 'installer' },
  { id: '2', name: 'NumberCruncher Desktop v5.1', size: '240 MB', product: 'Desktop', version: '5.1', date: '2023-12-01', type: 'installer' },
  { id: '3', name: 'NumberCruncher Web v3.0', size: '12 MB', product: 'Web', version: '3.0', date: '2024-01-10', type: 'installer' },
  { id: '4', name: 'User Guide 2024', size: '12 MB', product: 'All', version: '2024', date: '2024-01-01', type: 'docs' },
  { id: '5', name: 'Quick Start Guide', size: '2 MB', product: 'All', version: '2024', date: '2024-01-01', type: 'docs' },
  { id: '6', name: 'API Documentation', size: '5 MB', product: 'Web', version: '3.0', date: '2024-01-10', type: 'docs' },
  { id: '7', name: 'January 2024 Newsletter', size: '1 MB', date: '2024-01-15', type: 'newsletter' },
  { id: '8', name: 'December 2023 Newsletter', size: '1 MB', date: '2023-12-15', type: 'newsletter' },
  { id: '9', name: 'November 2023 Newsletter', size: '1 MB', date: '2023-11-15', type: 'newsletter' },
  { id: '10', name: '2024 Rate Sheet', size: '500 KB', date: '2024-01-01', type: 'ratesheet' },
  { id: '11', name: '2023 Rate Sheet', size: '480 KB', date: '2023-01-01', type: 'ratesheet' },
  { id: '12', name: 'v5.2 Release Notes', size: '200 KB', version: '5.2', date: '2024-01-15', type: 'releasenotes' },
  { id: '13', name: 'v5.1 Release Notes', size: '180 KB', version: '5.1', date: '2023-12-01', type: 'releasenotes' },
  { id: '14', name: 'v5.0 Release Notes', size: '190 KB', version: '5.0', date: '2023-09-01', type: 'releasenotes' },
];

export const DownloadsPage = () => {
  const { toast } = useToast();

  // Tab
  const [activeTab, setActiveTab] = useState('all');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [productFilter, setProductFilter] = useState<string>('all');
  const [versionFilter, setVersionFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [releaseDateFrom, setReleaseDateFrom] = useState<Date>();
  const [releaseDateTo, setReleaseDateTo] = useState<Date>();

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const handleDownload = (name: string) => {
    toast({ title: 'Download started', description: `Downloading ${name}...` });
  };

  // Filter downloads
  const filteredDownloads = downloads.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProduct = productFilter === 'all' || d.product === productFilter;
    const matchesVersion = versionFilter === 'all' || d.version === versionFilter;
    const matchesType = typeFilter === 'all' || d.type === typeFilter;
    const matchesTab = activeTab === 'all' || d.type === activeTab;

    let matchesDate = true;
    if (releaseDateFrom && d.date) {
      matchesDate = new Date(d.date) >= releaseDateFrom;
    }
    if (releaseDateTo && d.date && matchesDate) {
      matchesDate = new Date(d.date) <= releaseDateTo;
    }

    return matchesSearch && matchesProduct && matchesVersion && matchesType && matchesTab && matchesDate;
  });

  // Pagination
  const totalPages = Math.ceil(filteredDownloads.length / pageSize);
  const paginatedDownloads = filteredDownloads.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const resetFilters = () => {
    setSearchQuery('');
    setProductFilter('all');
    setVersionFilter('all');
    setTypeFilter('all');
    setReleaseDateFrom(undefined);
    setReleaseDateTo(undefined);
    setCurrentPage(1);
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'installer': return 'Installer';
      case 'docs': return 'Documentation';
      case 'newsletter': return 'Newsletter';
      case 'ratesheet': return 'Rate Sheet';
      case 'releasenotes': return 'Release Notes';
      default: return type;
    }
  };

  const columns: DataTableColumn<DownloadItem>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (d) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
            {d.type === 'installer' ? (
              <Package className="h-5 w-5 text-muted-foreground" />
            ) : (
              <FileText className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="font-medium">{d.name}</p>
            <p className="text-xs text-muted-foreground">{d.size}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (d) => (
        <Badge variant="outline">{getTypeLabel(d.type)}</Badge>
      ),
    },
    {
      key: 'product',
      header: 'Product',
      render: (d) => d.product || '-',
    },
    {
      key: 'version',
      header: 'Version',
      render: (d) => d.version || '-',
    },
    {
      key: 'date',
      header: 'Release Date',
      render: (d) => d.date ? new Date(d.date).toLocaleDateString() : '-',
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (d) => (
        <Button variant="outline" size="sm" onClick={() => handleDownload(d.name)}>
          <Download className="h-4 w-4 mr-1" /> Download
        </Button>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <ListingPageHeader
          title="Downloads"
          description="Software, documentation, and resources"
          showCompanyContext={false}
        />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setCurrentPage(1); }}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="installer">Installers</TabsTrigger>
            <TabsTrigger value="docs">Documentation</TabsTrigger>
            <TabsTrigger value="newsletter">Newsletters</TabsTrigger>
            <TabsTrigger value="ratesheet">Rate Sheets</TabsTrigger>
            <TabsTrigger value="releasenotes">Release Notes</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search & Filters */}
        <SearchFilterCard
          searchValue={searchQuery}
          onSearchChange={(v) => { setSearchQuery(v); setCurrentPage(1); }}
          searchPlaceholder="Search downloads..."
          onReset={resetFilters}
          filters={
            <>
              <FilterField
                label="Product"
                value={productFilter}
                onChange={(v) => { setProductFilter(v); setCurrentPage(1); }}
                options={[
                  { value: 'all', label: 'All Products' },
                  { value: 'Desktop', label: 'Desktop' },
                  { value: 'Web', label: 'Web' },
                  { value: 'All', label: 'All Products' },
                ]}
              />
              <FilterField
                label="Version"
                value={versionFilter}
                onChange={(v) => { setVersionFilter(v); setCurrentPage(1); }}
                options={[
                  { value: 'all', label: 'All Versions' },
                  { value: '5.2', label: 'v5.2' },
                  { value: '5.1', label: 'v5.1' },
                  { value: '5.0', label: 'v5.0' },
                  { value: '3.0', label: 'v3.0' },
                  { value: '2024', label: '2024' },
                  { value: '2023', label: '2023' },
                ]}
              />
              <FilterField
                label="Document Type"
                value={typeFilter}
                onChange={(v) => { setTypeFilter(v); setCurrentPage(1); }}
                options={[
                  { value: 'all', label: 'All Types' },
                  { value: 'installer', label: 'Installer' },
                  { value: 'docs', label: 'Documentation' },
                  { value: 'newsletter', label: 'Newsletter' },
                  { value: 'ratesheet', label: 'Rate Sheet' },
                  { value: 'releasenotes', label: 'Release Notes' },
                ]}
              />
              <FilterField
                label="Release"
                type="dateRange"
                dateFromValue={releaseDateFrom}
                dateToValue={releaseDateTo}
                onDateFromChange={(d) => { setReleaseDateFrom(d); setCurrentPage(1); }}
                onDateToChange={(d) => { setReleaseDateTo(d); setCurrentPage(1); }}
              />
            </>
          }
        />

        {/* Data Table */}
        <div>
          <DataTable
            columns={columns}
            data={paginatedDownloads}
            keyExtractor={(d) => d.id}
            emptyMessage="No downloads found matching your criteria."
            emptyIcon={<FileText className="h-12 w-12 text-muted-foreground" />}
          />
          <Card className="rounded-t-none border-t-0">
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalRecords={filteredDownloads.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
            />
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};
