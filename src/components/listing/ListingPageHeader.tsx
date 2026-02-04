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
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {showCompanyContext && currentCompany && (
          <p className="text-muted-foreground">
            {description || `for ${currentCompany.name}`}
          </p>
        )}
        {!showCompanyContext && description && (
          <p className="text-muted-foreground">{description}</p>
        )}
      </div>
      {(primaryAction || secondaryAction) && (
        <div className="flex gap-2 flex-shrink-0">
          {secondaryAction}
          {primaryAction}
        </div>
      )}
    </div>
  );
};
