import { create } from "zustand";

export interface CapturedRequest {
  id: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
  timestamp: string;
  status?: number;
  response_body?: string;
  response_headers?: Record<string, string>;
  duration_ms?: number;
}

interface TimelineState {
  requests: CapturedRequest[];
  selectedIds: Set<string>;
  addRequest: (request: CapturedRequest) => void;
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  clearTimeline: () => void;
}

export const useTimelineStore = create<TimelineState>((set) => ({
  requests: [],
  selectedIds: new Set(),

  addRequest: (request) =>
    set((state) => ({
      requests: [request, ...state.requests],
    })),

  toggleSelection: (id) =>
    set((state) => {
      const newSelected = new Set(state.selectedIds);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      return { selectedIds: newSelected };
    }),

  selectAll: () =>
    set((state) => ({
      selectedIds: new Set(state.requests.map((r) => r.id)),
    })),

  deselectAll: () =>
    set({
      selectedIds: new Set(),
    }),

  clearTimeline: () =>
    set({
      requests: [],
      selectedIds: new Set(),
    }),
}));
