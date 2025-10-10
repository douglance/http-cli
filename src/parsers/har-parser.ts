import { generateStableRequestId } from "../utils/stableId.js";
import type { ParsedRequest, ParseResult, Parser } from "./types.js";

/**
 * Parser for HAR (HTTP Archive) format - W3C standard
 * https://w3c.github.io/web-performance/specs/HAR/Overview.html
 */

interface HARHeader {
  name: string;
  value: string;
}

interface HARPostData {
  mimeType: string;
  text: string;
}

interface HARRequest {
  method: string;
  url: string;
  headers: HARHeader[];
  postData?: HARPostData;
}

interface HAREntry {
  startedDateTime: string;
  request: HARRequest;
  comment?: string;
}

interface HARLog {
  version: string;
  creator: {
    name: string;
    version: string;
  };
  entries: HAREntry[];
}

interface HAR {
  log: HARLog;
}

export const harParser: Parser = {
  name: "HAR (HTTP Archive)",

  detect: (content: string): boolean => {
    try {
      const json = JSON.parse(content);
      return json.log?.version !== undefined && json.log?.entries !== undefined;
    } catch {
      return false;
    }
  },

  parse: (content: string): ParseResult => {
    const requests: ParsedRequest[] = [];

    try {
      const har: HAR = JSON.parse(content);

      for (const entry of har.log.entries) {
        const req = entry.request;
        const headers: Record<string, string> = {};

        for (const h of req.headers) {
          headers[h.name] = h.value;
        }

        // Extract name from comment or URL
        let name = entry.comment || req.url;
        if (name === req.url) {
          try {
            const url = new URL(req.url);
            name = `${req.method} ${url.pathname}`;
          } catch {
            name = `${req.method} ${req.url.substring(0, 50)}`;
          }
        }

        const request = {
          name,
          method: req.method,
          url: req.url,
          headers,
          body: req.postData?.text || null,
          folderId: null,
          createdAt: entry.startedDateTime,
          id: "", // Will be set below
        };
        request.id = generateStableRequestId(request);
        requests.push(request);
      }
    } catch (error) {
      console.error("Failed to parse HAR file:", error);
    }

    return { requests, folders: [] };
  },

  export: (requests: ParsedRequest[]): string => {
    const har: HAR = {
      log: {
        version: "1.2",
        creator: {
          name: "HTTP Inspector",
          version: "1.0.0",
        },
        entries: requests.map((req) => ({
          startedDateTime: req.createdAt,
          request: {
            method: req.method,
            url: req.url,
            headers: Object.entries(req.headers).map(([name, value]) => ({
              name,
              value,
            })),
            postData: req.body
              ? {
                  mimeType: req.headers["Content-Type"] || "application/json",
                  text: req.body,
                }
              : undefined,
          },
          comment: req.name,
        })),
      },
    };

    return JSON.stringify(har, null, 2);
  },
};
