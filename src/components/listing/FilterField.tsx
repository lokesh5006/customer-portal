import { ReactNode } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface SelectOption {
  value: string;
  label: string;
}

interface FilterFieldProps {
  label: string;
  type?: 'select' | 'input' | 'date' | 'dateRange';
  value?: string;
  onChange?: (value: string) => void;
  options?: SelectOption[];
  placeholder?: string;
  className?: string;
  dateValue?: Date;
  onDateChange?: (date: Date | undefined) => void;
  dateFromValue?: Date;
  dateToValue?: Date;
  onDateFromChange?: (date: Date | undefined) => void;
  onDateToChange?: (date: Date | undefined) => void;
}

export const FilterField = ({
  label,
  type = 'select',
  value,
  onChange,
  options = [],
  placeholder,
  className,
  dateValue,
  onDateChange,
  dateFromValue,
  dateToValue,
  onDateFromChange,
  onDateToChange,
}: FilterFieldProps) => {
  if (type === 'select') {
    return (
      <div className={cn('min-w-[140px]', className)}>
        <Label className="text-sm font-medium text-muted-foreground mb-1.5 block">
          {label}
        </Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder={placeholder || `Select ${label}`} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (type === 'input') {
    return (
      <div className={cn('min-w-[120px]', className)}>
        <Label className="text-sm font-medium text-muted-foreground mb-1.5 block">
          {label}
        </Label>
        <Input
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          className="bg-background"
        />
      </div>
    );
  }

  if (type === 'date') {
    return (
      <div className={cn('min-w-[140px]', className)}>
        <Label className="text-sm font-medium text-muted-foreground mb-1.5 block">
          {label}
        </Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full justify-start text-left font-normal bg-background',
                !dateValue && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateValue ? format(dateValue, 'MMM d, yyyy') : placeholder || 'Pick a date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateValue}
              onSelect={onDateChange}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  if (type === 'dateRange') {
    return (
      <div className={cn('flex gap-2 items-end', className)}>
        <div className="min-w-[140px]">
          <Label className="text-sm font-medium text-muted-foreground mb-1.5 block">
            {label} From
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal bg-background',
                  !dateFromValue && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFromValue ? format(dateFromValue, 'MMM d') : 'From'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFromValue}
                onSelect={onDateFromChange}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="min-w-[140px]">
          <Label className="text-sm font-medium text-muted-foreground mb-1.5 block">
            {label} To
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal bg-background',
                  !dateToValue && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateToValue ? format(dateToValue, 'MMM d') : 'To'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateToValue}
                onSelect={onDateToChange}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    );
  }

  return null;
};
