import { Text } from "ink";
import type React from "react";
import { generateLineKey } from "../utils/stableId.js";

function _highlightEnvVars(text: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  let key = 0;
  const parts = text.split(/(\{\{[^}]+\}\})/g);

  parts.forEach((part) => {
    if (!part) {
      return;
    }

    if (part.match(/^\{\{[^}]+\}\}$/)) {
      // Environment variable
      result.push(
        <Text key={key++} color="yellow" bold>
          {part}
        </Text>
      );
    } else {
      result.push(<Text key={key++}>{part}</Text>);
    }
  });

  return result;
}

export function highlightJSON(json: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  let key = 0;

  // Enhanced regex for better JSON tokenization
  // Captures: strings (with escapes), numbers (int/float/exp), keywords, punctuation, whitespace
  const jsonRegex =
    /("(?:[^"\\]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(\btrue\b|\bfalse\b|\bnull\b)|([:,[\]{}])|(\s+)/g;

  let match: RegExpExecArray | null;
  let lastIndex = 0;

  // Process environment variables first
  if (json.includes("{{")) {
    const envRegex = /(\{\{[^}]+\}\})/g;
    const envMatch = json.match(envRegex);
    if (envMatch) {
      // Mixed content with env vars - split and process
      const parts = json.split(envRegex);
      parts.forEach((part) => {
        if (!part) return;

        if (part.match(/^\{\{[^}]+\}\}$/)) {
          // Environment variable
          result.push(
            <Text key={key++} color="yellow" bold>
              {part}
            </Text>
          );
        } else {
          // Regular JSON - recursively highlight
          const highlighted = highlightJSONPart(part);
          result.push(...highlighted.map((node, idx) => <Text key={key++ + idx}>{node}</Text>));
        }
      });
      return result;
    }
  }

  // Regular JSON highlighting
  while ((match = jsonRegex.exec(json)) !== null) {
    // Add any text before this match (shouldn't happen in valid JSON)
    if (match.index > lastIndex) {
      const plainText = json.substring(lastIndex, match.index);
      result.push(<Text key={key++}>{plainText}</Text>);
    }

    const [fullMatch, string, number, keyword, punctuation, whitespace] = match;

    if (string) {
      // Check if this string is a key (followed by colon)
      const afterString = json.substring(match.index + string.length).trim();
      const isKey = afterString.startsWith(":");
      result.push(
        <Text key={key++} color={isKey ? "cyan" : "green"}>
          {string}
        </Text>
      );
    } else if (number) {
      result.push(
        <Text key={key++} color="yellow">
          {number}
        </Text>
      );
    } else if (keyword) {
      result.push(
        <Text key={key++} color="magenta">
          {keyword}
        </Text>
      );
    } else if (punctuation) {
      result.push(
        <Text key={key++} dimColor>
          {punctuation}
        </Text>
      );
    } else if (whitespace) {
      result.push(<Text key={key++}>{whitespace}</Text>);
    }

    lastIndex = match.index + fullMatch.length;
  }

  // Add any remaining text
  if (lastIndex < json.length) {
    result.push(<Text key={key++}>{json.substring(lastIndex)}</Text>);
  }

  return result;
}

// Helper function for highlighting JSON parts
function highlightJSONPart(jsonPart: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  const jsonRegex =
    /("(?:[^"\\]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(\btrue\b|\bfalse\b|\bnull\b)|([:,[\]{}])|(\s+)/g;

  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = jsonRegex.exec(jsonPart)) !== null) {
    if (match.index > lastIndex) {
      result.push(jsonPart.substring(lastIndex, match.index));
    }

    const [fullMatch, string, number, keyword, punctuation, whitespace] = match;

    if (string) {
      const afterString = jsonPart.substring(match.index + string.length).trim();
      const isKey = afterString.startsWith(":");
      result.push(
        <Text color={isKey ? "cyan" : "green"}>{string}</Text>
      );
    } else if (number) {
      result.push(<Text color="yellow">{number}</Text>);
    } else if (keyword) {
      result.push(<Text color="magenta">{keyword}</Text>);
    } else if (punctuation) {
      result.push(<Text dimColor>{punctuation}</Text>);
    } else if (whitespace) {
      result.push(whitespace);
    }

    lastIndex = match.index + fullMatch.length;
  }

  if (lastIndex < jsonPart.length) {
    result.push(jsonPart.substring(lastIndex));
  }

  return result;
}

export function highlightHTTP(content: string): React.ReactNode[] {
  const lines = content.split("\n");
  const result: React.ReactNode[] = [];

  lines.forEach((line, idx) => {
    if (idx > 0) {
      result.push(<Text key={generateLineKey("\n", idx)}>{"\n"}</Text>);
    }

    // Check for environment variables first
    if (line.includes("{{")) {
      const envParts = line.split(/(\{\{[^}]+\}\})/g);
      envParts.forEach((part, partIdx) => {
        if (part.match(/^\{\{[^}]+\}\}$/)) {
          result.push(
            <Text key={generateLineKey(part, idx * 1000 + partIdx)} color="yellow" bold>
              {part}
            </Text>
          );
        } else if (part) {
          result.push(<Text key={generateLineKey(part, idx * 1000 + partIdx + 500)}>{part}</Text>);
        }
      });
      return;
    }

    // HTTP status line
    if (line.match(/^HTTP\/[\d.]+ \d+ /)) {
      const parts = line.match(/^(HTTP\/[\d.]+) (\d+) (.*)$/);
      if (parts?.[1] && parts[2]) {
        result.push(
          <Text key={generateLineKey(line, idx)}>
            <Text dimColor>{parts[1]} </Text>
            <Text color={getStatusColor(parseInt(parts[2], 10))} bold>
              {parts[2]}
            </Text>
            <Text> {parts[3] || ""}</Text>
          </Text>
        );
      }
      return;
    }

    // HTTP request line
    if (line.match(/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS) /)) {
      const parts = line.match(/^(\w+) (.*?) (HTTP\/[\d.]+)$/);
      if (parts) {
        result.push(
          <Text key={generateLineKey(line, idx)}>
            <Text color="cyan" bold>
              {parts[1]}
            </Text>
            <Text> {parts[2]} </Text>
            <Text dimColor>{parts[3]}</Text>
          </Text>
        );
      } else {
        const spaceIdx = line.indexOf(" ");
        result.push(
          <Text key={generateLineKey(line, idx)}>
            <Text color="cyan" bold>
              {line.split(" ")[0]}
            </Text>
            <Text> {spaceIdx >= 0 ? line.substring(spaceIdx + 1) : ""}</Text>
          </Text>
        );
      }
      return;
    }

    // Header line
    if (line.match(/^[\w-]+:/)) {
      const colonIndex = line.indexOf(":");
      const headerName = line.substring(0, colonIndex);
      const headerValue = line.substring(colonIndex + 1);
      result.push(
        <Text key={generateLineKey(line, idx)}>
          <Text color="blue">{headerName}</Text>
          <Text dimColor>:</Text>
          <Text>{headerValue}</Text>
        </Text>
      );
      return;
    }

    // Try to detect JSON body
    const trimmed = line.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        // Try to parse as JSON
        JSON.parse(line);
        result.push(<Text key={generateLineKey(line, idx)}>{highlightJSON(line)}</Text>);
        return;
      } catch {
        // Not valid JSON, fall through
      }
    }

    // Plain line
    result.push(<Text key={generateLineKey(line, idx)}>{line}</Text>);
  });

  return result;
}

function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) {
    return "green";
  }
  if (status >= 300 && status < 400) {
    return "yellow";
  }
  if (status >= 400 && status < 500) {
    return "red";
  }
  if (status >= 500) {
    return "red";
  }
  return "white";
}
