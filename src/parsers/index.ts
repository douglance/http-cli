import { harParser } from "./har-parser.js";
import { httpParser } from "./http-parser.js";
import { insomniaParser } from "./insomnia-parser.js";
import { postmanParser } from "./postman-parser.js";
import { thunderParser } from "./thunder-parser.js";
import type { Folder, ParsedRequest, ParseResult, Parser, SupportedFormat } from "./types.js";

export * from "./types.js";

// All available parsers
export const parsers: Parser[] = [
  httpParser,
  postmanParser,
  insomniaParser,
  thunderParser,
  harParser,
];

/**
 * Auto-detect format and parse content
 */
export function parseRequests(content: string): ParseResult {
  // Check if content is empty or whitespace
  if (!content || !content.trim()) {
    throw new Error(
      "Cannot parse empty file. Add at least one HTTP request.\n\nExample:\n### My Request\nGET https://api.example.com"
    );
  }

  for (const parser of parsers) {
    if (parser.detect(content)) {
      try {
        return parser.parse(content);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        throw new Error(
          `Failed to parse ${parser.name} format: ${message}\n\nPlease check your file syntax.`
        );
      }
    }
  }

  // Provide helpful error message with format hints
  const hasHttpMethod = /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/i.test(content);
  const hasUrl = /https?:\/\//i.test(content);

  let hint = "";
  if (!hasHttpMethod && !hasUrl) {
    hint =
      '\n\nYour file appears to be missing HTTP methods (GET, POST, etc.) and URLs.\nExample format:\n\n### My Request\nGET https://api.example.com\nContent-Type: application/json\n\n{"key": "value"}';
  } else if (!hasHttpMethod) {
    hint =
      "\n\nYour file has URLs but no HTTP methods.\nMake sure each request starts with a method:\nGET https://api.example.com";
  } else if (!hasUrl) {
    hint =
      "\n\nYour file has HTTP methods but no valid URLs.\nMake sure URLs start with http:// or https://";
  } else {
    hint =
      "\n\nYour file syntax doesn't match any supported format.\nSupported formats: .http/.rest files, Postman, Insomnia, Thunder Client, HAR\n\nFor .http files, use this format:\n### Request Name\nGET https://api.example.com\nHeader: Value";
  }

  throw new Error(`Unable to parse request file format.${hint}`);
}

/**
 * Export requests to specific format
 */
export function exportRequests(
  requests: ParsedRequest[],
  format: SupportedFormat,
  folders?: Folder[]
): string {
  const parserMap: Record<SupportedFormat, Parser> = {
    http: httpParser,
    postman: postmanParser,
    insomnia: insomniaParser,
    thunder: thunderParser,
    har: harParser,
  };

  const parser = parserMap[format];
  if (!parser) {
    throw new Error(`Unknown export format: ${format}`);
  }

  return parser.export(requests, folders);
}
