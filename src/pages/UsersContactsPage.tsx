import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UsersPage } from './UsersPage';
import { ContactsPage } from './ContactsPage';

/**
 * Combined Users & Contacts page.
 * Uses a top tab bar to switch between the existing UsersPage and ContactsPage.
 * Each child page brings its own MainLayout/header/toolbar which keeps the
 * implementation minimal while reducing nav clutter.
 */
export const UsersContactsPage = () => {
  const [params, setParams] = useSearchParams();
  const initial = params.get('tab') === 'contacts' ? 'contacts' : 'users';
  const [tab, setTab] = useState<string>(initial);

  const handleChange = (value: string) => {
    setTab(value);
    setParams({ tab: value }, { replace: true });
  };

  return (
    <div>
      {/* Sticky tab bar above the page content */}
      <div className="sticky top-14 z-30 bg-background border-b">
        <div className="container mx-auto px-6">
          <Tabs value={tab} onValueChange={handleChange}>
            <TabsList className="my-2">
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="contacts">Contacts</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      {tab === 'users' ? <UsersPage /> : <ContactsPage />}
    </div>
  );
};

export default UsersContactsPage;
