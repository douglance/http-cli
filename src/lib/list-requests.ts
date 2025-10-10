// List all available HTTP requests from .http files
// Formats as table according to CLI-REQUIREMENTS.md section 2

import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { httpParser } from "../parsers/http-parser.js";
import type { ParsedRequest } from "../parsers/types.js";

export interface RequestMetadata {
  name: string;
  method: string;
  url: string;
  variables: string[];
  file: string;
}

interface ColumnWidths {
  file: number;
  name: number;
  method: number;
  url: number;
  variables: number;
}

/**
 * Discover all .http and .rest files in directory
 */
export function discoverHttpFiles(directory: string, specificFile?: string): string[] {
  if (specificFile) {
    // Use specific file if provided
    let filePath = specificFile;
    if (!filePath.endsWith(".http") && !filePath.endsWith(".rest")) {
      filePath += ".http";
    }
    return [join(directory, filePath)];
  }

  try {
    const files = readdirSync(directory);
    return files
      .filter((file) => file.endsWith(".http") || file.endsWith(".rest"))
      .map((file) => join(directory, file))
      .sort(); // Alphabetical order
  } catch {
    return [];
  }
}

/**
 * Extract request metadata from .http file
 */
export function extractRequestsFromFile(filePath: string): RequestMetadata[] {
  try {
    const content = readFileSync(filePath, "utf-8");
    const fileName = basename(filePath);
    const parsed = httpParser.parse(content);

    return parsed.requests.map((request: ParsedRequest) => {
      // Extract variables from this specific request
      const requestContent = `${request.url}\n${JSON.stringify(request.headers)}\n${request.body || ""}`;
      const variables = extractVariables(requestContent);

      return {
        name: request.name,
        method: request.method,
        url: request.url,
        variables,
        file: fileName,
      };
    });
  } catch {
    console.error(`Warning: Failed to parse ${basename(filePath)}`);
    return [];
  }
}

/**
 * Extract {{VARIABLE}} patterns from content
 */
function extractVariables(content: string): string[] {
  const variablePattern = /\{\{(\w+)\}\}/g;
  const matches = content.matchAll(variablePattern);
  const variables = new Set<string>();

  for (const match of matches) {
    if (match[1]) {
      variables.add(match[1]);
    }
  }

  return Array.from(variables).sort();
}

/**
 * Calculate column widths based on content
 */
function calculateColumnWidths(requests: RequestMetadata[], showFileColumn: boolean): ColumnWidths {
  const widths: ColumnWidths = {
    file: 14,
    name: 14,
    method: 6,
    url: 32,
    variables: 10,
  };

  for (const request of requests) {
    if (showFileColumn) {
      widths.file = Math.max(widths.file, request.file.length);
    }
    widths.name = Math.max(widths.name, request.name.length);
    widths.method = Math.max(widths.method, request.method.length);
    widths.url = Math.max(widths.url, request.url.length);

    const variablesStr = request.variables.join(", ");
    widths.variables = Math.max(widths.variables, variablesStr.length);
  }

  return widths;
}

/**
 * Format requests as table
 */
export function formatAsTable(requests: RequestMetadata[], showFileColumn: boolean): string {
  if (requests.length === 0) {
    return "";
  }

  const widths = calculateColumnWidths(requests, showFileColumn);
  const lines: string[] = [];

  // Header row
  const headerParts: string[] = [];
  if (showFileColumn) {
    headerParts.push("FILE".padEnd(widths.file));
  }
  headerParts.push("NAME".padEnd(widths.name));
  headerParts.push("METHOD".padEnd(widths.method));
  headerParts.push("URL".padEnd(widths.url));
  headerParts.push("VARIABLES");

  lines.push(headerParts.join("  "));

  // Data rows
  for (const request of requests) {
    const rowParts: string[] = [];
    if (showFileColumn) {
      rowParts.push(request.file.padEnd(widths.file));
    }
    rowParts.push(request.name.padEnd(widths.name));
    rowParts.push(request.method.padEnd(widths.method));
    rowParts.push(request.url.padEnd(widths.url));
    rowParts.push(request.variables.join(", "));

    lines.push(rowParts.join("  "));
  }

  return lines.join("\n");
}

/**
 * List all requests from .http files
 */
export function listRequests(directory: string, specificFile?: string): void {
  const files = discoverHttpFiles(directory, specificFile);

  if (files.length === 0) {
    console.error("No .http files found in current directory");
    process.exit(0);
  }

  const allRequests: RequestMetadata[] = [];

  for (const file of files) {
    const requests = extractRequestsFromFile(file);
    allRequests.push(...requests);
  }

  if (allRequests.length === 0) {
    console.error("No requests found in .http files");
    process.exit(0);
  }

  // Sort by file, then by name
  allRequests.sort((a, b) => {
    if (a.file !== b.file) {
      return a.file.localeCompare(b.file);
    }
    return a.name.localeCompare(b.name);
  });

  // Show FILE column only if multiple files (requirements 2.5, 2.8)
  const showFileColumn = files.length > 1 && !specificFile;
  const table = formatAsTable(allRequests, showFileColumn);

  console.log(table);
  process.exit(0);
}
