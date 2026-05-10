import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuthStore } from "@/lib/auth";

// Staff pages
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import Dashboard from "@/pages/dashboard";
import RoomBoard from "@/pages/room-board";
import Branches from "@/pages/branches";
import Products from "@/pages/products";
import ProductDetail from "@/pages/product-detail";
import SettingsMenuConfig from "@/pages/settings-menu-config";
import SettingsUsers from "@/pages/settings-users";
import Reservations from "@/pages/reservations";
import ReservationDetail from "@/pages/reservation-detail";
import BookingWizard from "@/pages/booking-wizard";
import POS from "@/pages/pos";
import Staff from "@/pages/staff";
import StaffDetail from "@/pages/staff-detail";
import HostessProfiles from "@/pages/hostess-profiles";
import HostessProfileDetail from "@/pages/hostess-profile-detail";
import AgencyManagement from "@/pages/agency-management";
import AgencyDetail from "@/pages/agency-detail";
import ScheduleBuilder from "@/pages/schedule-builder";
import Attendance from "@/pages/attendance";
import Agents from "@/pages/agents";
import AgentDetail from "@/pages/agent-detail";
import Shareholders from "@/pages/shareholders";
import ShareholderDetail from "@/pages/shareholder-detail";
import InvestorDashboard from "@/pages/investor-dashboard";
import InvestorReports from "@/pages/investor-reports";
import HostessDashboard from "@/pages/hostess-dashboard";
import BranchManagerDashboard from "@/pages/branch-manager-dashboard";
import ManagerDashboard from "@/pages/manager-dashboard";
import DriverDashboard from "@/pages/driver-dashboard";
import KitchenDashboard from "@/pages/kitchen-dashboard";
import HallDashboard from "@/pages/hall-dashboard";
import GeneralDashboard from "@/pages/general-dashboard";
import Reports from "@/pages/reports";
import Invoices from "@/pages/invoices";
import InvoiceDetail from "@/pages/invoice-detail";
import Tables from "@/pages/tables";
import TableDetail from "@/pages/table-detail";
import DailyReport from "@/pages/daily-report";
import MyProfile from "@/pages/my-profile";
import MyLedger from "@/pages/my-ledger";
import DesignGallery from "@/pages/design-gallery";

import { DashboardLayout } from "@/components/layout";

// Customer portal pages
import CustomerLogin from "@/pages/customer/login";
import CustomerDashboard from "@/pages/customer/dashboard";
import CustomerBooking from "@/pages/customer/booking";
import CustomerHistory from "@/pages/customer/history";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Setup global fetch interceptor to inject staff JWT (only if no explicit Authorization set)
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [resource, config] = args;

  const storageStr = localStorage.getItem("kl-auth-storage");
  let token = null;
  if (storageStr) {
    try {
      const parsed = JSON.parse(storageStr);
      token = parsed.state?.token;
    } catch {
      // ignore
    }
  }

  const resourceStr = resource.toString();

  // Support both plain objects and Headers instances when checking for existing auth
  const rawHeaders = config?.headers;
  const existingAuth =
    rawHeaders instanceof Headers
      ? rawHeaders.get("Authorization")
      : (rawHeaders as Record<string, string> | undefined)?.Authorization;

  if (token && resourceStr.startsWith("/api") && !existingAuth) {
    config = config ? { ...config } : {};
    // Preserve existing headers regardless of type (Headers instance or plain object)
    const base: Record<string, string> =
      rawHeaders instanceof Headers
        ? Object.fromEntries(rawHeaders.entries())
        : { ...(rawHeaders as Record<string, string> | undefined) };
    config.headers = { ...base, Authorization: `Bearer ${token}` };
  }

  const response = await originalFetch(resource, config);

  if (response.status === 401 && window.location.pathname !== "/login" && !window.location.pathname.startsWith("/customer")) {
    useAuthStore.getState().logout();
    window.location.href = "/login";
  }

  return response;
};

// Protected Route — wraps with DashboardLayout
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { token } = useAuthStore();

  if (!token) {
    return <Redirect to="/login" />;
  }

  return (
    <DashboardLayout>
      <Component />
    </DashboardLayout>
  );
}

// Auth Route — auth check only, component manages its own layout
function AuthRoute({ component: Component }: { component: React.ComponentType }) {
  const { token } = useAuthStore();
  if (!token) return <Redirect to="/login" />;
  return <Component />;
}

// Role-based home — redirects each role to their dedicated dashboard
const ROLE_HOME: Record<string, string> = {
  investor:       "/investor-dashboard",
  branch_manager: "/branch-manager-dashboard",
  manager:        "/manager-dashboard",
  hostess:        "/hostess-dashboard",
  driver:         "/driver-dashboard",
  kitchen:        "/kitchen-dashboard",
  hall:           "/hall-dashboard",
  general:        "/general-dashboard",
};

function RoleHome() {
  const { token, user } = useAuthStore();
  if (!token) return <Redirect to="/login" />;
  const target = ROLE_HOME[user?.role ?? ""] ?? null;
  if (target) return <Redirect to={target} />;
  return (
    <DashboardLayout>
      <Dashboard />
    </DashboardLayout>
  );
}

function Router() {
  return (
    <Switch>
      {/* Staff portal */}
      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/" component={RoleHome} />
      <Route path="/room-board" component={() => <ProtectedRoute component={RoomBoard} />} />
      <Route path="/branches" component={() => <ProtectedRoute component={Branches} />} />
      <Route path="/products" component={() => <ProtectedRoute component={Products} />} />
      <Route path="/products/:id" component={() => <AuthRoute component={ProductDetail} />} />
      <Route path="/settings/menu-config" component={() => <ProtectedRoute component={SettingsMenuConfig} />} />
      <Route path="/settings/users" component={() => <ProtectedRoute component={SettingsUsers} />} />
      <Route path="/reservations" component={() => <ProtectedRoute component={Reservations} />} />
      <Route path="/reservations/new" component={() => <ProtectedRoute component={BookingWizard} />} />
      <Route path="/reservations/:id" component={() => <AuthRoute component={ReservationDetail} />} />
      <Route path="/pos" component={() => <ProtectedRoute component={POS} />} />
      <Route path="/staff" component={() => <AuthRoute component={Staff} />} />
      <Route path="/staff/hostesses" component={() => <AuthRoute component={HostessProfiles} />} />
      <Route path="/staff/hostesses/:id" component={() => <AuthRoute component={HostessProfileDetail} />} />
      <Route path="/agencies" component={() => <AuthRoute component={AgencyManagement} />} />
      <Route path="/agencies/:id" component={() => <AuthRoute component={AgencyDetail} />} />
      <Route path="/staff/:id" component={() => <AuthRoute component={StaffDetail} />} />
      <Route path="/schedule-builder" component={() => <AuthRoute component={ScheduleBuilder} />} />
      <Route path="/attendance" component={() => <AuthRoute component={Attendance} />} />
      <Route path="/agents" component={() => <AuthRoute component={Agents} />} />
      <Route path="/agents/:id" component={() => <AuthRoute component={AgentDetail} />} />
      <Route path="/shareholders" component={() => <AuthRoute component={Shareholders} />} />
      <Route path="/shareholders/:id" component={() => <AuthRoute component={ShareholderDetail} />} />
      <Route path="/investor-dashboard" component={() => <AuthRoute component={InvestorDashboard} />} />
      <Route path="/investor-reports" component={() => <AuthRoute component={InvestorReports} />} />
      <Route path="/hostess-dashboard" component={() => <AuthRoute component={HostessDashboard} />} />
      <Route path="/branch-manager-dashboard" component={() => <AuthRoute component={BranchManagerDashboard} />} />
      <Route path="/manager-dashboard" component={() => <AuthRoute component={ManagerDashboard} />} />
      <Route path="/driver-dashboard" component={() => <AuthRoute component={DriverDashboard} />} />
      <Route path="/kitchen-dashboard" component={() => <AuthRoute component={KitchenDashboard} />} />
      <Route path="/hall-dashboard" component={() => <AuthRoute component={HallDashboard} />} />
      <Route path="/general-dashboard" component={() => <AuthRoute component={GeneralDashboard} />} />
      <Route path="/reports" component={() => <AuthRoute component={Reports} />} />

      {/* ── 신규 라우트 ── */}
      <Route path="/invoices" component={() => <AuthRoute component={Invoices} />} />
      <Route path="/invoices/:id" component={() => <AuthRoute component={InvoiceDetail} />} />
      <Route path="/tables" component={() => <AuthRoute component={Tables} />} />
      <Route path="/tables/:id" component={() => <AuthRoute component={TableDetail} />} />
      <Route path="/reports/daily" component={() => <AuthRoute component={DailyReport} />} />
      <Route path="/my-profile" component={() => <AuthRoute component={MyProfile} />} />
      <Route path="/my-ledger"  component={() => <AuthRoute component={MyLedger} />} />
      {/* Internal: design system gallery (§19) */}
      <Route path="/admin/_design" component={() => <ProtectedRoute component={DesignGallery} />} />
      {/* Customer portal */}
      <Route path="/customer/login" component={CustomerLogin} />
      <Route path="/customer/booking" component={CustomerBooking} />
      <Route path="/customer/history" component={CustomerHistory} />
      <Route path="/customer" component={CustomerDashboard} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
