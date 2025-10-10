import { Box, Text, useInput, useStdin, useStdout } from "ink";
import React from "react";
import { useShallow } from "zustand/react/shallow";
import { useFocusManager } from "../../hooks/useFocusManager.js";
import { useMouse } from "../../hooks/useMouse.js";
import { fetchWithDetails } from "../../lib/httpClient.js";
import { highlightHTTP, highlightJSON } from "../../lib/syntaxHighlight.js";
import { useEnvStore } from "../../stores/envStore.js";
import { useRequestStore } from "../../stores/requestStore.js";
import { useSavedRequestsStore } from "../../stores/savedRequestsStore.js";
import { renderTextWithEnvVars } from "../../utils/envDisplay.js";
import { generateLineKey } from "../../utils/stableId.js";

interface RequestEditorPanelProps {
  focused: boolean;
  isVerbose: boolean;
  height: number;
}

// Helper to get effective headers (user's or defaults)
const getEffectiveHeaders = (headers: Record<string, string>): Record<string, string> => {
  const hasUserHeaders = Object.keys(headers).length > 0;
  if (hasUserHeaders) {
    return headers;
  }
  // Default JSON headers when none specified
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
};

export const RequestEditorPanel = React.memo(
  function RequestEditorPanel({ focused, isVerbose, height }: RequestEditorPanelProps) {
    // Data only
    const { requests, selectedRequestId } = useSavedRequestsStore(
      useShallow((s) => ({
        requests: s.requests,
        selectedRequestId: s.selectedRequestId,
      }))
    );
    const isLoading = useRequestStore((s) => s.isLoading);

    // Actions separately
    const setLoading = useRequestStore((s) => s.setLoading);
    const setResponse = useRequestStore((s) => s.setResponse);
    const addNetworkEvent = useRequestStore((s) => s.addNetworkEvent);
    const clearNetworkEvents = useRequestStore((s) => s.clearNetworkEvents);
    const { setFocus } = useFocusManager();
    const replaceVars = useEnvStore((s) => s.replaceVars);
    const replaceVarsWithIndicator = useEnvStore((s) => s.replaceVarsWithIndicator);
    const validateRequest = useEnvStore((s) => s.validateRequest);
    const selectedRequest = requests.find((r) => r.id === selectedRequestId) || null;
    const [scrollOffset, setScrollOffset] = React.useState(0);
    const prevRequestRef = React.useRef(selectedRequest);
    const { stdin, setRawMode } = useStdin();
    const abortControllerRef = React.useRef<AbortController | null>(null);
    const { stdout } = useStdout();

    React.useEffect(() => {
      if (prevRequestRef.current !== selectedRequest) {
        setScrollOffset(0);
        prevRequestRef.current = selectedRequest;
      }
    }, [selectedRequest]);

    React.useEffect(() => {
      if (!stdin || !setRawMode) {
        return;
      }

      const handleData = (data: Buffer) => {
        const str = data.toString();
        // Mouse wheel up: button 4 = \x1b[<64
        if (str.includes("\x1b[<64")) {
          setScrollOffset((prev) => Math.max(0, prev - 3));
        }
        // Mouse wheel down: button 5 = \x1b[<65
        else if (str.includes("\x1b[<65")) {
          setScrollOffset((prev) => prev + 3);
        }
      };

      stdin.on("data", handleData);

      return () => {
        stdin.off("data", handleData);
      };
    }, [stdin, setRawMode]);

    // Mouse click to focus
    useMouse((event) => {
      const { x, leftClick } = event;

      if (!leftClick || !stdout) {
        return;
      }

      // Approximate position: SavedPanel=100 chars, then Editor/Response split remaining
      const termWidth = stdout.columns || 120;
      const savedWidth = 100;
      const remainingWidth = termWidth - savedWidth;
      const editorStart = savedWidth;
      const editorEnd = savedWidth + Math.floor(remainingWidth / 2);

      if (x >= editorStart && x < editorEnd && !focused) {
        setFocus("editor");
      }
    });

    useInput(
      (_input, key) => {
        if (!focused) {
          return;
        }

        if (key.escape && isLoading) {
          // Cancel the request
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
          }
          setLoading(false);
          setResponse({
            status: 0,
            statusText: "Cancelled",
            headers: {},
            body: "Request cancelled by user",
          });
        } else if (key.return && selectedRequest && !isLoading) {
          // Validate request for missing environment variables
          const validation = validateRequest(
            selectedRequest.url,
            selectedRequest.headers,
            selectedRequest.body || undefined
          );

          if (!validation.valid) {
            // Show error for missing variables
            setResponse({
              status: 0,
              statusText: "Missing Environment Variables",
              headers: {},
              body: `❌ Missing environment variables:\n\n${validation.missing.map((v) => `  • {{${v}}}`).join("\n")}\n\nPlease define these in your .env file and activate the environment.`,
            });
            setFocus("response");
            return;
          }

          setLoading(true);
          setResponse(null);
          clearNetworkEvents();
          setFocus("response");

          // Create abort controller for this request
          abortControllerRef.current = new AbortController();
          const signal = abortControllerRef.current.signal;

          // Replace environment variables
          const processedUrl = replaceVars(selectedRequest.url);

          // Get effective headers (user's or defaults) and process env vars
          const effectiveHeaders = getEffectiveHeaders(selectedRequest.headers);
          const processedHeaders: Record<string, string> = {};
          Object.entries(effectiveHeaders).forEach(([key, value]) => {
            processedHeaders[key] = replaceVars(value);
          });
          const processedBody = selectedRequest.body
            ? replaceVars(selectedRequest.body)
            : undefined;

          // Send HTTP request with detailed tracking
          (async () => {
            try {
              const response = await fetchWithDetails(processedUrl, {
                method: selectedRequest.method,
                headers: processedHeaders,
                body: processedBody,
                signal,
                onEvent: (event) => {
                  addNetworkEvent(event);
                },
              });

              setResponse({
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                body: response.body,
                events: response.events,
                timings: response.timings,
              });
            } catch (error) {
              if (error instanceof Error && error.message === "Request aborted") {
                // Request was cancelled - response already set
                return;
              }
              setResponse({
                status: 0,
                statusText: "Error",
                headers: {},
                body: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
              });
            } finally {
              setLoading(false);
              abortControllerRef.current = null;
            }
          })();
        } else if (!isLoading && key.upArrow) {
          if (scrollOffset === 0) {
            setFocus("collections");
          } else {
            setScrollOffset((prev) => prev - 1);
          }
        } else if (!isLoading && key.downArrow) {
          const contentNodes = renderContent();
          const contentArray = Array.isArray(contentNodes) ? contentNodes : [contentNodes];
          const visibleHeight = height - 4;
          const maxScroll = Math.max(0, contentArray.length - visibleHeight);

          if (scrollOffset >= maxScroll) {
            setFocus("response");
          } else {
            setScrollOffset((prev) => prev + 1);
          }
        } else if (!isLoading && key.leftArrow) {
          setFocus("collections");
        } else if (!isLoading && key.rightArrow) {
          setFocus("response");
        }
      },
      { isActive: focused }
    );

    const formatRawRequest = (request: typeof selectedRequest) => {
      if (!request) {
        return "";
      }

      const processedUrl = replaceVarsWithIndicator(request.url);
      const lines: string[] = [];

      try {
        const url = new URL(processedUrl);

        // Request line with parsed URL
        lines.push(`${request.method} ${url.pathname}${url.search} HTTP/1.1`);
        lines.push(`Host: ${url.host}`);
      } catch {
        // If URL is invalid (contains env vars or malformed), show it as-is
        lines.push(`${request.method} ${processedUrl} HTTP/1.1`);
      }

      // Headers - show effective headers (user's or defaults)
      const effectiveHeaders = getEffectiveHeaders(request.headers);
      Object.entries(effectiveHeaders).forEach(([key, value]) => {
        lines.push(`${key}: ${replaceVarsWithIndicator(value)}`);
      });

      // Empty line separator
      lines.push("");

      // Body
      if (request.body) {
        lines.push(replaceVarsWithIndicator(request.body));
      }

      return lines.join("\n");
    };

    const isJSON = (str: string): boolean => {
      try {
        JSON.parse(str);
        return true;
      } catch {
        return false;
      }
    };

    const renderContent = () => {
      if (!selectedRequest) {
        return [
          <Text key="none" dimColor>
            No request selected
          </Text>,
        ];
      }

      const nodes: React.ReactNode[] = [];

      if (isVerbose) {
        // Verbose mode - show raw HTTP
        const rawContent = formatRawRequest(selectedRequest);
        rawContent.split("\n").forEach((line, idx) => {
          nodes.push(<Text key={generateLineKey(line, idx)}>{highlightHTTP(line)}</Text>);
        });
      } else {
        // Normal mode - show formatted request with colored $VAR_NAME
        const urlNodes = renderTextWithEnvVars(selectedRequest.url);

        nodes.push(
          <Text key="method">
            <Text bold color="cyan">
              {selectedRequest.method}
            </Text>
            <Text> </Text>
            {urlNodes}
          </Text>
        );
        nodes.push(<Text key="blank1">{""}</Text>);

        // Always show effective headers (user's or defaults)
        const effectiveHeaders = getEffectiveHeaders(selectedRequest.headers);
        Object.entries(effectiveHeaders).forEach(([key, value]) => {
          const valueNodes = renderTextWithEnvVars(value);
          nodes.push(
            <Text key={`header-${key}`}>
              <Text color="blue">{key}</Text>
              <Text dimColor>: </Text>
              {valueNodes}
            </Text>
          );
        });

        if (selectedRequest.body) {
          nodes.push(<Text key="blank2">{""}</Text>);

          // For body, check if it's JSON and can be parsed
          // If yes, format it with syntax highlighting but keep env vars as colored $VAR_NAME
          const bodyWithVarsReplaced = replaceVars(selectedRequest.body);

          if (isJSON(bodyWithVarsReplaced)) {
            try {
              // Parse and format JSON, but we need to show env vars in the original
              // So we'll render each line with env var detection
              const formatted = JSON.stringify(JSON.parse(bodyWithVarsReplaced), null, 2);

              // Re-inject env var patterns for display
              const _displayBody = selectedRequest.body;
              formatted.split("\n").forEach((line, idx) => {
                // For now, just highlight the JSON without env var coloring in body
                // (can enhance later if needed)
                nodes.push(<Text key={generateLineKey(line, idx)}>{highlightJSON(line)}</Text>);
              });
            } catch {
              // If parsing fails, show with env vars
              selectedRequest.body.split("\n").forEach((line, idx) => {
                const lineNodes = renderTextWithEnvVars(line);
                nodes.push(<Box key={generateLineKey(line, idx)}>{lineNodes}</Box>);
              });
            }
          } else {
            // Non-JSON body - show with colored env vars
            selectedRequest.body.split("\n").forEach((line, idx) => {
              const lineNodes = renderTextWithEnvVars(line);
              nodes.push(<Box key={generateLineKey(line, idx)}>{lineNodes}</Box>);
            });
          }
        }
      }

      return nodes;
    };

    const contentNodes = renderContent();
    const contentArray = Array.isArray(contentNodes) ? contentNodes : [contentNodes];
    const visibleHeight = height - 4;
    const maxScroll = Math.max(0, contentArray.length - visibleHeight);
    const actualScrollOffset = Math.min(scrollOffset, maxScroll);
    const visibleNodes = contentArray.slice(actualScrollOffset, actualScrollOffset + visibleHeight);

    return (
      <Box
        flexDirection="column"
        width="100%"
        height={height}
        borderStyle="single"
        borderColor={focused ? "cyan" : "gray"}
        overflow="hidden"
      >
        <Box paddingX={1} paddingY={0} justifyContent="space-between">
          <Text bold color={focused ? "cyan" : "gray"}>
            Request {isVerbose && <Text dimColor>(Verbose)</Text>}
          </Text>
          {focused && selectedRequest && (
            <Text dimColor>{isLoading ? "Sending..." : "Press Enter to send"}</Text>
          )}
        </Box>
        <Box flexDirection="column" paddingX={1} paddingBottom={1} marginTop={1} overflow="hidden">
          {visibleNodes}
        </Box>
      </Box>
    );
  },
  (p, n) => p.focused === n.focused && p.isVerbose === n.isVerbose && p.height === n.height
);
