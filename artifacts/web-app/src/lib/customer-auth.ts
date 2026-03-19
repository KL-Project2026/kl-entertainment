import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CustomerProfile {
  id: string;
  fullName: string;
  email: string;
  languagePref: string;
}

interface CustomerAuthState {
  token: string | null;
  customer: CustomerProfile | null;
  setAuth: (token: string, customer: CustomerProfile) => void;
  logout: () => void;
}

export const useCustomerAuthStore = create<CustomerAuthState>()(
  persist(
    (set) => ({
      token: null,
      customer: null,
      setAuth: (token, customer) => set({ token, customer }),
      logout: () => set({ token: null, customer: null }),
    }),
    {
      name: "kl-customer-storage",
    }
  )
);
