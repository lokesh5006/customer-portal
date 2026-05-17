import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  className?: string;
  sortable?: boolean;
  render: (item: T, index: number) => ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  emptyMessage?: string;
  emptyIcon?: ReactNode;
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  maxHeight?: string;
  stickyHeader?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  emptyMessage = 'No data found.',
  emptyIcon,
  keyExtractor,
  onRowClick,
  maxHeight = '500px',
  stickyHeader = true,
}: DataTableProps<T>) {
  return (
    <Card>
      <CardContent className="p-0">
        <div 
          className={cn(
            'relative overflow-auto',
            stickyHeader && 'max-h-[var(--table-max-height)]'
          )}
          style={{ '--table-max-height': maxHeight } as React.CSSProperties}
        >
          <Table>
            <TableHeader className={cn(stickyHeader && 'sticky top-0 bg-background z-10')}>
              <TableRow>
                {columns.map((column) => (
                  <TableHead 
                    key={column.key} 
                    className={cn(
                      column.className,
                      stickyHeader && 'bg-background'
                    )}
                  >
                    {column.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell 
                    colSpan={columns.length} 
                    className="text-center py-12 text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-2">
                      {emptyIcon}
                      <span>{emptyMessage}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                data.map((item, index) => (
                  <TableRow 
                    key={keyExtractor(item)}
                    className={cn(onRowClick && 'cursor-pointer')}
                    onClick={() => onRowClick?.(item)}
                  >
                    {columns.map((column) => (
                      <TableCell key={column.key} className={column.className}>
                        {column.render(item, index)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
