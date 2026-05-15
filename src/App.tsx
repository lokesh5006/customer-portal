import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider } from "./contexts/AppContext";

// Pages
import { Welcome } from "./pages/Welcome";
import { Login } from "./pages/Login";
import { CompanySelection } from "./pages/CompanySelection";
import { SignupWizard } from "./pages/SignupWizard";
import { Dashboard } from "./pages/Dashboard";
import { UsersPage } from "./pages/UsersPage";
import { UsersContactsPage } from "./pages/UsersContactsPage";
import { SubscriptionsPage } from "./pages/SubscriptionsPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { LicenseReductionPage } from "./pages/LicenseReductionPage";
import { BillingPage } from "./pages/BillingPage";
import { DownloadsPage } from "./pages/DownloadsPage";
import { NewsPage } from "./pages/NewsPage";
import { SupportPage } from "./pages/SupportPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ContactsPage } from "./pages/ContactsPage";
import { QuotesPage } from "./pages/QuotesPage";
import { AdminPage } from "./pages/AdminPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Welcome />} />
            <Route path="/login" element={<Login />} />
            <Route path="/select-company" element={<CompanySelection />} />
            <Route path="/signup" element={<SignupWizard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/users" element={<UsersContactsPage />} />
            <Route path="/users-contacts" element={<UsersContactsPage />} />
            <Route path="/subscriptions" element={<SubscriptionsPage />} />
            <Route path="/licenses" element={<Navigate to="/subscriptions" replace />} />
            <Route path="/licenses/reduce" element={<LicenseReductionPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/invoices" element={<BillingPage />} />
            <Route path="/quotes" element={<QuotesPage />} />
            <Route path="/contacts" element={<UsersContactsPage />} />
            <Route path="/downloads" element={<DownloadsPage />} />
            <Route path="/news" element={<NewsPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AppProvider>
  </QueryClientProvider>
);

export default App;
