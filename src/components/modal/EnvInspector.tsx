import { Box, Text, useInput } from "ink";
import React from "react";
import { getEnvColor, useEnvStore } from "../../stores/envStore.js";

interface EnvInspectorProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EnvInspector({ isOpen, onClose }: EnvInspectorProps) {
  const { envFiles, selectedEnvIndex, activeEnvIndex, getSelectedEnvLabel } = useEnvStore();
  const [scrollOffset, setScrollOffset] = React.useState(0);

  useInput(
    (input, key) => {
      if (!isOpen) {
        return;
      }

      if (key.escape || input === "q" || input === "e") {
        onClose();
      } else if (key.upArrow) {
        setScrollOffset((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setScrollOffset((prev) => prev + 1);
      }
    },
    { isActive: isOpen }
  );

  if (!isOpen) {
    return null;
  }

  const selectedEnv = envFiles[selectedEnvIndex];
  if (!selectedEnv) {
    return null;
  }

  const envLabel = getSelectedEnvLabel();
  const vars = Object.entries(selectedEnv.vars);
  const visibleHeight = 20;
  const maxScroll = Math.max(0, vars.length - visibleHeight);
  const actualScrollOffset = Math.min(scrollOffset, maxScroll);
  const visibleVars = vars.slice(actualScrollOffset, actualScrollOffset + visibleHeight);

  // Only color if this is the active environment
  const isActive = selectedEnvIndex === activeEnvIndex;
  const envColor = isActive ? getEnvColor(activeEnvIndex) : undefined;

  return (
    <Box position="absolute" width="100%" height="100%" justifyContent="center" alignItems="center">
      <Box
        flexDirection="column"
        borderStyle="double"
        borderColor="cyan"
        paddingX={2}
        paddingY={1}
        width={80}
      >
        <Box justifyContent="space-between" marginBottom={1}>
          <Text>
            <Text>ENV Inspector: </Text>
            <Text color={envColor} bold={isActive}>
              {envLabel.toUpperCase()}
            </Text>
          </Text>
          <Text dimColor>[ESC/e/q] Close · [↑↓] Scroll</Text>
        </Box>

        <Box borderStyle="single" borderColor="gray" paddingX={1} paddingY={0}>
          <Text dimColor>
            {selectedEnv.name} ({vars.length} variables)
          </Text>
        </Box>

        <Box flexDirection="column" marginTop={1}>
          {visibleVars.length === 0 ? (
            <Text dimColor>No variables defined</Text>
          ) : (
            visibleVars.map(([key, value]) => (
              <Box key={key} marginBottom={0}>
                <Text color={envColor} bold>
                  {key}
                </Text>
                <Text dimColor>: </Text>
                <Text>{value}</Text>
              </Box>
            ))
          )}
        </Box>

        {vars.length > visibleHeight && (
          <Box marginTop={1}>
            <Text dimColor>
              Showing {actualScrollOffset + 1}-
              {Math.min(actualScrollOffset + visibleHeight, vars.length)} of {vars.length}
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
