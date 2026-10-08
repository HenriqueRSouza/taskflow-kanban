import type { TagId } from "@taskflow/shared";
import { create } from "zustand";

interface FilterStore {
  tagIds: TagId[];
  toggleTag: (id: TagId) => void;
  clear: () => void;
}

// Estado de interface: não persiste nem participa da sincronização do quadro.
export const useFilterStore = create<FilterStore>()((set) => ({
  tagIds: [],
  toggleTag: (id) => set((state) => ({
    tagIds: state.tagIds.includes(id)
      ? state.tagIds.filter((tagId) => tagId !== id)
      : [...state.tagIds, id],
  })),
  clear: () => set({ tagIds: [] }),
}));
