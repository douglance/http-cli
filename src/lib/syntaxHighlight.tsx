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

  // First check for environment variables
  if (json.includes("{{")) {
    const envParts = json.split(/(\{\{[^}]+\}\})/g);
    envParts.forEach((envPart) => {
      if (!envPart) {
        return;
      }

      if (envPart.match(/^\{\{[^}]+\}\}$/)) {
        result.push(
          <Text key={key++} color="yellow" bold>
            {envPart}
          </Text>
        );
        return;
      }

      // Simple JSON syntax highlighting
      const parts = envPart.split(
        /("(?:[^"\\]|\\.)*")|(\d+\.?\d*)|(\btrue\b|\bfalse\b|\bnull\b)|([:,[\]{}])/g
      );

      parts.forEach((part, idx) => {
        if (!part) {
          return;
        }

        if (part.match(/^".*"$/)) {
          // String (could be key or value)
          const isKey = idx > 0 && parts[idx + 1] === ":";
          result.push(
            <Text key={key++} color={isKey ? "cyan" : "green"}>
              {part}
            </Text>
          );
        } else if (part.match(/^\d+\.?\d*$/)) {
          // Number
          result.push(
            <Text key={key++} color="yellow">
              {part}
            </Text>
          );
        } else if (part.match(/^(true|false|null)$/)) {
          // Boolean/null
          result.push(
            <Text key={key++} color="magenta">
              {part}
            </Text>
          );
        } else if (part.match(/^[:,[\]{}]$/)) {
          // Punctuation
          result.push(
            <Text key={key++} dimColor>
              {part}
            </Text>
          );
        } else {
          // Plain text (whitespace, etc)
          result.push(<Text key={key++}>{part}</Text>);
        }
      });
    });

    return result;
  }

  // Simple JSON syntax highlighting (no env vars)
  const parts = json.split(
    /("(?:[^"\\]|\\.)*")|(\d+\.?\d*)|(\btrue\b|\bfalse\b|\bnull\b)|([:,[\]{}])/g
  );

  parts.forEach((part, idx) => {
    if (!part) {
      return;
    }

    if (part.match(/^".*"$/)) {
      // String (could be key or value)
      const isKey = idx > 0 && parts[idx + 1] === ":";
      result.push(
        <Text key={key++} color={isKey ? "cyan" : "green"}>
          {part}
        </Text>
      );
    } else if (part.match(/^\d+\.?\d*$/)) {
      // Number
      result.push(
        <Text key={key++} color="yellow">
          {part}
        </Text>
      );
    } else if (part.match(/^(true|false|null)$/)) {
      // Boolean/null
      result.push(
        <Text key={key++} color="magenta">
          {part}
        </Text>
      );
    } else if (part.match(/^[:,[\]{}]$/)) {
      // Punctuation
      result.push(
        <Text key={key++} dimColor>
          {part}
        </Text>
      );
    } else {
      // Plain text (whitespace, etc)
      result.push(<Text key={key++}>{part}</Text>);
    }
  });

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
