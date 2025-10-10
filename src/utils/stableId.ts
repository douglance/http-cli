import { createHash } from "node:crypto";

export function generateStableRequestId(req: {
  name: string;
  method: string;
  url: string;
  folderId: string | null;
}): string {
  // Hash semantic content (excludes headers/body for better stability)
  const content = `${req.name}|${req.method}|${req.url}|${req.folderId || ""}`;
  const hash = createHash("sha256").update(content).digest("hex").slice(0, 16);
  return `req_${hash}`;
}

export function generateStableFolderId(folder: { name: string; parentId: string | null }): string {
  const content = `${folder.name}|${folder.parentId || ""}`;
  const hash = createHash("sha256").update(content).digest("hex").slice(0, 16);
  return `fld_${hash}`;
}

export function generateLineKey(line: string, index: number): string {
  if (line.trim().length === 0) {
    return `empty_${index}`;
  }
  const hash = createHash("sha256").update(`${line}_${index}`).digest("hex").slice(0, 12);
  return `line_${hash}`;
}
