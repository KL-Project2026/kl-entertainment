import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuthStore } from "@/lib/auth";

// Staff pages
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import RoomBoard from "@/pages/room-board";
import Branches from "@/pages/branches";
import Products from "@/pages/products";
import Reservations from "@/pages/reservations";
import ReservationDetail from "@/pages/reservation-detail";
import BookingWizard from "@/pages/booking-wizard";
import POS from "@/pages/pos";
import Staff from "@/pages/staff";
import StaffDetail from "@/pages/staff-detail";
import ScheduleBuilder from "@/pages/schedule-builder";
import Attendance from "@/pages/attendance";
import Agents from "@/pages/agents";
import AgentDetail from "@/pages/agent-detail";
import Shareholders from "@/pages/shareholders";
import ShareholderDetail from "@/pages/shareholder-detail";
import InvestorDashboard from "@/pages/investor-dashboard";
import Reports from "@/pages/reports";
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
  const existingAuth = (config?.headers as Record<string, string> | undefined)?.Authorization;
  if (token && resourceStr.startsWith("/api") && !existingAuth) {
    config = config || {};
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
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

function Router() {
  return (
    <Switch>
      {/* Staff portal */}
      <Route path="/login" component={Login} />
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/room-board" component={() => <ProtectedRoute component={RoomBoard} />} />
      <Route path="/branches" component={() => <ProtectedRoute component={Branches} />} />
      <Route path="/products" component={() => <ProtectedRoute component={Products} />} />
      <Route path="/reservations" component={() => <ProtectedRoute component={Reservations} />} />
      <Route path="/reservations/new" component={() => <ProtectedRoute component={BookingWizard} />} />
      <Route path="/reservations/:id" component={() => <ProtectedRoute component={ReservationDetail} />} />
      <Route path="/pos" component={() => <ProtectedRoute component={POS} />} />
      <Route path="/staff" component={() => <AuthRoute component={Staff} />} />
      <Route path="/staff/:id" component={() => <AuthRoute component={StaffDetail} />} />
      <Route path="/schedule-builder" component={() => <AuthRoute component={ScheduleBuilder} />} />
      <Route path="/attendance" component={() => <AuthRoute component={Attendance} />} />
      <Route path="/agents" component={() => <AuthRoute component={Agents} />} />
      <Route path="/agents/:id" component={() => <AuthRoute component={AgentDetail} />} />
      <Route path="/shareholders" component={() => <AuthRoute component={Shareholders} />} />
      <Route path="/shareholders/:id" component={() => <AuthRoute component={ShareholderDetail} />} />
      <Route path="/investor-dashboard" component={() => <AuthRoute component={InvestorDashboard} />} />
      <Route path="/reports" component={() => <AuthRoute component={Reports} />} />

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
