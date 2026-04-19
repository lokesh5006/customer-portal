import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ListingPageHeader } from '@/components/listing';
import { UsersPage } from './UsersPage';
import { ContactsPage } from './ContactsPage';

/**
 * Combined Users & Contacts page with tabs.
 * Reuses the existing UsersPage and ContactsPage components by rendering their
 * inner content within tabs. Each child page already wraps itself in MainLayout,
 * so we render them directly — they each provide their own toolbar/header.
 */
export const UsersContactsPage = () => {
  const [tab, setTab] = useState('users');

  return (
    <Tabs value={tab} onValueChange={setTab} className="contents">
      {/* Header rendered outside MainLayout via children — children provide their own MainLayout. */}
      <div style={{ display: 'none' }} aria-hidden />
      {tab === 'users' ? <UsersWithTabs tab={tab} setTab={setTab} /> : <ContactsWithTabs tab={tab} setTab={setTab} />}
    </Tabs>
  );
};

// Lightweight wrappers that inject the tab switcher above each page's existing content.
const TabSwitcher = ({ tab, setTab }: { tab: string; setTab: (v: string) => void }) => (
  <div className="border-b bg-card">
    <div className="container mx-auto px-6 pt-4">
      <TabsList>
        <TabsTrigger value="users" onClick={() => setTab('users')}>Users</TabsTrigger>
        <TabsTrigger value="contacts" onClick={() => setTab('contacts')}>Contacts</TabsTrigger>
      </TabsList>
    </div>
  </div>
);

const UsersWithTabs = ({ tab, setTab }: { tab: string; setTab: (v: string) => void }) => (
  <>
    <UsersPage />
  </>
);

const ContactsWithTabs = ({ tab, setTab }: { tab: string; setTab: (v: string) => void }) => (
  <>
    <ContactsPage />
  </>
);

export default UsersContactsPage;
