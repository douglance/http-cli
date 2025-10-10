import { generateStableRequestId } from "../utils/stableId.js";
import type { ParsedRequest, ParseResult, Parser } from "./types.js";

/**
 * Parser for Thunder Client collections
 * VS Code extension format
 */

interface ThunderRequest {
  _id: string;
  colId: string;
  name: string;
  url: string;
  method: string;
  headers?: Array<{ name: string; value: string; isDisabled?: boolean }>;
  body?: {
    type: string;
    raw?: string;
  };
  created?: string;
}

interface ThunderCollection {
  client: string;
  collectionName: string;
  dateExported: string;
  version: string;
  requests: ThunderRequest[];
}

export const thunderParser: Parser = {
  name: "Thunder Client",

  detect: (content: string): boolean => {
    try {
      const json = JSON.parse(content);
      return json.client === "Thunder Client" || (json.requests && Array.isArray(json.requests));
    } catch {
      return false;
    }
  },

  parse: (content: string): ParseResult => {
    const requests: ParsedRequest[] = [];

    try {
      const data: ThunderCollection = JSON.parse(content);

      for (const req of data.requests || []) {
        const headers: Record<string, string> = {};
        if (req.headers) {
          for (const h of req.headers) {
            if (!h.isDisabled && h.name && h.value) {
              headers[h.name] = h.value;
            }
          }
        }

        const request = {
          name: req.name,
          method: req.method,
          url: req.url,
          headers,
          body: req.body?.raw || null,
          folderId: null,
          createdAt: req.created || new Date().toISOString(),
          id: "", // Will be set below
        };
        request.id = generateStableRequestId(request);
        requests.push(request);
      }
    } catch (error) {
      console.error("Failed to parse Thunder Client collection:", error);
    }

    return { requests, folders: [] };
  },

  export: (requests: ParsedRequest[]): string => {
    const collection: ThunderCollection = {
      client: "Thunder Client",
      collectionName: "HTTP Inspector Collection",
      dateExported: new Date().toISOString(),
      version: "1.1",
      requests: requests.map((req, idx) => ({
        _id: `req_${idx}`,
        colId: "col_1",
        name: req.name,
        url: req.url,
        method: req.method,
        headers: Object.entries(req.headers).map(([name, value]) => ({
          name,
          value,
        })),
        body: req.body
          ? {
              type: "json",
              raw: req.body,
            }
          : undefined,
        created: req.createdAt,
      })),
    };

    return JSON.stringify(collection, null, 2);
  },
};
