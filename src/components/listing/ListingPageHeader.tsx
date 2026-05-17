import { ReactNode } from 'react';
import { useApp } from '@/contexts/AppContext';

interface ListingPageHeaderProps {
  title: string;
  description?: string;
  showCompanyContext?: boolean;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
}

export const ListingPageHeader = ({
  title,
  description,
  showCompanyContext = true,
  primaryAction,
  secondaryAction,
}: ListingPageHeaderProps) => {
  const { currentCompany } = useApp();

  return (
    <div className="sticky top-16 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 -mx-6 -mt-6 mb-6">
      <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {showCompanyContext && currentCompany && (
            <p className="text-sm text-muted-foreground mt-1">
              {description || `for ${currentCompany.name}`}
            </p>
          )}
          {!showCompanyContext && description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {(primaryAction || secondaryAction) && (
          <div className="flex gap-2 flex-shrink-0">
            {secondaryAction}
            {primaryAction}
          </div>
        )}
      </div>
    </div>
  );
};
