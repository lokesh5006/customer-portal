import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { DashboardWidgetCard } from './DashboardWidgetCard';
import { MessageSquare, Plus, Clock, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const MyTicketsWidget = () => {
  const navigate = useNavigate();
  const { currentUser, getCompanyTickets } = useApp();
  
  const allTickets = getCompanyTickets();
  const myTickets = allTickets.filter(t => t.userId === currentUser?.id);
  const openTickets = myTickets.filter(t => t.status === 'open' || t.status === 'in-progress');
  const resolvedTickets = myTickets.filter(t => t.status === 'resolved' || t.status === 'closed');

  return (
    <DashboardWidgetCard 
      title="My Support Tickets" 
      icon={MessageSquare}
      onClick={() => navigate('/support')}
    >
      <div className="space-y-3">
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-warning" />
            <div>
              <span className="font-bold">{openTickets.length}</span>
              <span className="text-xs text-muted-foreground ml-1">open</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <div>
              <span className="font-bold">{resolvedTickets.length}</span>
              <span className="text-xs text-muted-foreground ml-1">resolved</span>
            </div>
          </div>
        </div>
        
        {myTickets.length > 0 ? (
          <div className="space-y-2">
            {myTickets.slice(0, 3).map(ticket => (
              <div key={ticket.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{ticket.subject}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(ticket.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <Badge 
                  variant="outline" 
                  className={`shrink-0 ${
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
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">
            No tickets submitted yet
          </p>
        )}
        
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full"
          onClick={(e) => { e.stopPropagation(); navigate('/support'); }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create New Ticket
        </Button>
      </div>
    </DashboardWidgetCard>
  );
};
