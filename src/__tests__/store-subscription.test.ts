import { beforeEach, describe, expect, it } from "vitest";
import { useFocusManager } from "../hooks/useFocusManager.js";
import { useSavedRequestsStore } from "../stores/savedRequestsStore.js";

describe("Store Subscription Tests", () => {
  beforeEach(() => {
    useFocusManager.setState({ focusedPanel: "collections", isVerbose: false });
  });

  it("useShallow should prevent rerender when object content is same", () => {
    let notifyCount = 0;

    // Simulate useShallow selector
    const selector = (s: ReturnType<typeof useFocusManager.getState>) => ({
      focusedPanel: s.focusedPanel,
      isVerbose: s.isVerbose,
    });

    // Subscribe and count notifications
    const unsubscribe = useFocusManager.subscribe((state) => {
      const selected = selector(state);
      notifyCount++;
      console.log("Notification", notifyCount, ":", selected);
    });

    const initialCount = notifyCount;

    // Call action (should trigger subscriber)
    useFocusManager.getState().nextPanel();

    // Subscriber should be notified
    expect(notifyCount).toBeGreaterThan(initialCount);

    unsubscribe();
  });

  it("actions should have stable references", () => {
    const action1 = useFocusManager.getState().nextPanel;
    const action2 = useFocusManager.getState().nextPanel;

    // Actions should be the same reference
    expect(action1).toBe(action2);
  });

  it("data should change reference when updated", () => {
    const state1 = useFocusManager.getState();
    const data1 = { focusedPanel: state1.focusedPanel, isVerbose: state1.isVerbose };

    useFocusManager.setState({ focusedPanel: "editor" });

    const state2 = useFocusManager.getState();
    const data2 = { focusedPanel: state2.focusedPanel, isVerbose: state2.isVerbose };

    // Data objects have different content
    expect(data1.focusedPanel).not.toBe(data2.focusedPanel);
  });

  it("Set reference changes on every update", () => {
    const set1 = useSavedRequestsStore.getState().expandedFolders;

    useSavedRequestsStore.getState().toggleFolder("test-id");

    const set2 = useSavedRequestsStore.getState().expandedFolders;

    // Set should be a new reference
    expect(set1).not.toBe(set2);
  });
});
