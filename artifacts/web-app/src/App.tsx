import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import { useAuthStore } from "@/lib/auth";

// Pages
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import RoomBoard from "@/pages/room-board";
import Branches from "@/pages/branches";
import Products from "@/pages/products";
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
  
  // Grab state directly from localStorage since zustand persist stores it there
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

// Protected Route Component
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

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/room-board" component={() => <ProtectedRoute component={RoomBoard} />} />
      <Route path="/branches" component={() => <ProtectedRoute component={Branches} />} />
      <Route path="/products" component={() => <ProtectedRoute component={Products} />} />
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
