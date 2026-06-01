import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

/**
 * Reusable empty state for tables/lists with no data.
 * Centered muted icon + short headline + description + optional CTA.
 */
export const EmptyState = ({ icon: Icon, title, description, actionLabel, onAction, className }: EmptyStateProps) => (
  <div className={cn('flex flex-col items-center justify-center text-center py-12 px-6', className)}>
    {Icon && (
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
    )}
    <p className="text-sm font-medium">{title}</p>
    {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
    {actionLabel && onAction && (
      <Button className="mt-4" onClick={onAction}>{actionLabel}</Button>
    )}
  </div>
);
