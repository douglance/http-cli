import { Box, Text, useInput, useStdin, useStdout } from "ink";
import React, { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { RequestEditorPanel } from "./components/editor/RequestEditorPanel.js";
import { StatusBar } from "./components/layout/StatusBar.js";
import { EnvInspector } from "./components/modal/EnvInspector.js";
import { SavedPanel } from "./components/saved/SavedPanel.js";
import { ResponseViewerPanel } from "./components/viewer/ResponseViewerPanel.js";
import { useFocusManager } from "./hooks/useFocusManager.js";
import { useStorage } from "./hooks/useStorage.js";
import { useEnvStore } from "./stores/envStore.js";
import { useRequestStore } from "./stores/requestStore.js";
import { useRenderDebug } from "./utils/renderDebug.js";
import { startWatchingEnvFiles, stopWatchingEnvFiles } from "./watchers/envWatcher.js";

interface AppProps {
  requestsFilePath?: string;
}

export function App({ requestsFilePath }: AppProps = {}) {
  // Separate data from actions in focus manager
  const { focusedPanel, isVerbose } = useFocusManager(
    useShallow((s) => ({
      focusedPanel: s.focusedPanel,
      isVerbose: s.isVerbose,
    }))
  );
  const nextPanel = useFocusManager((s) => s.nextPanel);
  const previousPanel = useFocusManager((s) => s.previousPanel);
  const goLeft = useFocusManager((s) => s.goLeft);
  const goRight = useFocusManager((s) => s.goRight);
  const _goUp = useFocusManager((s) => s.goUp);
  const _goDown = useFocusManager((s) => s.goDown);
  const toggleVerbose = useFocusManager((s) => s.toggleVerbose);

  const { isLoaded, initialLoadError, reloadError, filePath } = useStorage(requestsFilePath);
  const isLoading = useRequestStore((s) => s.isLoading);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [showEnvInspector, setShowEnvInspector] = useState(false);
  const { stdout } = useStdout();
  const { stdin } = useStdin();

  // Memoize terminal height to prevent rerenders on every Ink cycle
  const terminalHeight = React.useMemo(() => stdout?.rows || 24, [stdout?.rows]);

  // DEBUG: Track what causes rerenders
  useRenderDebug("App", {
    focusedPanel,
    isVerbose,
    isLoading,
    terminalHeight,
    showQuitConfirm,
    showEnvInspector,
    stdoutRef: stdout ? "present" : "null",
    stdinRef: stdin ? "present" : "null",
  });

  // Load environment variables on startup and start watching
  useEffect(() => {
    useEnvStore.getState().loadEnv();
    startWatchingEnvFiles();

    return () => {
      stopWatchingEnvFiles();
    };
  }, []); // Empty deps - only run once on mount

  // Global key bindings
  useInput((input, key) => {
    if (showQuitConfirm) {
      if (input === "y" || input === "Y") {
        process.exit(0);
      } else if (input === "n" || input === "N" || key.escape) {
        setShowQuitConfirm(false);
      }
      return;
    }

    // Prevent navigation while request is in flight
    if (isLoading && (key.tab || input === "h" || input === "l")) {
      return;
    }

    if (key.tab && !key.shift) {
      nextPanel();
    } else if (key.tab && key.shift) {
      previousPanel();
    } else if (input === "h") {
      goLeft();
    } else if (input === "l") {
      goRight();
    } else if (input === "e") {
      setShowEnvInspector(true);
    } else if (input === "v") {
      toggleVerbose();
    } else if (input === "q") {
      setShowQuitConfirm(true);
    } else if (key.ctrl && input === "c") {
      process.exit(0);
    }
  });

  if (showQuitConfirm) {
    return (
      <Box flexDirection="column">
        <Box flexGrow={1} justifyContent="center" alignItems="center">
          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor="yellow"
            paddingX={3}
            paddingY={1}
            width={50}
          >
            <Text bold color="yellow">
              Quit Confirmation
            </Text>
            <Box marginTop={1}>
              <Text dimColor>Are you sure you want to quit?</Text>
            </Box>
            <Box marginTop={1} gap={2}>
              <Text>
                <Text color="cyan" bold>
                  [Y]
                </Text>
                <Text dimColor> Yes</Text>
              </Text>
              <Text>
                <Text color="cyan" bold>
                  [N]
                </Text>
                <Text dimColor> No</Text>
              </Text>
            </Box>
          </Box>
        </Box>
      </Box>
    );
  }

  // Show loading state or initial load error
  if (!isLoaded || initialLoadError) {
    return (
      <Box flexDirection="column" padding={2} height="100%">
        {!isLoaded && !initialLoadError && (
          <Box justifyContent="center" alignItems="center" flexGrow={1}>
            <Text color="cyan">Loading storage...</Text>
          </Box>
        )}
        {initialLoadError && (
          <Box flexDirection="column" flexGrow={1}>
            <Box borderStyle="single" borderColor="red" padding={1} flexDirection="column">
              <Text bold color="red">
                Error Loading Requests
              </Text>
              <Box marginTop={1}>
                <Text color="red">{filePath || "Unknown file"}</Text>
              </Box>
            </Box>
            <Box marginTop={1} paddingX={1} flexDirection="column">
              {initialLoadError.split("\n").map((line) => (
                <Text
                  key={line || Math.random().toString()}
                  color={
                    line.startsWith("Example:") || line.startsWith("###") || line.startsWith("GET")
                      ? "cyan"
                      : "white"
                  }
                >
                  {line || " "}
                </Text>
              ))}
            </Box>
            <Box marginTop={2} paddingX={1}>
              <Text dimColor>Fix the error and save the file to reload automatically.</Text>
            </Box>
            <Box marginTop={1} paddingX={1}>
              <Text dimColor>Press Ctrl+C to quit</Text>
            </Box>
          </Box>
        )}
      </Box>
    );
  }

  const getRequestsPanelWidth = () => {
    return 100;
  };

  // Calculate content height: terminal - status bar - (error banner if present)
  const errorBannerHeight = reloadError ? 3 : 0; // border + padding
  const contentHeight = terminalHeight - 1 - errorBannerHeight;
  const savedPanelWidth = getRequestsPanelWidth();

  return (
    <Box flexDirection="column">
      {reloadError && (
        <Box paddingX={1} borderStyle="single" borderColor="red">
          <Text color="red" bold>
            ⚠ File reload failed:{" "}
          </Text>
          <Text dimColor>{reloadError.split("\n")[0]} (fix and save to retry)</Text>
        </Box>
      )}
      <Box flexDirection="row" height={contentHeight}>
        <SavedPanel
          width={savedPanelWidth}
          focused={focusedPanel === "collections"}
          height={contentHeight}
          yOffset={errorBannerHeight}
          xOffset={0}
        />
        <RequestEditorPanel
          focused={focusedPanel === "editor"}
          isVerbose={isVerbose}
          height={contentHeight}
          yOffset={errorBannerHeight}
        />
        <ResponseViewerPanel
          focused={focusedPanel === "response"}
          isVerbose={isVerbose}
          height={contentHeight}
          yOffset={errorBannerHeight}
        />
      </Box>
      <StatusBar focusedPanel={focusedPanel} isVerbose={isVerbose} filePath={filePath} />
      <EnvInspector isOpen={showEnvInspector} onClose={() => setShowEnvInspector(false)} />
    </Box>
  );
}
