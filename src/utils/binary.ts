const BINARY_CONTENT_TYPES = [
  "image/",
  "video/",
  "audio/",
  "application/octet-stream",
  "application/pdf",
  "application/zip",
  "application/gzip",
  "application/x-tar",
  "font/",
];

const TEXT_CONTENT_TYPES = [
  "text/",
  "application/json",
  "application/xml",
  "application/javascript",
  "application/x-www-form-urlencoded",
];

export function isBinaryContent(headers: Record<string, string>): boolean {
  const contentType = headers["Content-Type"] || headers["content-type"];

  if (!contentType) {
    // No Content-Type header - assume binary (safer default)
    return true;
  }

  // Remove charset and other parameters for comparison
  const baseType = contentType.split(";")[0]?.trim().toLowerCase() || "";

  // Check if it's a known text type
  if (TEXT_CONTENT_TYPES.some((prefix) => baseType.startsWith(prefix))) {
    return false;
  }

  // Check if it's a known binary type
  if (BINARY_CONTENT_TYPES.some((prefix) => baseType.startsWith(prefix))) {
    return true;
  }

  // Unknown type - assume binary (safer default)
  return true;
}

export function isBinaryContentByBuffer(buffer: Buffer, sampleSize = 512): boolean {
  const sample = buffer.slice(0, Math.min(sampleSize, buffer.length));

  if (sample.length === 0) {
    return false;
  }

  let nullBytes = 0;
  let highBytes = 0; // Bytes > 0x7F
  let controlBytes = 0; // Bytes < 0x20 (except tab/newline/CR)

  for (let i = 0; i < sample.length; i++) {
    const byte = sample[i];

    if (byte === undefined) {
      continue;
    }

    if (byte === 0x00) {
      nullBytes++;
    }

    if (byte > 0x7f) {
      highBytes++;
    }

    if (byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d) {
      controlBytes++;
    }
  }

  // Significant null bytes (> 1%) = definitely binary
  if (nullBytes > sample.length * 0.01) {
    return true;
  }

  // High concentration of non-ASCII bytes (> 30%) = likely binary
  if (highBytes > sample.length * 0.3) {
    return true;
  }

  // High concentration of control characters (> 10%) = likely binary
  if (controlBytes > sample.length * 0.1) {
    return true;
  }

  return false;
}

export function accumulateBuffers(chunks: Buffer[]): Buffer {
  if (chunks.length === 0) {
    return Buffer.alloc(0);
  }

  return Buffer.concat(chunks);
}
