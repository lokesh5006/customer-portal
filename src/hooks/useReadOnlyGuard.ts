import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';

export const READ_ONLY_TOOLTIP = 'Pay your pending invoice to unlock this feature.';

export const useReadOnlyGuard = () => {
  const { isReadOnlyMode } = useApp();
  const { toast } = useToast();
  const readOnly = isReadOnlyMode();

  const guardClick = (fn: () => void) => {
    if (readOnly) {
      toast({
        title: 'Action unavailable',
        description: READ_ONLY_TOOLTIP,
        variant: 'destructive',
      });
      return;
    }
    fn();
  };

  return { readOnly, guardClick };
};
