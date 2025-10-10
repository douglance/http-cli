import { create } from "zustand";

export type Panel = "collections" | "editor" | "response";

interface FocusState {
  focusedPanel: Panel;
  isVerbose: boolean;
  setFocus: (panel: Panel) => void;
  toggleVerbose: () => void;
  nextPanel: () => void;
  previousPanel: () => void;
  goLeft: () => void;
  goRight: () => void;
  goUp: () => void;
  goDown: () => void;
}

const panels: Panel[] = ["collections", "editor", "response"];

export const useFocusManager = create<FocusState>((set) => ({
  focusedPanel: "collections",
  isVerbose: false,

  setFocus: (panel: Panel) =>
    set({
      focusedPanel: panel,
    }),

  toggleVerbose: () =>
    set((state) => ({
      isVerbose: !state.isVerbose,
    })),

  nextPanel: () =>
    set((state) => {
      const currentIndex = panels.indexOf(state.focusedPanel);
      const nextIndex = (currentIndex + 1) % panels.length;
      return { focusedPanel: panels[nextIndex] };
    }),

  previousPanel: () =>
    set((state) => {
      const currentIndex = panels.indexOf(state.focusedPanel);
      const prevIndex = (currentIndex - 1 + panels.length) % panels.length;
      return { focusedPanel: panels[prevIndex] };
    }),

  goLeft: () =>
    set((state) => {
      // From response → editor, from editor → collections
      if (state.focusedPanel === "response") {
        return { focusedPanel: "editor" };
      } else if (state.focusedPanel === "editor") {
        return { focusedPanel: "collections" };
      }
      return state;
    }),

  goRight: () =>
    set((state) => {
      // From collections → editor, from editor → response
      if (state.focusedPanel === "collections") {
        return { focusedPanel: "editor" };
      } else if (state.focusedPanel === "editor") {
        return { focusedPanel: "response" };
      }
      return state;
    }),

  goUp: () =>
    set((state) => {
      // No vertical navigation in horizontal layout
      return state;
    }),

  goDown: () =>
    set((state) => {
      // No vertical navigation in horizontal layout
      return state;
    }),
}));
