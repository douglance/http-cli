import { exec } from "node:child_process";
import { promisify } from "node:util";
import { Box, Text, useInput, useStdin, useStdout } from "ink";
import React from "react";
import { useShallow } from "zustand/react/shallow";
import { useFocusManager } from "../../hooks/useFocusManager.js";
import { setMouseDisabled, useMouse } from "../../hooks/useMouse.js";
import { highlightHTTP, highlightJSON } from "../../lib/syntaxHighlight.js";
import { useRequestStore } from "../../stores/requestStore.js";
import { generateLineKey } from "../../utils/stableId.js";

const execAsync = promisify(exec);

interface ResponseViewerPanelProps {
  focused: boolean;
  isVerbose: boolean;
  height: number;
  yOffset?: number; // absolute top y of this panel
}

export const ResponseViewerPanel = React.memo(
  function ResponseViewerPanel({ focused, isVerbose, height, yOffset = 0 }: ResponseViewerPanelProps) {
    const { response, networkEvents, isLoading } = useRequestStore(
      useShallow((s) => ({
        response: s.response,
        networkEvents: s.networkEvents,
        isLoading: s.isLoading,
      }))
    );
    const { setFocus } = useFocusManager();
    const [scrollOffset, setScrollOffset] = React.useState(0);
    const [copyStatus, setCopyStatus] = React.useState<string>("");
    const [selectionMode, setSelectionMode] = React.useState(false);
    const prevResponseRef = React.useRef(response);
    const { stdin, setRawMode } = useStdin();
    const { stdout } = useStdout();

    React.useEffect(() => {
      if (prevResponseRef.current !== response) {
        setScrollOffset(0);
        prevResponseRef.current = response;
      }
    }, [response]);

    // Update global mouse disabled state based on selection mode
    React.useEffect(() => {
      if (focused && selectionMode) {
        setMouseDisabled(true);
      } else if (!selectionMode) {
        setMouseDisabled(false);
      }
    }, [focused, selectionMode]);

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
      const { x, y, leftClick } = event;

      if (!leftClick || !stdout) {
        return;
      }

      // Approximate position: SavedPanel=100 chars, then Editor/Response split remaining
      const termWidth = stdout.columns || 120;
      const savedWidth = 100;
      const remainingWidth = termWidth - savedWidth;
      const responseStart = savedWidth + Math.floor(remainingWidth / 2);

      const withinX = x >= responseStart;
      const withinY = y >= yOffset && y < yOffset + height;

      if (withinX && withinY) {
        setFocus("response"); // allow selecting even if already focused or empty
      }
    });

    const getStatusColor = (status: number) => {
      if (status === 0) {
        return "red";
      }
      if (status >= 200 && status < 300) {
        return "green";
      }
      if (status >= 400) {
        return "red";
      }
      return "yellow";
    };

    const copyToClipboard = async (text: string) => {
      try {
        const platform = process.platform;
        const escapedText = text.replace(/'/g, "'\\''");
        let command: string;

        if (platform === "darwin") {
          command = `printf '%s' '${escapedText}' | pbcopy`;
        } else if (platform === "win32") {
          command = `echo ${escapedText} | clip`;
        } else {
          // Linux - try xclip first, fall back to xsel
          command = `printf '%s' '${escapedText}' | xclip -selection clipboard`;
        }

        await execAsync(command);
        setCopyStatus("✓ Copied");
        setTimeout(() => setCopyStatus(""), 2000);
      } catch (_error) {
        setCopyStatus("✗ Copy failed");
        setTimeout(() => setCopyStatus(""), 2000);
      }
    };

    useInput(
      (input, key) => {
        if (!focused) {
          return;
        }

        if (key.leftArrow) {
          setFocus("editor");
          return;
        }
        if (input === "s") {
          // Toggle selection mode
          setSelectionMode((prev) => !prev);
          setCopyStatus(selectionMode ? "" : "Selection mode ON - mouse disabled");
          if (!selectionMode) {
            setTimeout(() => setCopyStatus(""), 2000);
          }
        } else if (input === "c" && response) {
          // Copy response body
          const textToCopy = isVerbose ? formatRawResponse(response) : response.body;
          copyToClipboard(textToCopy);
        } else if (key.upArrow || input === "k") {
          setScrollOffset((prev) => Math.max(0, prev - 1));
        } else if (key.downArrow || input === "j") {
          setScrollOffset((prev) => prev + 1);
        }
      },
      { isActive: focused }
    );

    const formatRawResponse = (resp: typeof response) => {
      if (!resp) {
        return "";
      }

      const lines: string[] = [];

      // Status line
      lines.push(`HTTP/1.1 ${resp.status} ${resp.statusText}`);

      // Headers
      Object.entries(resp.headers).forEach(([key, value]) => {
        lines.push(`${key}: ${value}`);
      });

      // Empty line separator
      lines.push("");

      // Body
      lines.push(resp.body);

      return lines.join("\n");
    };

    const formatNetworkEvents = (): string[] => {
      const lines: string[] = [];

      if (response?.timings) {
        lines.push("TIMINGS SUMMARY:");
        if (response.timings.dnsLookup) {
          lines.push(`  DNS Lookup: ${response.timings.dnsLookup}ms`);
        }
        if (response.timings.tcpConnection) {
          lines.push(`  TCP Connection: ${response.timings.tcpConnection}ms`);
        }
        if (response.timings.tlsHandshake) {
          lines.push(`  TLS Handshake: ${response.timings.tlsHandshake}ms`);
        }
        if (response.timings.firstByte) {
          lines.push(`  Time to First Byte: ${response.timings.firstByte}ms`);
        }
        if (response.timings.total) {
          lines.push(`  Total: ${response.timings.total}ms`);
        }
        lines.push("");
      }

      if (networkEvents.length > 0) {
        lines.push("NETWORK EVENTS:");
        networkEvents.forEach((event) => {
          const timestamp = `[${String(event.timestamp).padStart(4, " ")}ms]`;
          const data = event.data as Record<string, unknown>;
          switch (event.type) {
            case "dns_start":
              lines.push(`  ${timestamp} > DNS lookup started for ${data?.hostname}`);
              break;
            case "dns_end":
              lines.push(
                `  ${timestamp} < DNS resolved ${data?.hostname} -> ${data?.address} (IPv${data?.family}) in ${data?.duration}ms`
              );
              break;
            case "tcp_start":
              lines.push(
                `  ${timestamp} > TCP connecting from ${data?.localAddress}:${data?.localPort}...`
              );
              break;
            case "tcp_connected":
              lines.push(`  ${timestamp} < TCP connection established in ${data?.duration}ms`);
              break;
            case "tls_start":
              lines.push(`  ${timestamp} > TLS handshake initiating...`);
              break;
            case "tls_handshake": {
              const cipher = data?.cipher as Record<string, unknown>;
              const protocol = data?.protocol || "unknown";
              const cipherName = cipher?.name || "unknown";
              const cipherVersion = cipher?.version || "";
              const authorized = data?.authorized ? "[AUTHORIZED]" : "[UNAUTHORIZED]";
              lines.push(
                `  ${timestamp} < TLS handshake complete: ${protocol} with ${cipherName}${cipherVersion ? ` (${cipherVersion})` : ""}`
              );
              lines.push(`  ${timestamp}   ${authorized}, took ${data?.duration}ms`);
              break;
            }
            case "request_sent": {
              const url = data?.url as string;
              const method = data?.method;
              const headers = data?.headers as Record<string, string>;
              const headerCount = Object.keys(headers || {}).length;
              lines.push(`  ${timestamp} > ${method} request sent to ${url}`);
              lines.push(`  ${timestamp}   ${headerCount} headers included`);
              break;
            }
            case "response_headers": {
              const status = data?.status;
              const statusMessage = data?.statusMessage;
              const headers = data?.headers as Record<string, unknown>;
              const headerCount = Object.keys(headers || {}).length;
              lines.push(
                `  ${timestamp} < Response received: ${status} ${statusMessage} (${data?.duration}ms)`
              );
              lines.push(`  ${timestamp}   ${headerCount} response headers`);
              break;
            }
            case "response_body": {
              const chunkSize = data?.chunkSize;
              const kb = ((chunkSize as number) / 1024).toFixed(2);
              lines.push(`  ${timestamp} < Received chunk: ${chunkSize} bytes (${kb} KB)`);
              break;
            }
            case "complete": {
              const totalBytes = data?.totalBytes;
              const kb = ((totalBytes as number) / 1024).toFixed(2);
              const mb = ((totalBytes as number) / 1024 / 1024).toFixed(2);
              const size = (totalBytes as number) > 1024 * 1024 ? `${mb} MB` : `${kb} KB`;
              lines.push(
                `  ${timestamp} = Transfer complete: ${totalBytes} bytes (${size}) in ${data?.duration}ms`
              );
              break;
            }
            case "error": {
              const code = data?.code ? ` [${data.code}]` : "";
              lines.push(`  ${timestamp} X Error${code}: ${data?.message}`);
              break;
            }
          }
        });
        lines.push("");
      }

      return lines;
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
      // Show loading animation with network events while loading
      if (isLoading && networkEvents.length > 0) {
        const lines: React.ReactNode[] = [];
        formatNetworkEvents().forEach((line, idx) => {
          lines.push(<Text key={generateLineKey(line, idx)}>{line}</Text>);
        });
        return lines;
      }

      // Only show "no response" if not loading and no response
      if (!response) {
        return <Text dimColor>{isLoading ? "Loading..." : "No response"}</Text>;
      }

      const lines: React.ReactNode[] = [];

      // Show network details at top in verbose mode
      if (isVerbose && (response.timings || networkEvents.length > 0)) {
        formatNetworkEvents().forEach((line, idx) => {
          lines.push(<Text key={generateLineKey(line, idx)}>{line}</Text>);
        });
        lines.push(<Text key="separator">{"─".repeat(50)}</Text>);
        lines.push(<Text key="blank">{""}</Text>);
      }

      if (isVerbose) {
        // Verbose mode - show raw HTTP
        const rawContent = formatRawResponse(response);
        rawContent.split("\n").forEach((line, idx) => {
          lines.push(<Text key={generateLineKey(line, idx)}>{highlightHTTP(line)}</Text>);
        });
      } else {
        // Normal mode - show just body with proper text selection support
        if (isJSON(response.body)) {
          try {
            // Format JSON and render as selectable text blocks
            const parsed = JSON.parse(response.body);
            const formatted = JSON.stringify(parsed, null, 2);

            // Render each line separately but preserve line structure for proper display
            const jsonLines = formatted.split("\n");
            jsonLines.forEach((line, idx) => {
              lines.push(
                <Text key={generateLineKey(line, idx)} wrap="truncate-end">
                  {highlightJSON(line)}
                </Text>
              );
            });
          } catch {
            // Invalid JSON - render as plain text
            response.body.split("\n").forEach((line, idx) => {
              lines.push(
                <Text key={generateLineKey(line, idx)} wrap="wrap">
                  {line}
                </Text>
              );
            });
          }
        } else {
          // Non-JSON response - render as plain text with wrapping
          response.body.split("\n").forEach((line, idx) => {
            lines.push(
              <Text key={generateLineKey(line, idx)} wrap="wrap">
                {line}
              </Text>
            );
          });
        }
      }

      return lines;
    };

    const contentNodes = renderContent();
    const contentArray = Array.isArray(contentNodes) ? contentNodes : [contentNodes];
    const visibleHeight = height - 3;
    const maxScroll = Math.max(0, contentArray.length - visibleHeight);
    const actualScrollOffset = Math.min(scrollOffset, maxScroll);
    const visibleNodes = contentArray.slice(actualScrollOffset, actualScrollOffset + visibleHeight);

    const hasContentAbove = actualScrollOffset > 0;
    const hasContentBelow = actualScrollOffset < maxScroll;
    const scrollIndicator =
      hasContentAbove && hasContentBelow ? "↕" : hasContentAbove ? "↑" : hasContentBelow ? "↓" : "";

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
          <Box>
            <Text bold color={focused ? "cyan" : "gray"}>
              Response {isVerbose && <Text dimColor>(Verbose)</Text>}
            </Text>
            {response && (
              <Text color={getStatusColor(response.status)} bold>
                {" "}
                {response.status}
              </Text>
            )}
            {scrollIndicator && <Text dimColor> {scrollIndicator}</Text>}
            {focused && response && !copyStatus && !selectionMode && (
              <Text dimColor> • c=copy • s=selection mode</Text>
            )}
            {focused && selectionMode && (
              <Text color="yellow"> SELECTION MODE • Press s to exit</Text>
            )}
          </Box>
          {copyStatus && (
            <Text color={copyStatus.includes("✓") ? "green" : "red"}>{copyStatus}</Text>
          )}
        </Box>
        <Box flexDirection="column" paddingX={1} paddingBottom={1} overflow="hidden">
          {visibleNodes}
        </Box>
      </Box>
    );
  },
  (p, n) => p.focused === n.focused && p.isVerbose === n.isVerbose && p.height === n.height && p.yOffset === n.yOffset
);
