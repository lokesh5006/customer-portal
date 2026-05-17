import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Notification } from '@/contexts/AppContext';
import { formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';

interface NotificationPanelProps {
  notifications: Notification[];
  onItemClick: (n: Notification) => void;
  onMarkAllRead: () => void;
  onSettingsClick: () => void;
}

const MAX_VISIBLE = 20;

export function NotificationPanel({
  notifications,
  onItemClick,
  onMarkAllRead,
  onSettingsClick,
}: NotificationPanelProps) {
  const unreadCount = notifications.filter(n => !n.readAt).length;
  const visible = notifications.slice(0, MAX_VISIBLE);
  const hasMore = notifications.length > MAX_VISIBLE;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-base font-semibold">Notifications</h3>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="text-xs text-primary hover:underline"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Body */}
      <div className="max-h-[480px] overflow-y-auto">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
            <Bell className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium">You&apos;re all caught up.</p>
            <p className="text-xs text-muted-foreground mt-1">
              We&apos;ll let you know when something needs your attention.
            </p>
          </div>
        ) : (
          visible.map(notification => (
            <button
              key={notification.id}
              type="button"
              onClick={() => onItemClick(notification)}
              className={cn(
                'w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border last:border-b-0',
                !notification.readAt && 'bg-primary/5',
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  {!notification.readAt ? (
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  ) : (
                    <div className="h-2 w-2" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-tight">{notification.title}</p>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatRelativeTime(notification.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {notification.message}
                  </p>
                  {notification.linkLabel && (
                    <span className="text-xs text-primary mt-1 inline-block">
                      {notification.linkLabel} →
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}

        {hasMore && (
          <div className="px-4 py-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              disabled
              className="w-full text-xs"
              title="Notification history page coming soon."
            >
              View all
            </Button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border px-4 py-2 flex justify-center">
        <button
          type="button"
          onClick={onSettingsClick}
          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          Notification settings
        </button>
      </div>
    </div>
  );
}
