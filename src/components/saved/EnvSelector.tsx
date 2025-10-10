import { Box, Text, useInput } from "ink";
import React from "react";
import { useShallow } from "zustand/react/shallow";
import { useFocusManager } from "../../hooks/useFocusManager.js";
import { useMouse } from "../../hooks/useMouse.js";
import { getEnvColor, useEnvStore } from "../../stores/envStore.js";

interface EnvSelectorProps {
  focused: boolean;
  height: number;
  absoluteStartY: number;
}

export const EnvSelector = React.memo(
  function EnvSelector({ focused, height, absoluteStartY }: EnvSelectorProps) {
    // Separate data from actions
    const { envFiles, selectedEnvIndex, activeEnvIndex } = useEnvStore(
      useShallow((s) => ({
        envFiles: s.envFiles,
        selectedEnvIndex: s.selectedEnvIndex,
        activeEnvIndex: s.activeEnvIndex,
      }))
    );

    // Get actions separately
    const nextEnv = useEnvStore((s) => s.nextEnv);
    const prevEnv = useEnvStore((s) => s.prevEnv);
    const activateSelectedEnv = useEnvStore((s) => s.activateSelectedEnv);
    const setSelectedEnvIndex = useEnvStore((s) => s.setSelectedEnvIndex);
    const { setFocus } = useFocusManager();
    const [lastClickTime, setLastClickTime] = React.useState<number>(0);
    const [lastClickedIndex, setLastClickedIndex] = React.useState<number>(-1);

    // Calculate visible items based on container height
    // Subtract: border (2), header (1), marginTop (1) = 4 lines of overhead
    // Also reserve 2 lines for scroll indicators when list is longer than space
    const baseHeight = Math.max(2, height - 4);
    const needsScrolling = envFiles.length > baseHeight;
    const visibleHeight = needsScrolling ? Math.max(2, baseHeight - 2) : baseHeight;

    // Calculate scroll offset to keep selected item visible
    const scrollOffset = React.useMemo(() => {
      if (envFiles.length <= visibleHeight) {
        return 0;
      }

      // Keep selected item in middle when possible
      const idealOffset = selectedEnvIndex - Math.floor(visibleHeight / 2);
      const maxOffset = envFiles.length - visibleHeight;

      return Math.max(0, Math.min(idealOffset, maxOffset));
    }, [selectedEnvIndex, envFiles.length, visibleHeight]);

    useInput(
      (_input, key) => {
        if (!focused) {
          return;
        }

        if (key.upArrow) {
          prevEnv();
        } else if (key.downArrow) {
          nextEnv();
        } else if (key.return) {
          activateSelectedEnv();
        } else if (key.leftArrow) {
          setFocus("response");
        } else if (key.rightArrow) {
          setFocus("editor");
        }
      },
      { isActive: focused }
    );

    // Mouse event handling
    useMouse((event) => {
      const { y, scrollDown, scrollUp, leftClick, button } = event;

      // Check if click is within this component's bounds
      if (y < absoluteStartY || y >= absoluteStartY + height) {
        return;
      }

      // Focus collections panel when this component is clicked
      if (leftClick) {
        setFocus("collections");
      }

      // Handle scroll wheel
      if (scrollDown) {
        nextEnv();
        return;
      }
      if (scrollUp) {
        prevEnv();
        return;
      }

      // Handle clicks
      if (leftClick && button === "left") {
        // Calculate relative Y within this component
        const relativeY = y - absoluteStartY;

        // Account for: border (1), header (1), hasPrevious indicator (1 if shown)
        const itemsStartOffset = hasPrevious ? 3 : 2;
        const clickedLineIndex = relativeY - itemsStartOffset;

        // Check if click is within visible items range
        if (clickedLineIndex >= 0 && clickedLineIndex < visibleEnvs.length) {
          const clickedIndex = scrollOffset + clickedLineIndex;

          // Double-click detection (within 300ms)
          const now = Date.now();
          const isDoubleClick = now - lastClickTime < 300 && clickedIndex === lastClickedIndex;

          if (isDoubleClick) {
            // Double-click: activate the environment
            setSelectedEnvIndex(clickedIndex);
            activateSelectedEnv();
          } else {
            // Single click: select the environment
            setSelectedEnvIndex(clickedIndex);
          }

          setLastClickTime(now);
          setLastClickedIndex(clickedIndex);
        }
      }
    });

    const visibleEnvs = envFiles.slice(scrollOffset, scrollOffset + visibleHeight);
    const hasMore = scrollOffset + visibleHeight < envFiles.length;
    const hasPrevious = scrollOffset > 0;

    return (
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={focused ? "cyan" : "gray"}
        paddingX={1}
        width="100%"
        height={height}
      >
        <Box justifyContent="space-between">
          <Text bold color={focused ? "cyan" : "gray"}>
            ENV
          </Text>
          {focused && <Text dimColor>↑↓/click select · Enter/dblclick activate</Text>}
        </Box>
        <Box flexDirection="column" marginTop={1}>
          {hasPrevious && (
            <Box>
              <Text dimColor> ↑ {scrollOffset} more</Text>
            </Box>
          )}
          {visibleEnvs.map((env, visibleIdx) => {
            const idx = scrollOffset + visibleIdx;
            const isSelected = idx === selectedEnvIndex;
            const isActive = idx === activeEnvIndex;
            const envColor = isActive ? getEnvColor(idx) : undefined;

            return (
              <Box key={env.label}>
                {isActive ? <Text color="yellow">★ </Text> : <Text> </Text>}
                <Text
                  backgroundColor={isSelected && focused ? "cyan" : undefined}
                  color={isSelected && focused ? "black" : envColor || "gray"}
                  bold={isActive}
                >
                  {env.label.toUpperCase()}
                </Text>
              </Box>
            );
          })}
          {hasMore && (
            <Box>
              <Text dimColor> ↓ {envFiles.length - scrollOffset - visibleHeight} more</Text>
            </Box>
          )}
        </Box>
      </Box>
    );
  },
  (p, n) =>
    p.focused === n.focused && p.height === n.height && p.absoluteStartY === n.absoluteStartY
);
