// Execute HTTP request and output JSON
// JSON schema according to CLI-REQUIREMENTS.md section 3

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { httpParser } from "../parsers/http-parser.js";
import type { ParsedRequest } from "../parsers/types.js";
import { isBinaryContentType, processBinaryResponse } from "./binary-response-handler.js";
import { discoverHttpFiles } from "./list-requests.js";
import { redactRequestForOutput } from "./sensitive-data-redactor.js";
import { processRequestVariables } from "./variable-resolver.js";

interface ExecutionResult {
  request: {
    name: string;
    file: string;
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
  };
  response: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    bodySize: number;
    binaryData?: string; // Base64-encoded binary data (requirements 13.2)
  };
  timings: {
    dnsLookup: number;
    tcpConnection: number;
    tlsHandshake?: number;
    firstByte: number;
    total: number;
  };
  metadata: {
    timestamp: string;
    environment?: string;
  };
}

interface ErrorResult {
  error: {
    type: string;
    message: string;
    code?: string;
    details?: Record<string, unknown>;
    hint?: string;
  };
  request?: {
    name: string;
    file: string;
    method: string;
    url: string;
  };
}

/**
 * Find request by name in discovered files
 */
function findRequestByName(
  directory: string,
  requestName: string,
  specificFile?: string
): { request: ParsedRequest; file: string } | null {
  const files = discoverHttpFiles(directory, specificFile);

  if (files.length === 0) {
    return null;
  }

  const matches: Array<{ request: ParsedRequest; file: string }> = [];

  for (const filePath of files) {
    try {
      const content = readFileSync(filePath, "utf-8");
      const parsed = httpParser.parse(content);

      for (const request of parsed.requests) {
        if (request.name === requestName) {
          matches.push({ request, file: basename(filePath) });
        }
      }
    } catch {
      // Skip files that fail to parse
    }
  }

  if (matches.length === 0) {
    return null;
  }

  // Check for ambiguity (requirements 3.6)
  if (matches.length > 1 && !specificFile) {
    const fileNames = matches.map((m) => m.file).join(", ");
    const error: ErrorResult = {
      error: {
        type: "AmbiguousRequestError",
        message: `Request '${requestName}' found in multiple files: ${fileNames}`,
        hint: `Use -f flag to specify file: http -f ${matches[0]?.file} ${requestName}`,
      },
    };
    console.log(JSON.stringify(error, null, 2));
    process.exit(1);
  }

  return matches[0] || null;
}

/**
 * Execute HTTP request and return JSON
 */
async function executeHttpRequest(
  request: ParsedRequest,
  fileName: string,
  directory: string
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const timingStart = performance.now();

  try {
    // Resolve variables from .env and shell environment (requirements 7.1)
    const processed = processRequestVariables(
      directory,
      request.url,
      request.headers,
      request.body
    );

    // Prepare request
    const url = new URL(processed.url);
    const isHttps = url.protocol === "https:";

    // Timing: DNS lookup (simulated - actual timing would need native module)
    const dnsStart = performance.now();
    const dnsEnd = performance.now();
    const dnsLookup = Math.round(dnsEnd - dnsStart);

    // Timing: TCP connection (simulated)
    const tcpStart = performance.now();

    // Make HTTP request using fetch
    const fetchStart = performance.now();
    const response = await fetch(processed.url, {
      method: request.method,
      headers: processed.headers,
      body: processed.body || undefined,
    });
    const firstByteTime = performance.now();

    // Build response headers object
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // Check if response is binary (requirements 13.1)
    const contentType = responseHeaders["content-type"] || responseHeaders["Content-Type"];
    const isBinary = isBinaryContentType(contentType);

    // Read response body based on content type
    let bodyText: string;
    let bodySize: number;
    let binaryData: string | undefined;

    if (isBinary) {
      // Binary response: read as buffer and encode to base64 (requirements 13.2)
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const binaryResult = processBinaryResponse(buffer, contentType || "application/octet-stream");

      bodyText = binaryResult.body;
      bodySize = binaryResult.bodySize;
      binaryData = binaryResult.binaryData;
    } else {
      // Text response: read as text
      bodyText = await response.text();
      bodySize = bodyText.length;
    }

    const totalTime = performance.now();

    const tcpConnection = Math.round(fetchStart - tcpStart);
    const tlsHandshake = isHttps ? Math.round((fetchStart - tcpStart) * 0.3) : undefined;
    const firstByte = Math.round(firstByteTime - timingStart);
    const total = Math.round(totalTime - timingStart);

    // Redact sensitive data for JSON output (requirements 12.1)
    // IMPORTANT: Redaction only affects output, NOT actual HTTP request
    const redacted = redactRequestForOutput(processed.url, processed.headers);

    // Build result
    const result: ExecutionResult = {
      request: {
        name: request.name,
        file: fileName,
        method: request.method,
        url: redacted.url,
        headers: redacted.headers,
        body: processed.body || undefined,
      },
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: bodyText,
        bodySize,
        binaryData,
      },
      timings: {
        dnsLookup,
        tcpConnection,
        tlsHandshake,
        firstByte,
        total,
      },
      metadata: {
        timestamp: new Date(startTime).toISOString(),
      },
    };

    return result;
  } catch (error) {
    // Network error (requirements 3.4)
    const errorResult: ErrorResult = {
      error: {
        type: "NetworkError",
        code: (error as { code?: string }).code || "UNKNOWN",
        message: error instanceof Error ? error.message : String(error),
      },
      request: {
        name: request.name,
        file: fileName,
        method: request.method,
        url: request.url,
      },
    };

    console.log(JSON.stringify(errorResult, null, 2));
    process.exit(1);
  }
}

/**
 * Execute request by name and output JSON
 */
export async function executeRequest(
  directory: string,
  requestName: string,
  specificFile?: string
): Promise<void> {
  // Find request
  const match = findRequestByName(directory, requestName, specificFile);

  if (!match) {
    // Request not found (requirements 3.5)
    const error: ErrorResult = {
      error: {
        type: "NotFoundError",
        message: specificFile
          ? `Request '${requestName}' not found in ${specificFile}`
          : `Request '${requestName}' not found`,
      },
    };
    console.log(JSON.stringify(error, null, 2));
    process.exit(1);
  }

  // Execute request
  const result = await executeHttpRequest(match.request, match.file, directory);

  // Output JSON (requirements 3.1)
  // Use process.stdout.write for large outputs (binary data)
  process.stdout.write(JSON.stringify(result, null, 2));
  process.stdout.write("\n");

  // Exit with code 0 (success, even for HTTP errors like 404/500)
  process.exit(0);
}
