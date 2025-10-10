// Common types for all parsers
export interface ParsedRequest {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
  folderId: string | null;
  createdAt: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
}

export interface ParseResult {
  requests: ParsedRequest[];
  folders: Folder[];
}

export interface Parser {
  name: string;
  detect: (content: string) => boolean;
  parse: (content: string) => ParseResult;
  export: (requests: ParsedRequest[], folders?: Folder[]) => string;
}

export type SupportedFormat = "http" | "postman" | "insomnia" | "thunder" | "har";
