import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApp, PRODUCT_CATALOG } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Download,
  ChevronDown,
  Monitor,
  Globe,
  ExternalLink,
  BookOpen,
  FileText,
  Info,
  Package,
} from 'lucide-react';
import { ListingPageHeader } from '@/components/listing';
import { cn } from '@/lib/utils';

interface ResourceItem {
  label: string;
  url: string;
}

const productResources: Record<string, ResourceItem[]> = {
  'NumberCruncher Desktop': [
    { label: 'Installation Instructions', url: '#' },
    { label: 'Quickstart Guide', url: '#' },
    { label: 'Release Notes', url: '#' },
    { label: 'Documentation', url: '#' },
    { label: 'Product Info', url: '#' },
  ],
  'NumberCruncher Web': [
    { label: 'Installation Instructions', url: '#' },
    { label: 'Quickstart Guide', url: '#' },
    { label: 'Release Notes', url: '#' },
    { label: 'Documentation', url: '#' },
    { label: 'Product Info', url: '#' },
  ],
  'QuickView Desktop': [
    { label: 'Installation Instructions', url: '#' },
    { label: 'Quickstart Guide', url: '#' },
    { label: 'Release Notes', url: '#' },
    { label: 'Documentation', url: '#' },
    { label: 'Product Info', url: '#' },
  ],
  'DataNet': [
    { label: 'Quickstart Guide', url: '#' },
    { label: 'Documentation', url: '#' },
    { label: 'Product Info', url: '#' },
  ],
};

const downloadFormats: Record<string, { label: string; isDefault?: boolean }[]> = {
  'NumberCruncher Desktop': [
    { label: 'EXE Installer', isDefault: true },
    { label: 'MSI Installer' },
    { label: 'ZIP Archive' },
  ],
  'QuickView Desktop': [
    { label: 'EXE Installer', isDefault: true },
    { label: 'MSI Installer' },
  ],
};

export const DownloadsPage = () => {
  const { getCompanySubscriptions } = useApp();
  const { toast } = useToast();
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>('');

  const subscriptions = getCompanySubscriptions();

  // Get all purchased product names
  const purchasedProducts = new Set<string>();
  subscriptions.forEach(sub => {
    sub.products.forEach(p => {
      purchasedProducts.add(p.name);
    });
  });

  const handleDownload = (productName: string, format?: string) => {
    toast({
      title: 'Download Started',
      description: `Downloading ${productName}${format ? ` (${format})` : ''}...`,
    });
  };

  const openResources = (productName: string) => {
    setSelectedProduct(productName);
    setResourcesOpen(true);
  };

  const getProductIcon = (type: string) => {
    switch (type) {
      case 'desktop': return Monitor;
      case 'web': return Globe;
      case 'service': return ExternalLink;
      default: return Package;
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <ListingPageHeader
          title="Product Downloads & Links"
          description="Software downloads, documentation, and resources"
          showCompanyContext={false}
        />

        <div className="grid gap-4 md:grid-cols-2">
          {PRODUCT_CATALOG.map(product => {
            const isPurchased = purchasedProducts.has(product.name);
            const Icon = getProductIcon(product.type);
            const formats = downloadFormats[product.name];

            return (
              <Card
                key={product.name}
                className={cn(
                  'transition-all',
                  !isPurchased && 'opacity-50'
                )}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'h-10 w-10 rounded-lg flex items-center justify-center',
                        isPurchased ? 'bg-primary/10' : 'bg-muted'
                      )}>
                        <Icon className={cn('h-5 w-5', isPurchased ? 'text-primary' : 'text-muted-foreground')} />
                      </div>
                      <div>
                        <h3 className="font-semibold">{product.name}</h3>
                        <p className="text-xs text-muted-foreground">{product.description}</p>
                      </div>
                    </div>
                    {isPurchased ? (
                      <Badge variant="outline" className="status-active">Licensed</Badge>
                    ) : (
                      <Badge variant="outline" className="status-inactive">Not Purchased</Badge>
                    )}
                  </div>

                  {product.latestVersion && (
                    <p className="text-xs text-muted-foreground mb-3">Latest: v{product.latestVersion}</p>
                  )}

                  <div className="flex items-center gap-2">
                    {/* Download split button */}
                    {product.hasInstaller && isPurchased ? (
                      <div className="flex">
                        <Button
                          size="sm"
                          className="rounded-r-none"
                          onClick={() => handleDownload(product.name)}
                          disabled={!isPurchased}
                        >
                          <Download className="h-4 w-4 mr-1" />Download
                        </Button>
                        {formats ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" className="rounded-l-none border-l border-primary-foreground/20 px-2">
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <div className="px-2 py-1 text-xs font-medium text-muted-foreground">All Formats</div>
                              {formats.map(f => (
                                <DropdownMenuItem
                                  key={f.label}
                                  onClick={() => handleDownload(product.name, f.label)}
                                >
                                  {f.label}
                                  {f.isDefault && (
                                    <Badge variant="outline" className="ml-2 text-[10px] py-0">Default</Badge>
                                  )}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </div>
                    ) : product.type === 'web' && isPurchased ? (
                      <Button size="sm" variant="outline" onClick={() => window.open('#', '_blank')}>
                        <ExternalLink className="h-4 w-4 mr-1" />Launch Web App
                      </Button>
                    ) : product.type === 'service' && isPurchased ? (
                      <Button size="sm" variant="outline" onClick={() => window.open('#', '_blank')}>
                        <ExternalLink className="h-4 w-4 mr-1" />Open DataNet
                      </Button>
                    ) : !isPurchased ? (
                      <Button size="sm" variant="outline" disabled>
                        <Download className="h-4 w-4 mr-1" />Not Available
                      </Button>
                    ) : null}

                    {/* Resources button with tooltip */}
                    {isPurchased && productResources[product.name] && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openResources(product.name)}
                          >
                            <BookOpen className="h-4 w-4 mr-1" />Resources
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Helpful links including installation instructions and quick start guides are here.</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Resources Flyout */}
      <Dialog open={resourcesOpen} onOpenChange={setResourcesOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedProduct} Resources</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            {(productResources[selectedProduct] || []).map((res, i) => (
              <a
                key={i}
                href={res.url}
                className="flex items-center gap-3 p-3 rounded-md hover:bg-muted/50 transition-colors group"
                onClick={(e) => {
                  e.preventDefault();
                  toast({ title: 'Opening resource', description: `Opening ${res.label}...` });
                }}
              >
                <FileText className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                <span className="text-sm font-medium group-hover:text-primary">{res.label}</span>
                <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100" />
              </a>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};
