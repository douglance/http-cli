import { generateStableFolderId, generateStableRequestId } from "../utils/stableId.js";
import type { Folder, ParsedRequest, ParseResult, Parser } from "./types.js";

/**
 * Parser for Insomnia export format (v4)
 */

interface InsomniaResource {
  _type: string;
  _id: string;
  parentId?: string;
  name?: string;
  method?: string;
  url?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: {
    mimeType?: string;
    text?: string;
  };
}

interface InsomniaExport {
  _type: "export";
  __export_format: number;
  resources: InsomniaResource[];
}

export const insomniaParser: Parser = {
  name: "Insomnia Export",

  detect: (content: string): boolean => {
    try {
      const json = JSON.parse(content);
      return json._type === "export" && json.__export_format !== undefined;
    } catch {
      return false;
    }
  },

  parse: (content: string): ParseResult => {
    const requests: ParsedRequest[] = [];
    const folders: Folder[] = [];

    try {
      const data: InsomniaExport = JSON.parse(content);

      // First pass: extract folders (request_group)
      const idMapping = new Map<string, string>(); // Map Insomnia IDs to stable IDs

      for (const resource of data.resources) {
        if (resource._type === "request_group") {
          // Determine parentId (remap if it exists)
          let parentId: string | null = null;
          if (resource.parentId && idMapping.has(resource.parentId)) {
            parentId = idMapping.get(resource.parentId) || null;
          }

          const folder = {
            name: resource.name || "Unnamed Folder",
            parentId,
            id: "", // Will be set below
          };
          folder.id = generateStableFolderId(folder);
          idMapping.set(resource._id, folder.id);

          folders.push(folder);
        }
      }

      // Second pass: extract requests
      for (const resource of data.resources) {
        if (resource._type !== "request") {
          continue;
        }

        const headers: Record<string, string> = {};
        if (resource.headers) {
          for (const h of resource.headers) {
            if (h.name && h.value) {
              headers[h.name] = h.value;
            }
          }
        }

        const request = {
          name: resource.name || "Unnamed Request",
          method: resource.method || "GET",
          url: resource.url || "",
          headers,
          body: resource.body?.text || null,
          folderId:
            resource.parentId && idMapping.has(resource.parentId)
              ? idMapping.get(resource.parentId) || null
              : null,
          createdAt: new Date().toISOString(),
          id: "", // Will be set below
        };
        request.id = generateStableRequestId(request);
        requests.push(request);
      }
    } catch (error) {
      console.error("Failed to parse Insomnia export:", error);
    }

    return { requests, folders };
  },

  export: (requests: ParsedRequest[]): string => {
    const data: InsomniaExport = {
      _type: "export",
      __export_format: 4,
      resources: requests.map((req, idx) => ({
        _id: `req_${idx}`,
        _type: "request",
        name: req.name,
        method: req.method,
        url: req.url,
        headers: Object.entries(req.headers).map(([name, value]) => ({
          name,
          value,
        })),
        body: req.body
          ? {
              mimeType: req.headers["Content-Type"] || "application/json",
              text: req.body,
            }
          : undefined,
      })),
    };

    return JSON.stringify(data, null, 2);
  },
};
