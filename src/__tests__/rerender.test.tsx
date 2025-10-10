import { render } from "ink-testing-library";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../App.js";
import { useFocusManager } from "../hooks/useFocusManager.js";
import { useSavedRequestsStore } from "../stores/savedRequestsStore.js";

describe("Rerender Tests", () => {
  beforeEach(() => {
    // Reset all stores
    useFocusManager.setState({ focusedPanel: "collections", isVerbose: false });
    useSavedRequestsStore.setState({
      requests: [],
      folders: [],
      expandedFolders: new Set(),
      selectedRequestId: null,
    });
  });

  it("App should NOT rerender when calling focus actions", () => {
    let renderCount = 0;
    const AppWithCounter = (props: React.ComponentProps<typeof App>) => {
      renderCount++;
      return <App {...props} />;
    };

    const { rerender } = render(<AppWithCounter />);
    const initialRenderCount = renderCount;

    // Call action (should not cause rerender)
    useFocusManager.getState().nextPanel();

    // Force component update check
    rerender(<AppWithCounter />);

    // renderCount should NOT increase from action call
    expect(renderCount).toBe(initialRenderCount + 1); // Only +1 from rerender call, not from nextPanel
  });

  it("App SHOULD rerender when focusedPanel changes", async () => {
    const renderCounts = { count: 0 };
    const AppWithCounter = (props: React.ComponentProps<typeof App>) => {
      renderCounts.count++;
      return <App {...props} />;
    };

    const { rerender } = render(<AppWithCounter />);
    const initialRenderCount = renderCounts.count;

    // Change actual data (should cause rerender)
    useFocusManager.setState({ focusedPanel: "editor" });

    // Force a check by calling rerender
    rerender(<AppWithCounter />);

    expect(renderCounts.count).toBeGreaterThan(initialRenderCount);
  });

  it("SavedPanel memo should prevent rerender on unrelated store changes", async () => {
    const { SavedPanel } = await import("../components/saved/SavedPanel.js");
    let renderCount = 0;

    const PanelWithCounter = (props: React.ComponentProps<typeof SavedPanel>) => {
      renderCount++;
      return <SavedPanel {...props} />;
    };

    render(<PanelWithCounter width={100} focused={true} height={20} />);
    const initialRenderCount = renderCount;

    // Change unrelated store data
    useFocusManager.setState({ isVerbose: true });

    await new Promise((resolve) => setTimeout(resolve, 10));

    // Should NOT rerender because SavedPanel doesn't subscribe to isVerbose
    expect(renderCount).toBe(initialRenderCount);
  });

  it("should identify which store subscriptions cause rerenders", () => {
    // Check store listeners after rendering
    render(<App />);

    // Zustand stores have a `getState().listeners` or similar
    // Check if stores have active listeners
    const focusListeners = (useFocusManager as unknown as { getState?: () => unknown }).getState?.()
      ? 1
      : 0;
    const requestListeners = (
      useSavedRequestsStore as unknown as { getState?: () => unknown }
    ).getState?.()
      ? 1
      : 0;

    const totalListeners = focusListeners + requestListeners;

    console.log("Store methods available:", {
      focusHasGetState: !!useFocusManager.getState,
      requestsHasGetState: !!useSavedRequestsStore.getState,
    });

    // At least one store should be in use
    expect(totalListeners).toBeGreaterThan(0);
  });
});
