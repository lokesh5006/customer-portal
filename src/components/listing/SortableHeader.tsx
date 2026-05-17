import { ReactNode } from 'react';
import { ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SortDirection = 'asc' | 'desc' | null;

export interface SortState {
  key: string | null;
  direction: SortDirection;
}

interface SortableHeaderProps {
  label: ReactNode;
  sortKey: string;
  sort: SortState;
  onSortChange: (next: SortState) => void;
  align?: 'left' | 'right' | 'center';
}

/**
 * Clickable column header that cycles through asc → desc → none.
 * Renders a directional chevron when active, neutral chevron otherwise.
 * Pair with a parent that holds the SortState and applies the resulting sort to its data.
 */
export const SortableHeader = ({ label, sortKey, sort, onSortChange, align = 'left' }: SortableHeaderProps) => {
  const isActive = sort.key === sortKey && sort.direction !== null;
  const Icon = isActive
    ? (sort.direction === 'asc' ? ChevronUp : ChevronDown)
    : ChevronsUpDown;

  const handleClick = () => {
    if (sort.key !== sortKey) {
      onSortChange({ key: sortKey, direction: 'asc' });
      return;
    }
    if (sort.direction === 'asc') onSortChange({ key: sortKey, direction: 'desc' });
    else if (sort.direction === 'desc') onSortChange({ key: null, direction: null });
    else onSortChange({ key: sortKey, direction: 'asc' });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium hover:text-foreground focus:outline-none focus-visible:underline',
        isActive ? 'text-foreground' : 'text-muted-foreground',
        align === 'right' && 'flex-row-reverse w-full justify-end',
        align === 'center' && 'w-full justify-center',
      )}
      aria-label={`Sort by ${typeof label === 'string' ? label : sortKey}`}
    >
      <span>{label}</span>
      <Icon className={cn('h-3.5 w-3.5', isActive ? 'opacity-100' : 'opacity-60')} />
    </button>
  );
};
