import { create } from 'zustand';
import type { ChangeSpec, ChangeAction } from '../types';
import { fetchPendingChanges, createChange, updateChangeStatus } from '../api/client';

interface ChangesState {
  changes: ChangeSpec[];
  isLoading: boolean;
  error: string | null;

  loadChanges: () => Promise<void>;
  addChange: (
    action: ChangeAction,
    description: string,
    source: ChangeSpec['source'],
    target: ChangeSpec['target'],
    affectedModules?: string[],
    impact?: ChangeSpec['impact']
  ) => Promise<ChangeSpec>;
  approveChange: (id: string) => Promise<void>;
  rejectChange: (id: string) => Promise<void>;
}

export const useChangesStore = create<ChangesState>((set, get) => ({
  changes: [],
  isLoading: false,
  error: null,

  loadChanges: async () => {
    set({ isLoading: true, error: null });
    try {
      const { changes } = await fetchPendingChanges();
      set({ changes, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  addChange: async (action, description, source, target, affectedModules, impact) => {
    const spec = await createChange(action, description, source, target, affectedModules, impact);
    set((state) => ({ changes: [spec, ...state.changes] }));
    return spec;
  },

  approveChange: async (id: string) => {
    await updateChangeStatus(id, 'approved');
    set((state) => ({
      changes: state.changes.filter((c) => c.id !== id),
    }));
  },

  rejectChange: async (id: string) => {
    await updateChangeStatus(id, 'rejected');
    set((state) => ({
      changes: state.changes.filter((c) => c.id !== id),
    }));
  },
}));
