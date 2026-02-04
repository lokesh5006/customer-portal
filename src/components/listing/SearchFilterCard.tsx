import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, RotateCcw } from 'lucide-react';

interface SearchFilterCardProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ReactNode;
  onReset?: () => void;
  onSearch?: () => void;
  showSearchButton?: boolean;
}

export const SearchFilterCard = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters,
  onReset,
  onSearch,
  showSearchButton = false,
}: SearchFilterCardProps) => {
  return (
    <Card className="bg-muted/30">
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Search Input */}
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9 bg-background"
              />
            </div>
          </div>

          {/* Additional Filters */}
          {filters}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {showSearchButton && onSearch && (
              <Button onClick={onSearch}>
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            )}
            {onReset && (
              <Button variant="outline" onClick={onReset}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
