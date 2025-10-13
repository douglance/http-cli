import { Box, Text, useInput } from "ink";
import React from "react";
import { useShallow } from "zustand/react/shallow";
import { useFocusManager } from "../../hooks/useFocusManager.js";
import { useMouse } from "../../hooks/useMouse.js";
import { useSavedRequestsStore } from "../../stores/savedRequestsStore.js";
import type { Folder, SavedRequest } from "../../stores/storage.js";
import { EnvSelector } from "./EnvSelector.js";

interface SavedPanelProps {
  width: number;
  focused: boolean;
  height: number;
  yOffset?: number;
  xOffset?: number; // absolute left X of this panel (cols)
}

type FocusArea = "requests" | "env";

export const SavedPanel = React.memo(
  function SavedPanel({ width, focused, height, yOffset = 1, xOffset = 0 }: SavedPanelProps) {
    // Data only (primitive types and arrays for shallow comparison)
    const { selectedRequestId, requests, folders } = useSavedRequestsStore(
      useShallow((s) => ({
        selectedRequestId: s.selectedRequestId,
        requests: s.requests,
        folders: s.folders,
      }))
    );

    // expandedFolders separately (Set causes rerender on every change due to reference equality)
    const expandedFolders = useSavedRequestsStore((s) => s.expandedFolders);

    // Actions separately (these are stable in Zustand)
    const selectRequest = useSavedRequestsStore((s) => s.selectRequest);
    const toggleFolder = useSavedRequestsStore((s) => s.toggleFolder);
    const { setFocus } = useFocusManager();
    const [cursor, setCursor] = React.useState(0);
    const [scrollOffset, setScrollOffset] = React.useState(0);
    const [focusArea, setFocusArea] = React.useState<FocusArea>("requests");
    const [lastClickTime, setLastClickTime] = React.useState<number>(0);
    const [lastClickedIndex, setLastClickedIndex] = React.useState<number>(-1);

    // Compute tree nodes from primitive data (no function dependency)
    const treeNodes = React.useMemo(() => {
      const nodes: Array<
        | { type: "folder"; folder: Folder; depth: number }
        | { type: "request"; request: SavedRequest; depth: number }
      > = [];

      const buildTree = (parentId: string | null, depth: number) => {
        folders
          .filter((f) => f.parentId === parentId)
          .forEach((folder) => {
            nodes.push({ type: "folder", folder, depth });
            if (expandedFolders.has(folder.id)) {
              buildTree(folder.id, depth + 1);
            }
          });

        requests
          .filter((r) => r.folderId === parentId)
          .forEach((request) => {
            nodes.push({ type: "request", request, depth });
          });
      };

      buildTree(null, 0);
      return nodes;
    }, [requests, folders, expandedFolders]);

    // Allocate 30% of height to ENV selector (min 8 lines for decent viewing)
    const envSelectorHeight = Math.max(8, Math.floor(height * 0.3));
    const requestsHeight = height - envSelectorHeight;
    const visibleHeight = requestsHeight - 4;

    // Keep cursor synchronized with selected request after reloads
    React.useEffect(() => {
      if (selectedRequestId && treeNodes.length > 0) {
        const selectedIndex = treeNodes.findIndex(
          (node) => node.type === "request" && node.request.id === selectedRequestId
        );
        if (selectedIndex !== -1) {
          setCursor(selectedIndex);
        }
      }
    }, [selectedRequestId, treeNodes.length, treeNodes.findIndex]);

    // Auto-scroll to keep cursor in view
    React.useEffect(() => {
      if (cursor < scrollOffset) {
        setScrollOffset(cursor);
      } else if (cursor >= scrollOffset + visibleHeight) {
        setScrollOffset(cursor - visibleHeight + 1);
      }
    }, [cursor, scrollOffset, visibleHeight]);

    // Precompute slice used by mouse hit-testing so handler sees consistent view
    const visibleNodes = treeNodes.slice(scrollOffset, scrollOffset + visibleHeight);
    // ----------------

    useInput(
      (input, key) => {
        if (!focused) {
          return;
        }

        // j/k: Navigate between requests and ENV panes
        if (input === "j") {
          if (focusArea === "requests") {
            setFocusArea("env");
          }
        } else if (input === "k") {
          if (focusArea === "env") {
            setFocusArea("requests");
          }
        }
        // Arrow keys: Navigate within lists only (no pane switching)
        else if (key.upArrow) {
          if (focusArea === "requests" && cursor > 0) {
            setCursor((prev) => prev - 1);
          }
        } else if (key.downArrow) {
          if (focusArea === "requests" && cursor < treeNodes.length - 1) {
            setCursor((prev) => prev + 1);
          }
        } else if (key.leftArrow) {
          setFocus("response");
        } else if (key.rightArrow) {
          setFocus("editor");
        } else if (key.return) {
          if (focusArea === "requests" && treeNodes[cursor]) {
            const node = treeNodes[cursor];
            if (node.type === "folder") {
              toggleFolder(node.folder.id);
            } else {
              selectRequest(node.request.id);
              setFocus("editor");
            }
          }
        }
      },
      { isActive: focused }
    );

    // Helper: compute horizontal hit bounds for a rendered line
    // We approximate terminal cell widths (monospace). Emojis may be double-width;
    // we bias bounds slightly wide to be user-friendly but still avoid the far-right whitespace.
    const lineBounds = (node: typeof treeNodes[number]) => {
      // Left interior after border + paddingX=1
      // Border adds 1 col; header box uses paddingX=1; list content also uses paddingX=1.
      const borderLeft = 1;
      const paddingX = 1;
      const indent = node.type === "folder" ? node.depth * 2 : node.depth * 2;
      const startX = borderLeft + paddingX + indent; // relative to panel left

      if (node.type === "folder") {
        // "▼ " or "▶ " + "📁 " + folder name
        const glyphs = 2 /* triangle+space */ + 2 /* folder emoji approx */ + 1 /* space */;
        const textLen = node.folder.name.length;
        const endX = startX + glyphs + textLen;
        return { startX, endX };
      } else {
        // Request row layout:
        // [indicator/method column width 8] + space + request name
        const methodCol = 8; // matches <Box width={8}>
        const spacer = 1;
        const textLen = node.request.name.length;
        const endX = startX + methodCol + spacer + textLen;
        return { startX, endX };
      }
    };

    // Mouse event handling
    useMouse((event) => {
      const { x, y, scrollDown, scrollUp, leftClick, button } = event;

      // Convert absolute screen coordinates to component-relative
      const relativeY = y - yOffset;
      const relativeX = x - xOffset;

      // Ignore clicks outside this component's overall bounds
      if (relativeX < 0 || relativeX >= width || relativeY < 0 || relativeY >= height) {
        return;
      }

      // Activate this panel when clicked
      if (!focused && leftClick) {
        setFocus("collections");
      }

      // Determine which section was clicked based on relative Y position
      const isInRequestsSection = relativeY < requestsHeight;

      if (isInRequestsSection) {
        // Focus on requests section if clicked
        if (leftClick) {
          setFocusArea("requests");
        }

        // Handle scroll wheel
        if (scrollDown && cursor < treeNodes.length - 1) {
          setCursor((prev) => prev + 1);
          return;
        }
        if (scrollUp && cursor > 0) {
          setCursor((prev) => prev - 1);
          return;
        }

        // Handle clicks on request items
        if (leftClick && button === "left") {
          // Layout structure within requests box:
          // relativeY=0: Border top (1 line)
          // relativeY=1: Header "Collection (X)" with paddingX=1, paddingY=0 (1 line)
          // relativeY=2: marginTop=1 (1 line gap)
          // relativeY=3+: Items start here
          const borderTop = 1;
          const headerHeight = 1;
          const marginTop = 1;
          const itemsStartY = borderTop + headerHeight + marginTop;

          const clickedLineIndex = relativeY - itemsStartY;

          // Check if click is within visible items range
          if (clickedLineIndex >= 0 && clickedLineIndex < visibleNodes.length) {
            const clickedIndex = scrollOffset + clickedLineIndex;
            const node = treeNodes[clickedIndex];

            if (!node) {
              return;
            }

            // Check if click is within the actual text bounds (not whitespace)
            const { startX, endX } = lineBounds(node);
            if (relativeX < startX || relativeX > endX) {
              return;
            }

            // Double-click detection (within 300ms)
            const now = Date.now();
            const isDoubleClick = now - lastClickTime < 300 && clickedIndex === lastClickedIndex;

            if (isDoubleClick) {
              // Double-click: activate item (toggle folder or select request and switch to editor)
              if (node.type === "folder") {
                toggleFolder(node.folder.id);
              } else {
                selectRequest(node.request.id);
                setFocus("editor");
              }
            } else {
              // Single click: just select the item
              setCursor(clickedIndex);
              if (node.type === "request") {
                selectRequest(node.request.id);
              }
            }

            setLastClickTime(now);
            setLastClickedIndex(clickedIndex);
          }
        }
      } else {
        // Click in ENV section - focus on it
        if (leftClick) {
          setFocusArea("env");
        }
      }
    });

    const maxScroll = Math.max(0, treeNodes.length - visibleHeight);
    const hasContentAbove = scrollOffset > 0;
    const hasContentBelow = scrollOffset < maxScroll;
    const scrollIndicator =
      hasContentAbove && hasContentBelow ? "↕" : hasContentAbove ? "↑" : hasContentBelow ? "↓" : "";

    return (
      <Box flexDirection="column" width={width} height={height} overflow="hidden">
        <Box
          flexDirection="column"
          height={requestsHeight}
          borderStyle="single"
          borderColor={focused && focusArea === "requests" ? "cyan" : "gray"}
          overflow="hidden"
        >
          <Box paddingX={1} paddingY={0}>
            <Text bold color={focused && focusArea === "requests" ? "cyan" : "gray"}>
              Collection ({treeNodes.length})
              {scrollIndicator && <Text dimColor> {scrollIndicator}</Text>}
            </Text>
          </Box>
          <Box flexDirection="column" paddingBottom={1} marginTop={1} overflow="hidden">
            {treeNodes.length === 0 ? (
              <Box paddingX={1}>
                <Text dimColor>No saved requests</Text>
              </Box>
            ) : (
              visibleNodes.map((node, visibleIdx) => {
                const idx = scrollOffset + visibleIdx;
                const isSelected = idx === cursor && focused && focusArea === "requests";

                if (node.type === "folder") {
                  const isExpanded = expandedFolders.has(node.folder.id);
                  return (
                    <Box key={node.folder.id} paddingX={1} marginLeft={node.depth * 2}>
                      <Text color={isSelected ? "cyan" : "yellow"} bold>
                        {isExpanded ? "▼" : "▶"} 📁 {node.folder.name}
                      </Text>
                    </Box>
                  );
                } else {
                  const nameColor =
                    node.request.id === selectedRequestId ? "cyan" : isSelected ? "white" : "gray";
                  return (
                    <Box
                      key={node.request.id}
                      flexDirection="row"
                      paddingX={1}
                      marginLeft={node.depth * 2}
                    >
                      <Box width={8} flexShrink={0}>
                        <Text color={isSelected ? "cyan" : "white"}>{isSelected ? "▸" : " "}</Text>
                        <Text color={getMethodColor(node.request.method)} bold>
                          {node.request.method.padEnd(6)}
                        </Text>
                      </Box>
                      <Box flexGrow={1} flexDirection="column">
                        <Text color={nameColor} wrap="wrap">
                          {node.request.name}
                        </Text>
                      </Box>
                    </Box>
                  );
                }
              })
            )}
          </Box>
        </Box>
        <EnvSelector
          focused={focused && focusArea === "env"}
          height={envSelectorHeight}
          absoluteStartY={yOffset + requestsHeight}
        />
      </Box>
    );
  },
  (prev, next) =>
    prev.width === next.width &&
    prev.focused === next.focused &&
    prev.height === next.height &&
    prev.yOffset === next.yOffset
);

function getMethodColor(method: string): string {
  switch (method.toUpperCase()) {
    case "GET":
      return "blue";
    case "POST":
      return "green";
    case "PUT":
      return "yellow";
    case "PATCH":
      return "magenta";
    case "DELETE":
      return "red";
    default:
      return "white";
  }
}
