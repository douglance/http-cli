import { Box, Text } from "ink";
import { useShallow } from "zustand/react/shallow";
import type { Panel } from "../../hooks/useFocusManager.js";
import { useEnvStore } from "../../stores/envStore.js";
import { useProxyStore } from "../../stores/proxyStore.js";
import { useRequestStore } from "../../stores/requestStore.js";

interface StatusBarProps {
  focusedPanel: Panel;
  isVerbose: boolean;
  filePath?: string;
}

export function StatusBar({ focusedPanel, isVerbose, filePath }: StatusBarProps) {
  const isLoading = useRequestStore((s) => s.isLoading);
  const activeEnv = useEnvStore((s) => s.getActiveEnvLabel());
  const proxyStatus = useProxyStore(useShallow((s) => s.status));
  const isRunning = proxyStatus?.is_running ?? false;
  const port = proxyStatus?.port ?? 8888;
  const requestCount = proxyStatus?.requests_captured ?? 0;

  const getContextualHints = (): string[] => {
    if (isLoading) {
      return ["[ESC] Cancel Request"];
    }

    const hints = ["[hl] Panes", "[jk] Sub-Panes"];

    switch (focusedPanel) {
      case "collections":
        hints.push("[↑↓] List", "[Enter] Select");
        break;
      case "editor":
        hints.push("[↑↓] Scroll", "[Enter] Send");
        break;
      case "response":
        hints.push("[↑↓] Scroll", "[c] Copy");
        break;
    }

    hints.push(`[v] ${isVerbose ? "Concise" : "Verbose"}`);
    hints.push("[e] Inspect ENV");
    hints.push("[q] Quit");
    return hints;
  };

  const hints = getContextualHints();

  return (
    <Box paddingX={1} paddingY={0} justifyContent="space-between">
      <Text dimColor>{hints.join(" · ")}</Text>
      <Box gap={1}>
        {isRunning ? (
          <>
            <Text color="green">●</Text>
            <Text dimColor>:{port}</Text>
            <Text dimColor>{requestCount}</Text>
          </>
        ) : (
          <Text color="red">○</Text>
        )}
        {filePath && <Text dimColor>{filePath.replace(process.env.HOME || "", "~")}</Text>}
        {filePath && <Text dimColor>·</Text>}
        <Text dimColor>
          ENV:{" "}
          <Text color="cyan" bold>
            {activeEnv.toUpperCase()}
          </Text>
        </Text>
      </Box>
    </Box>
  );
}
