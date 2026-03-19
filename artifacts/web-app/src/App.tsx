import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuthStore } from "@/lib/auth";

// Pages
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import RoomBoard from "@/pages/room-board";
import Branches from "@/pages/branches";
import Products from "@/pages/products";
import Reservations from "@/pages/reservations";
import BookingWizard from "@/pages/booking-wizard";
import POS from "@/pages/pos";
import Staff from "@/pages/staff";
import ScheduleBuilder from "@/pages/schedule-builder";
import Attendance from "@/pages/attendance";
import Agents from "@/pages/agents";
import Shareholders from "@/pages/shareholders";
import InvestorDashboard from "@/pages/investor-dashboard";
import Reports from "@/pages/reports";
import { DashboardLayout } from "@/components/layout";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Setup global fetch interceptor to inject JWT
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [resource, config] = args;
  
  const storageStr = localStorage.getItem("kl-auth-storage");
  let token = null;
  if (storageStr) {
    try {
      const parsed = JSON.parse(storageStr);
      token = parsed.state?.token;
    } catch (e) {
      // ignore
    }
  }

  if (token && resource.toString().startsWith("/api")) {
    config = config || {};
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
  }
  
  const response = await originalFetch(resource, config);
  
  if (response.status === 401 && window.location.pathname !== "/login") {
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
      <Route path="/login" component={Login} />
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/room-board" component={() => <ProtectedRoute component={RoomBoard} />} />
      <Route path="/branches" component={() => <ProtectedRoute component={Branches} />} />
      <Route path="/products" component={() => <ProtectedRoute component={Products} />} />
      <Route path="/reservations" component={() => <ProtectedRoute component={Reservations} />} />
      <Route path="/reservations/new" component={() => <ProtectedRoute component={BookingWizard} />} />
      <Route path="/pos" component={() => <ProtectedRoute component={POS} />} />
      <Route path="/staff" component={() => <AuthRoute component={Staff} />} />
      <Route path="/schedule-builder" component={() => <AuthRoute component={ScheduleBuilder} />} />
      <Route path="/attendance" component={() => <AuthRoute component={Attendance} />} />
      <Route path="/agents" component={() => <AuthRoute component={Agents} />} />
      <Route path="/shareholders" component={() => <AuthRoute component={Shareholders} />} />
      <Route path="/investor-dashboard" component={() => <AuthRoute component={InvestorDashboard} />} />
      <Route path="/reports" component={() => <AuthRoute component={Reports} />} />
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
