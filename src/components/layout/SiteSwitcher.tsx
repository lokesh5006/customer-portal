import { useLocation, useNavigate } from 'react-router-dom';
import { Building2, ChevronDown } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

/**
 * v18 — header Site switcher. Rendered only when the logged-in user is a member of more
 * than one Site in their firm (same pattern as the subscription selector, which only
 * appears for >1 subscription). Hidden during proxy sessions: the proxied view is
 * pinned to the Site the proxy was started from.
 */
export const SiteSwitcher = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { currentSite, getUserSites, switchSite, isProxySession } = useApp();

  const sites = getUserSites();
  if (isProxySession || sites.length <= 1 || !currentSite) return null;

  const handleChange = (siteId: string) => {
    if (siteId === currentSite.id) return;
    switchSite(siteId);
    // Record-specific routes may point at the previous Site's data — fall back to the list.
    if (location.pathname.startsWith('/subscriptions/')) navigate('/subscriptions');
    else if (location.pathname === '/pay') navigate('/invoices');
    toast({
      title: 'Site switched',
      description: `Now viewing ${sites.find(s => s.id === siteId)?.name}`,
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2 px-2.5" aria-label={`Site: ${currentSite.name}. Switch site`}>
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="hidden sm:inline text-xs text-muted-foreground">Site:</span>
          <span className="text-sm font-medium max-w-[10rem] truncate">{currentSite.name}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Switch site</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={currentSite.id} onValueChange={handleChange}>
          {sites.map(site => (
            <DropdownMenuRadioItem key={site.id} value={site.id}>
              {site.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
