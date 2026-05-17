import { useEffect, useMemo, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApp } from '@/contexts/AppContext';
import { ProfileTab } from './ProfileTab';
import { PasswordTab } from './PasswordTab';
import { PaymentTab } from './PaymentTab';
import { NotificationsTab } from './NotificationsTab';
import type { ProfileDrawerTab } from '@/lib/profileDrawer';

interface ProfileSettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: ProfileDrawerTab;
}

export function ProfileSettingsDrawer({ open, onOpenChange, initialTab = 'profile' }: ProfileSettingsDrawerProps) {
  const { can } = useApp();
  const showPaymentTab = can('billing.manage_methods') || can('billing.view');

  const [activeTab, setActiveTab] = useState<ProfileDrawerTab>(initialTab);

  // When drawer opens or initialTab changes externally, sync.
  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  // If Payment tab is selected but role lost access, fall back to Profile.
  useEffect(() => {
    if (activeTab === 'payment' && !showPaymentTab) {
      setActiveTab('profile');
    }
  }, [activeTab, showPaymentTab]);

  const tabsListClass = useMemo(
    () => showPaymentTab ? 'grid grid-cols-4 mx-6 mt-4 shrink-0' : 'grid grid-cols-3 mx-6 mt-4 shrink-0',
    [showPaymentTab],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b text-left">
          <SheetTitle>Profile Settings</SheetTitle>
          <SheetDescription>Manage your account settings and preferences</SheetDescription>
        </SheetHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as ProfileDrawerTab)}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className={tabsListClass}>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
            {showPaymentTab && <TabsTrigger value="payment">Payment</TabsTrigger>}
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            <TabsContent value="profile" className="mt-0">
              <ProfileTab onClose={() => onOpenChange(false)} />
            </TabsContent>
            <TabsContent value="password" className="mt-0">
              <PasswordTab />
            </TabsContent>
            {showPaymentTab && (
              <TabsContent value="payment" className="mt-0">
                <PaymentTab />
              </TabsContent>
            )}
            <TabsContent value="notifications" className="mt-0">
              <NotificationsTab />
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
