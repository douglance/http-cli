import { create } from "zustand";

export interface EditableRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
}

interface EditorState {
  currentRequest: EditableRequest | null;
  isReplaying: boolean;
  setCurrentRequest: (request: EditableRequest | null) => void;
  updateMethod: (method: string) => void;
  updateUrl: (url: string) => void;
  updateHeaders: (headers: Record<string, string>) => void;
  updateBody: (body: string) => void;
  setReplaying: (replaying: boolean) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  currentRequest: null,
  isReplaying: false,

  setCurrentRequest: (request) => set({ currentRequest: request }),

  updateMethod: (method) =>
    set((state) =>
      state.currentRequest
        ? {
            currentRequest: {
              ...state.currentRequest,
              method,
            },
          }
        : {}
    ),

  updateUrl: (url) =>
    set((state) =>
      state.currentRequest
        ? {
            currentRequest: {
              ...state.currentRequest,
              url,
            },
          }
        : {}
    ),

  updateHeaders: (headers) =>
    set((state) =>
      state.currentRequest
        ? {
            currentRequest: {
              ...state.currentRequest,
              headers,
            },
          }
        : {}
    ),

  updateBody: (body) =>
    set((state) =>
      state.currentRequest
        ? {
            currentRequest: {
              ...state.currentRequest,
              body,
            },
          }
        : {}
    ),

  setReplaying: (replaying) => set({ isReplaying: replaying }),
}));
