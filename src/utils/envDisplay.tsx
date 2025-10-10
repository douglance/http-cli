import { Text } from "ink";
import type React from "react";
import { getEnvColor, useEnvStore } from "../stores/envStore.js";

/**
 * Parses text containing {{VAR_NAME}} and returns React components
 * with colored $VAR_NAME displays (where the actual value is substituted)
 */
export const renderTextWithEnvVars = (text: string): React.ReactNode[] => {
  const { activeEnvIndex, envFiles } = useEnvStore.getState();
  const vars = envFiles[activeEnvIndex]?.vars || {};

  // Get color for current environment
  const color = getEnvColor(activeEnvIndex);

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;

  // Find all {{VAR_NAME}} patterns
  const regex = /\{\{([^}]+)\}\}/g;
  let match = regex.exec(text);

  while (match !== null) {
    const fullMatch = match[0];
    const varName = match[1]?.trim();
    const matchStart = match.index;

    // Add text before the variable
    if (matchStart > lastIndex) {
      nodes.push(<Text key={`text-${lastIndex}`}>{text.substring(lastIndex, matchStart)}</Text>);
    }

    if (varName) {
      const value = vars[varName];

      if (value) {
        // Show $VAR_NAME in the environment's color
        nodes.push(
          <Text key={`var-${matchStart}`} color={color}>
            ${varName}
          </Text>
        );
      } else {
        // Variable not found - show {{VAR_NAME}} dimmed
        nodes.push(
          <Text key={`var-${matchStart}`} dimColor>
            {fullMatch}
          </Text>
        );
      }
    }

    lastIndex = matchStart + fullMatch.length;
    match = regex.exec(text);
  }

  // Add remaining text after last variable
  if (lastIndex < text.length) {
    nodes.push(<Text key={`text-${lastIndex}`}>{text.substring(lastIndex)}</Text>);
  }

  return nodes.length > 0 ? nodes : [<Text key="text">{text}</Text>];
};
