import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WSStatus } from '@/types';

interface AppState {
  wsStatus: WSStatus;
  paused: boolean; // pause live UI updates
  onboardingComplete: boolean;
  globalSearch: string;
  setWsStatus: (s: WSStatus) => void;
  togglePaused: () => void;
  setPaused: (p: boolean) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  setGlobalSearch: (s: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      wsStatus: 'offline',
      paused: false,
      onboardingComplete: false,
      globalSearch: '',
      setWsStatus: (wsStatus) => set({ wsStatus }),
      togglePaused: () => set((s) => ({ paused: !s.paused })),
      setPaused: (paused) => set({ paused }),
      completeOnboarding: () => set({ onboardingComplete: true }),
      resetOnboarding: () => set({ onboardingComplete: false }),
      setGlobalSearch: (globalSearch) => set({ globalSearch }),
    }),
    {
      name: 'rayzek-app',
      partialize: (s) => ({ onboardingComplete: s.onboardingComplete }),
    },
  ),
);
