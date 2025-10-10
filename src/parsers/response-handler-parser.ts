// Parse response handler blocks from .http files
// Syntax: > {% JavaScript code %}

import type { ParsedHandler } from "../execution/types.js";

export interface ParseResult {
  hasHandler: boolean;
  script?: string;
  handlers?: ParsedHandler[];
  error?: string;
}

/**
 * Parse response handler(s) from .http file content
 * Looks for pattern: > {% script %}
 * @param content Full .http file content
 * @param startIndex Line number where parsing starts (optional)
 * @returns ParseResult with handlers and metadata
 */
export function parseResponseHandler(content: string, startIndex = 0): ParseResult {
  const handlers: ParsedHandler[] = [];
  const lines = content.split("\n");
  let error: string | undefined;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    // Check if line starts a handler
    if (trimmed.startsWith(">") && trimmed.includes("{%")) {
      // Find the closing %}
      let scriptContent = "";
      let foundClosing = false;
      const startLine = i + startIndex;

      // Collect lines for this handler
      for (let j = i; j < lines.length; j++) {
        const currentLine = lines[j] ?? "";
        scriptContent += currentLine;

        // Check for valid closing marker
        if (currentLine.includes("%}")) {
          foundClosing = true;
          i = j; // Move index to end of handler
          break;
        }

        // Check for malformed closing marker (e.g., "% }" with space)
        if (currentLine.includes("%") && currentLine.includes("}")) {
          const percentIndex = currentLine.lastIndexOf("%");
          const braceIndex = currentLine.indexOf("}", percentIndex);
          if (braceIndex > percentIndex && braceIndex - percentIndex > 1) {
            // Found "% }" or similar malformed pattern
            error = "malformed response handler: invalid closing marker";
            i = j;
            break;
          }
        }

        if (j < lines.length - 1) {
          scriptContent += "\n";
        }
      }

      if (!foundClosing && !error) {
        error = "malformed response handler: missing %}";
        break;
      }

      if (error) {
        break;
      }

      // Extract script between {% and %}
      const startMarker = scriptContent.indexOf("{%");
      const endMarker = scriptContent.indexOf("%}");

      // Check for malformed markers (e.g., "% }" with space)
      if (startMarker === -1 || endMarker === -1) {
        error = "malformed response handler: invalid markers";
        break;
      }

      if (endMarker <= startMarker) {
        error = "malformed response handler: markers out of order";
        break;
      }

      const script = scriptContent.substring(startMarker + 2, endMarker).trim();

      // Optionally validate JavaScript syntax
      try {
        // Try to parse as Function to catch syntax errors
        // Using Function constructor in non-strict mode for validation only
        new Function(script);
      } catch (syntaxError) {
        if (syntaxError instanceof SyntaxError) {
          error = `syntax error in response handler: ${syntaxError.message}`;
          break;
        }
      }

      handlers.push({
        script,
        startLine,
        language: "javascript",
      });
    }

    i++;
  }

  if (handlers.length === 0 && !error) {
    return { hasHandler: false, script: "" };
  }

  if (error) {
    return { hasHandler: true, error };
  }

  // Single handler - return as script property
  if (handlers.length === 1 && handlers[0]) {
    return {
      hasHandler: true,
      script: handlers[0].script,
    };
  }

  // Multiple handlers - return as handlers array
  return {
    hasHandler: true,
    handlers,
  };
}

/**
 * Check if line starts a response handler
 */
export function isResponseHandlerLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith(">") && trimmed.includes("{%");
}

/**
 * Extract multi-line response handler from lines array
 * @param lines Array of file lines
 * @param startIdx Index where handler starts
 * @returns { handler: ParsedHandler | null, endIdx: number }
 */
export function extractMultiLineHandler(
  lines: string[],
  startIdx: number
): { handler: ParsedHandler | null; endIdx: number } {
  let content = "";
  let endIdx = startIdx;

  // Collect lines until we find %}
  for (let i = startIdx; i < lines.length; i++) {
    content += lines[i];
    if (content.includes("%}")) {
      endIdx = i;
      break;
    }
    content += "\n"; // Preserve newlines for multi-line scripts
  }

  const result = parseResponseHandler(content, startIdx);
  if (result.error || !result.hasHandler) {
    return { handler: null, endIdx };
  }

  if (result.handlers && result.handlers.length > 0 && result.handlers[0]) {
    return { handler: result.handlers[0], endIdx };
  }

  return { handler: null, endIdx };
}
