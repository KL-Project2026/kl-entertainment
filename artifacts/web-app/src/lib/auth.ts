import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserProfile } from "@workspace/api-client-react";

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
  setAuth: (token: string, refreshToken: string, user: UserProfile) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      setAuth: (token, refreshToken, user) => set({ token, refreshToken, user }),
      logout: () => set({ token: null, refreshToken: null, user: null }),
    }),
    {
      name: "kl-auth-storage",
    }
  )
);
