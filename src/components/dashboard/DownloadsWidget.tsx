import { useNavigate } from 'react-router-dom';
import { DashboardWidgetCard } from './DashboardWidgetCard';
import { Download, FileText, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const DownloadsWidget = () => {
  const navigate = useNavigate();

  const recentDownloads = [
    { name: 'NumberCruncher v4.2.1', type: 'Installer', icon: Download },
    { name: 'Getting Started Guide', type: 'Documentation', icon: BookOpen },
    { name: 'Release Notes Q1 2024', type: 'Release Notes', icon: FileText },
  ];

  return (
    <DashboardWidgetCard 
      title="Downloads" 
      icon={Download}
      onClick={() => navigate('/downloads')}
    >
      <div className="space-y-3">
        <div className="space-y-2">
          {recentDownloads.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 p-2 bg-muted/50 rounded-md">
              <item.icon className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{item.name}</div>
                <div className="text-xs text-muted-foreground">{item.type}</div>
              </div>
            </div>
          ))}
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full"
          onClick={(e) => { e.stopPropagation(); navigate('/downloads'); }}
        >
          View All Downloads
        </Button>
      </div>
    </DashboardWidgetCard>
  );
};
