import { generateStableRequestId } from "../utils/stableId.js";
import type { ParsedRequest, ParseResult, Parser } from "./types.js";

/**
 * Parser for .http/.rest files (VS Code REST Client, JetBrains HTTP Client format)
 *
 * Format:
 * ### Request Name
 * # Comment line (ignored)
 * // Another comment style (ignored)
 * GET https://example.com/api
 * Header: Value
 *
 * {
 *   "body": "content"
 * }
 */
export const httpParser: Parser = {
  name: "HTTP File",

  detect: (content: string): boolean => {
    // Look for HTTP method at start of line followed by URL
    return /^\s*(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+https?:\/\//im.test(content);
  },

  parse: (content: string): ParseResult => {
    const requests: ParsedRequest[] = [];
    const errors: string[] = [];

    // Split by ### separator (request delimiter)
    const blocks = content.split(/^###\s*/m).filter((b) => b.trim());

    if (blocks.length === 0) {
      throw new Error(
        'No requests found. Requests should start with "###".\n\nExample:\n### My Request\nGET https://api.example.com'
      );
    }

    for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
      const block = blocks[blockIdx];
      if (!block) {
        continue;
      }
      const lines = block.split("\n");
      let name = "Unnamed Request";
      let method = "GET";
      let url = "";
      const headers: Record<string, string> = {};
      let body: string | null = null;
      let parsingHeaders = false;
      let parsingBody = false;
      const bodyLines: string[] = [];
      let foundMethod = false;
      let foundName = false;

      // Debug: log first 5 lines of each block
      if (process.env.DEBUG_PARSER) {
        console.log(`\n--- Block ${blockIdx} ---`);
        lines.slice(0, 5).forEach((l, i) => {
          console.log(`  Line ${i}: "${l}"`);
        });
      }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) {
          continue;
        }
        const trimmed = line.trim();

        // Skip comments (# but not ###, or //)
        if ((trimmed.startsWith("#") && !trimmed.startsWith("###")) || trimmed.startsWith("//")) {
          continue;
        }

        // Skip empty lines between headers and body
        if (!trimmed && !parsingBody) {
          if (parsingHeaders) {
            parsingBody = true;
          }
          continue;
        }

        // Try to match HTTP method and URL line first
        const methodMatch = trimmed.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(.+)$/i);
        let isMethodLine = false;

        if (methodMatch?.[1] && methodMatch[2]) {
          const potentialUrl = methodMatch[2].trim();
          // Only treat it as a URL if it looks like a URL (has protocol, {{var}}, or looks like a path)
          // Don't match plain words like "All Users"
          if (potentialUrl.match(/^(https?:\/\/|\{\{|\/)/i)) {
            method = methodMatch[1].toUpperCase();
            url = potentialUrl;
            foundMethod = true;
            isMethodLine = true;
            parsingHeaders = true;
            continue;
          }
        }

        // First non-empty, non-comment line that's not a method line is the request name
        if (!foundName && !foundMethod && !isMethodLine) {
          name = trimmed;
          foundName = true;
          continue;
        }

        // Headers (Key: Value format)
        if (parsingHeaders && !parsingBody) {
          const headerMatch = trimmed.match(/^([^:]+):\s*(.+)$/);
          if (headerMatch?.[1] && headerMatch[2]) {
            headers[headerMatch[1].trim()] = headerMatch[2].trim();
            continue;
          }
        }

        // Body content (everything after blank line)
        if (parsingBody || (parsingHeaders && trimmed && !trimmed.includes(":"))) {
          parsingBody = true;
          if (line) {
            bodyLines.push(line);
          }
        }
      }

      // Assemble body
      if (bodyLines.length > 0) {
        body = bodyLines.join("\n").trim();
      }

      // Validate request has required fields
      if (!foundMethod) {
        errors.push(
          `Request "${name}": Missing HTTP method. Add a line like:\nGET https://api.example.com`
        );
      } else if (!url) {
        errors.push(`Request "${name}": Missing URL after method ${method}`);
      } else {
        // Only add if we have a valid method and URL
        const request = {
          name,
          method,
          url,
          headers,
          body,
          folderId: null,
          createdAt: new Date().toISOString(),
          id: "", // Will be set below
        };
        request.id = generateStableRequestId(request);
        requests.push(request);
      }
    }

    // If we found errors but also parsed some requests, warn but continue
    if (errors.length > 0 && requests.length === 0) {
      throw new Error(`Failed to parse any valid requests:\n\n${errors.join("\n\n")}`);
    }

    // Log warnings for partial failures
    if (errors.length > 0) {
      console.warn(`⚠️  Parsing warnings:\n${errors.join("\n")}`);
    }

    return { requests, folders: [] };
  },

  export: (requests: ParsedRequest[]): string => {
    const output: string[] = [];

    for (const req of requests) {
      // Request name comment
      output.push(`### ${req.name}`);

      // Method and URL
      output.push(`${req.method} ${req.url}`);

      // Headers
      for (const [key, value] of Object.entries(req.headers)) {
        output.push(`${key}: ${value}`);
      }

      // Body (if present)
      if (req.body) {
        output.push(""); // Blank line before body
        output.push(req.body);
      }

      output.push(""); // Blank line between requests
    }

    return output.join("\n");
  },
};
