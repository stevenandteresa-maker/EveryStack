'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const STORAGE_KEY = 'everystack-sidebar';

/** Known values: 'nav', 'chat'. Default navigation tree or quick panel. */
type SidebarPanel = string;

interface SidebarState {
  collapsed: boolean;
  /** Active content panel in the sidebar content zone */
  activePanel: SidebarPanel;
  setCollapsed: (collapsed: boolean) => void;
  toggle: () => void;
  setActivePanel: (panel: SidebarPanel) => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: true,
      activePanel: 'nav',
      setCollapsed: (collapsed) => set({ collapsed }),
      toggle: () => set((state) => ({ collapsed: !state.collapsed })),
      setActivePanel: (activePanel) => set({ activePanel }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ collapsed: state.collapsed }),
    },
  ),
);
