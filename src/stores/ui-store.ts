import { create } from 'zustand';

type Panel = 'detail' | 'docs' | 'changes';
type View = 'graph' | 'docs' | 'changes';

interface UIState {
  selectedNodeId: string | null;
  activePanel: Panel | null;
  activeView: View;
  sidebarOpen: boolean;
  searchQuery: string;

  selectNode: (nodeId: string | null) => void;
  setPanel: (panel: Panel | null) => void;
  setView: (view: View) => void;
  toggleSidebar: () => void;
  setSearchQuery: (query: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedNodeId: null,
  activePanel: null,
  activeView: 'graph',
  sidebarOpen: true,
  searchQuery: '',

  selectNode: (nodeId) => set({ selectedNodeId: nodeId, activePanel: nodeId ? 'detail' : null }),
  setPanel: (panel) => set({ activePanel: panel }),
  setView: (view) => set({ activeView: view }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSearchQuery: (query) => set({ searchQuery: query }),
}));
