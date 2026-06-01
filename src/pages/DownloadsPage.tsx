import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApp, PRODUCT_CATALOG, LICENSE_TYPE_BADGE, LicenseType } from '@/contexts/AppContext';
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

const releaseDates: Record<string, string> = {
  'NumberCruncher Desktop': '2026-04-10',
  'NumberCruncher Web': '2026-04-10',
  'QuickView Desktop': '2026-02-22',
  'DataNet': '2026-03-01',
};

const downloadFormats: Record<string, { label: string; isDefault?: boolean }[]> = {
  'NumberCruncher Desktop': [
    { label: '.exe (recommended)', isDefault: true },
    { label: '.msi (alternative)' },
    { label: 'Previous version (v4.1)' },
  ],
  'QuickView Desktop': [
    { label: '.exe (recommended)', isDefault: true },
    { label: '.msi (alternative)' },
    { label: 'Previous version (v2.0)' },
  ],
};

// Canonical Resources list shown in the product flyout (v15 Section D2).
const RESOURCE_ITEMS = [
  'Installation instructions',
  'Quickstart Guide',
  'Release Notes',
  'Documentation',
  'Product Info',
];

const getProductIcon = (type: string) => {
  switch (type) {
    case 'desktop': return Monitor;
    case 'web': return Globe;
    case 'service': return ExternalLink;
    default: return Package;
  }
};

export const DownloadsPage = () => {
  const navigate = useNavigate();
  const { getCompanySubscriptions, currentUser, licenses, isSuspendedMode } = useApp();
  const { toast } = useToast();
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>('');

  const subs = getCompanySubscriptions();
  const suspended = isSuspendedMode();
  // Treat suspended subscriptions as "owned" for badge/state purposes so users see what they're missing.
  const isSubscribed = (productName: string) =>
    subs.some(s => (s.status === 'active' || s.status === 'suspended') && s.products.some(p => p.name === productName));
  type ButtonState = 'enabled' | 'suspended' | 'not_subscribed';
  const buttonState = (productName: string): ButtonState => {
    if (!isSubscribed(productName)) return 'not_subscribed';
    return suspended ? 'suspended' : 'enabled';
  };

  // Per BR-090: IT Assistant license sessions auto-logout after 10 minutes — backend would enforce.
  const userLicenseTypeFor = (productName: string): LicenseType | null => {
    if (!currentUser) return null;
    for (const sub of subs) {
      const prod = sub.products.find(p => p.name === productName);
      if (!prod) continue;
      const lic = licenses.find(l => l.userId === currentUser.id && l.subscriptionId === sub.id && l.productId === prod.id);
      if (lic) return (lic.licenseType || 'paid') as LicenseType;
    }
    return null;
  };

  const handleDownload = (productName: string, format?: string) => {
    toast({
      title: 'Download Started',
      description: `Downloading ${productName}${format ? ` (${format})` : ''}...`,
    });
  };

  const handleOpen = (productName: string) => {
    if (productName === 'DataNet') {
      navigate('/datanet');
      return;
    }
    toast({
      title: `Opening ${productName}`,
      description: 'A new tab would open here in production.',
    });
  };

  const handleMoreInfo = (productName: string) => {
    if (productName === 'DataNet') {
      navigate('/datanet');
      return;
    }
    toast({
      title: `More info about ${productName}`,
      description: 'Contact sales for pricing details.',
    });
  };

  const openResources = (productName: string) => {
    setSelectedProduct(productName);
    setResourcesOpen(true);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <ListingPageHeader
          title="Product Downloads & Links"
          description="Access software, documentation, guides, and learning materials."
          showCompanyContext={false}
        />

        <div className="grid gap-4 md:grid-cols-2">
          {PRODUCT_CATALOG.map(product => {
            const state = buttonState(product.name);
            const subscribed = state !== 'not_subscribed';
            const isSuspendedProd = state === 'suspended';
            const Icon = getProductIcon(product.type);
            const formats = downloadFormats[product.name];
            const releasedOn = releaseDates[product.name];
            const isDesktop = product.type === 'desktop';
            const primaryLabel = isDesktop ? 'Download' : 'Open';
            const PrimaryIcon = isDesktop ? Download : ExternalLink;
            const disabledTooltip = isSuspendedProd
              ? 'Pay your renewal invoice to restore access.'
              : 'This product is not in your current subscription.';

            return (
              <Card key={product.name} className={cn('transition-all', isSuspendedProd && 'opacity-80', state === 'not_subscribed' && 'opacity-60')}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn('flex items-center gap-3', state === 'not_subscribed' && 'opacity-70')}>
                      <div className={cn(
                        'h-10 w-10 rounded-lg flex items-center justify-center',
                        subscribed ? 'bg-primary/10' : 'bg-muted'
                      )}>
                        <Icon className={cn('h-5 w-5', subscribed ? 'text-primary' : 'text-muted-foreground')} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-semibold">{product.name}</h3>
                          {(() => {
                            const lt = userLicenseTypeFor(product.name);
                            if (!lt || lt === 'paid') return null;
                            const badge = LICENSE_TYPE_BADGE[lt];
                            return (
                              <Badge variant="outline" className={`text-xs ${badge.className}`}>
                                {badge.label}
                              </Badge>
                            );
                          })()}
                        </div>
                        <p className="text-xs text-muted-foreground">{product.description}</p>
                      </div>
                    </div>
                    {state === 'enabled' && (
                      <Badge variant="outline" className="status-active">Licensed</Badge>
                    )}
                    {state === 'suspended' && (
                      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                        Access Restricted
                      </Badge>
                    )}
                    {state === 'not_subscribed' && (
                      <Badge variant="outline" className="text-muted-foreground bg-muted/40">
                        Not Subscribed
                      </Badge>
                    )}
                  </div>

                  <div className={cn('mb-3 text-xs text-muted-foreground space-y-0.5', state === 'not_subscribed' && 'opacity-70')}>
                    {product.latestVersion && (
                      <div>Latest: v{product.latestVersion}</div>
                    )}
                    {releasedOn && (
                      <div>Released {new Date(releasedOn).toLocaleDateString()}</div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {state === 'enabled' && (
                      <>
                        {isDesktop && product.hasInstaller ? (
                          <div className="flex">
                            <Button
                              size="sm"
                              className="rounded-r-none"
                              onClick={() => handleDownload(product.name)}
                            >
                              <Download className="h-4 w-4 mr-1" />Download
                            </Button>
                            {formats && (
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
                            )}
                          </div>
                        ) : (
                          <Button size="sm" onClick={() => handleOpen(product.name)}>
                            <ExternalLink className="h-4 w-4 mr-1" />Open
                          </Button>
                        )}

                        {productResources[product.name] && (
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
                      </>
                    )}

                    {(state === 'not_subscribed' || state === 'suspended') && (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span tabIndex={0}>
                              <Button
                                size="sm"
                                disabled
                                aria-disabled="true"
                                className="pointer-events-none"
                              >
                                <PrimaryIcon className="h-4 w-4 mr-1" />{primaryLabel}
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{disabledTooltip}</p>
                          </TooltipContent>
                        </Tooltip>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMoreInfo(product.name)}
                        >
                          <Info className="h-4 w-4 mr-1" />More Info
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Dialog open={resourcesOpen} onOpenChange={setResourcesOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedProduct} Resources</DialogTitle>
          </DialogHeader>
          <ol className="space-y-1 list-none">
            {RESOURCE_ITEMS.map((label, i) => (
              <li key={label}>
                <a
                  href="#"
                  className="flex items-center gap-3 p-3 rounded-md hover:bg-muted/50 transition-colors group"
                  onClick={(e) => {
                    e.preventDefault();
                    toast({ title: 'Opening resource', description: `Opening ${label}...` });
                  }}
                >
                  <span className="h-5 w-5 rounded-full bg-muted text-muted-foreground text-xs font-semibold flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium group-hover:text-primary">{label}</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100" />
                </a>
              </li>
            ))}
          </ol>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};
