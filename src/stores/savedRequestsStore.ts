import { create } from "zustand";
import type { Folder, SavedRequest } from "./storage.js";

// Deep equality check for requests (by content, not ID)
function requestsEqual(a: SavedRequest[], b: SavedRequest[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    const reqA = a[i];
    const reqB = b[i];
    if (!reqA || !reqB) {
      return false;
    }
    if (
      reqA.name !== reqB.name ||
      reqA.method !== reqB.method ||
      reqA.url !== reqB.url ||
      reqA.body !== reqB.body ||
      JSON.stringify(reqA.headers) !== JSON.stringify(reqB.headers)
    ) {
      return false;
    }
  }
  return true;
}

// Deep equality check for folders
function foldersEqual(a: Folder[], b: Folder[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    const folderA = a[i];
    const folderB = b[i];
    if (!folderA || !folderB) {
      return false;
    }
    if (folderA.name !== folderB.name || folderA.parentId !== folderB.parentId) {
      return false;
    }
  }
  return true;
}

export type TreeNode =
  | { type: "folder"; folder: Folder; depth: number }
  | { type: "request"; request: SavedRequest; depth: number };

interface SavedRequestsState {
  requests: SavedRequest[];
  folders: Folder[];
  expandedFolders: Set<string>;
  selectedRequestId: string | null;

  setRequests: (requests: SavedRequest[]) => void;
  setFolders: (folders: Folder[]) => void;
  updateAll: (update: { requests?: SavedRequest[]; folders?: Folder[] }) => void;
  addRequest: (request: SavedRequest) => void;
  deleteRequest: (id: string) => void;
  selectRequest: (id: string | null) => void;
  toggleFolder: (id: string) => void;
  getSelectedRequest: () => SavedRequest | null;
  getTreeNodes: () => TreeNode[];
}

export const useSavedRequestsStore = create<SavedRequestsState>((set, get) => ({
  requests: [],
  folders: [],
  expandedFolders: new Set(),
  selectedRequestId: null,

  setRequests: (requests) => {
    const state = get();

    // Skip update if content hasn't changed (prevents visual flicker)
    if (requestsEqual(state.requests, requests)) {
      return;
    }

    // With stable IDs, selection persists automatically if ID still exists
    if (state.selectedRequestId && !requests.some((r) => r.id === state.selectedRequestId)) {
      // Selection no longer valid (request was deleted), clear it
      set({ requests, selectedRequestId: null });
    } else {
      set({ requests });
    }
  },

  setFolders: (folders) => {
    const state = get();

    // Skip update if content hasn't changed (prevents visual flicker)
    if (foldersEqual(state.folders, folders)) {
      return;
    }

    // With stable IDs, expansion persists automatically - just filter deleted folders
    const newExpanded = new Set(
      Array.from(state.expandedFolders).filter((id) => folders.some((f) => f.id === id))
    );

    set({ folders, expandedFolders: newExpanded });
  },

  updateAll: ({ requests, folders }) => {
    const state = get();
    const updates: Partial<SavedRequestsState> = {};

    // Check requests for changes
    if (requests && !requestsEqual(state.requests, requests)) {
      updates.requests = requests;

      // Clear selection if selected request was deleted
      if (state.selectedRequestId && !requests.some((r) => r.id === state.selectedRequestId)) {
        updates.selectedRequestId = null;
      }
    }

    // Check folders for changes
    if (folders && !foldersEqual(state.folders, folders)) {
      updates.folders = folders;

      // Filter out expanded folders that no longer exist
      const newExpanded = new Set(
        Array.from(state.expandedFolders).filter((id) => folders.some((f) => f.id === id))
      );
      if (newExpanded.size !== state.expandedFolders.size) {
        updates.expandedFolders = newExpanded;
      }
    }

    // Single atomic update = single render
    if (Object.keys(updates).length > 0) {
      set(updates);
    }
  },

  addRequest: (request) =>
    set((state) => ({
      requests: [...state.requests, request],
    })),

  deleteRequest: (id) =>
    set((state) => ({
      requests: state.requests.filter((r) => r.id !== id),
      selectedRequestId: state.selectedRequestId === id ? null : state.selectedRequestId,
    })),

  selectRequest: (id) => set({ selectedRequestId: id }),

  toggleFolder: (id) =>
    set((state) => {
      const expanded = new Set(state.expandedFolders);
      if (expanded.has(id)) {
        expanded.delete(id);
      } else {
        expanded.add(id);
      }
      return { expandedFolders: expanded };
    }),

  getSelectedRequest: () => {
    const { requests, selectedRequestId } = get();
    return requests.find((r) => r.id === selectedRequestId) || null;
  },

  getTreeNodes: () => {
    const { folders, requests, expandedFolders } = get();
    const nodes: TreeNode[] = [];

    const buildTree = (parentId: string | null, depth: number) => {
      // Add folders at this level
      folders
        .filter((f) => f.parentId === parentId)
        .forEach((folder) => {
          nodes.push({ type: "folder", folder, depth });
          if (expandedFolders.has(folder.id)) {
            buildTree(folder.id, depth + 1);
          }
        });

      // Add requests at this level
      requests
        .filter((r) => r.folderId === parentId)
        .forEach((request) => {
          nodes.push({ type: "request", request, depth });
        });
    };

    buildTree(null, 0);
    return nodes;
  },
}));
