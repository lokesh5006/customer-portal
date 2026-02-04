import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { DashboardWidgetCard } from './DashboardWidgetCard';
import { LifeBuoy, MessageSquare, CheckCircle2, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const SupportSnapshotWidget = () => {
  const navigate = useNavigate();
  const { getCompanyTickets, currentUser } = useApp();
  
  const tickets = getCompanyTickets();
  const openTickets = tickets.filter(t => t.status === 'open' || t.status === 'in-progress');
  const resolvedTickets = tickets.filter(t => t.status === 'resolved' || t.status === 'closed');
  
  // Get my tickets for standard users
  const myTickets = tickets.filter(t => t.userId === currentUser?.id);

  return (
    <DashboardWidgetCard 
      title="Support" 
      icon={LifeBuoy}
      onClick={() => navigate('/support')}
    >
      <div className="space-y-3">
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-warning/10 rounded-full">
              <Clock className="h-4 w-4 text-warning" />
            </div>
            <div>
              <div className="font-bold">{openTickets.length}</div>
              <div className="text-xs text-muted-foreground">Open</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-success/10 rounded-full">
              <CheckCircle2 className="h-4 w-4 text-success" />
            </div>
            <div>
              <div className="font-bold">{resolvedTickets.length}</div>
              <div className="text-xs text-muted-foreground">Resolved</div>
            </div>
          </div>
        </div>
        
        {tickets.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Recent Tickets</div>
            {tickets.slice(0, 2).map(ticket => (
              <div key={ticket.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                <div className="flex items-center gap-2 min-w-0">
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">{ticket.subject}</span>
                </div>
                <Badge 
                  variant="outline" 
                  className={`shrink-0 text-xs ${
                    ticket.status === 'open' || ticket.status === 'in-progress' 
                      ? 'status-pending' 
                      : 'status-active'
                  }`}
                >
                  {ticket.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
        
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full"
          onClick={(e) => { e.stopPropagation(); navigate('/support'); }}
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Create Ticket
        </Button>
      </div>
    </DashboardWidgetCard>
  );
};
