import { generateStableFolderId, generateStableRequestId } from "../utils/stableId.js";
import type { Folder, ParsedRequest, ParseResult, Parser } from "./types.js";

/**
 * Parser for Postman Collection v2.1 format
 * https://schema.getpostman.com/json/collection/v2.1.0/collection.json
 */

interface PostmanRequest {
  name: string;
  request: {
    method: string;
    header?: Array<{ key: string; value: string }>;
    url: string | { raw: string };
    body?: {
      mode: string;
      raw?: string;
    };
  };
}

interface PostmanCollection {
  info: {
    name: string;
    schema: string;
  };
  item: Array<PostmanRequest | { name: string; item: PostmanRequest[] }>;
}

export const postmanParser: Parser = {
  name: "Postman Collection",

  detect: (content: string): boolean => {
    try {
      const json = JSON.parse(content);
      return json.info?.schema?.includes("postman") || json.info?._postman_id !== undefined;
    } catch {
      return false;
    }
  },

  parse: (content: string): ParseResult => {
    const requests: ParsedRequest[] = [];
    const folders: Folder[] = [];

    try {
      const collection: PostmanCollection = JSON.parse(content);

      const parseItem = (
        item: PostmanRequest | { name: string; item: PostmanRequest[] },
        parentId: string | null = null
      ) => {
        // Folder with sub-items
        if ("item" in item && Array.isArray(item.item)) {
          const folder = {
            name: item.name,
            parentId,
            id: "", // Will be set below
          };
          folder.id = generateStableFolderId(folder);
          folders.push(folder);
          const folderId = folder.id;

          for (const subItem of item.item) {
            parseItem(subItem, folderId);
          }
          return;
        }

        // Request item
        const req = item as PostmanRequest;
        const headers: Record<string, string> = {};

        // Parse headers
        if (req.request.header) {
          for (const h of req.request.header) {
            headers[h.key] = h.value;
          }
        }

        // Parse URL
        const url = typeof req.request.url === "string" ? req.request.url : req.request.url.raw;

        // Parse body
        let body: string | null = null;
        if (req.request.body?.mode === "raw" && req.request.body.raw) {
          body = req.request.body.raw;
        }

        const request = {
          name: req.name,
          method: req.request.method,
          url,
          headers,
          body,
          folderId: parentId,
          createdAt: new Date().toISOString(),
          id: "", // Will be set below
        };
        request.id = generateStableRequestId(request);
        requests.push(request);
      };

      for (const item of collection.item) {
        parseItem(item);
      }
    } catch (error) {
      console.error("Failed to parse Postman collection:", error);
    }

    return { requests, folders };
  },

  export: (requests: ParsedRequest[]): string => {
    const collection: PostmanCollection = {
      info: {
        name: "HTTP Inspector Collection",
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      },
      item: requests.map((req) => ({
        name: req.name,
        request: {
          method: req.method,
          header: Object.entries(req.headers).map(([key, value]) => ({
            key,
            value,
          })),
          url: req.url,
          body: req.body
            ? {
                mode: "raw",
                raw: req.body,
              }
            : undefined,
        },
      })),
    };

    return JSON.stringify(collection, null, 2);
  },
};
