// Binary response detection and encoding
// Handles binary content types per CLI-REQUIREMENTS.md section 13

/**
 * Check if Content-Type indicates binary content
 * Per requirements 13.1: image/*, application/pdf, application/zip, application/octet-stream
 */
export function isBinaryContentType(contentType: string | undefined): boolean {
  if (!contentType) {
    // If no Content-Type, assume text (safe default)
    return false;
  }

  const type = contentType.toLowerCase().split(";")[0]?.trim();

  if (!type) {
    return false;
  }

  // Binary types per requirements 13.1
  const binaryPatterns = [
    "image/",           // All image types
    "application/pdf",
    "application/zip",
    "application/gzip",
    "application/x-gzip",
    "application/x-tar",
    "application/octet-stream",
    "video/",           // All video types
    "audio/",           // All audio types
    "font/",            // Font files
    "application/vnd.", // Vendor-specific binary formats
  ];

  return binaryPatterns.some((pattern) => type.startsWith(pattern));
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    const kb = (bytes / 1024).toFixed(1);
    return `${kb} KB`;
  }

  const mb = (bytes / (1024 * 1024)).toFixed(1);
  return `${mb} MB`;
}

/**
 * Process binary response body
 * Returns object with description and base64-encoded data
 */
export function processBinaryResponse(
  bodyBuffer: Buffer,
  contentType: string
): {
  body: string;
  binaryData: string;
  bodySize: number;
} {
  const size = bodyBuffer.length;
  const sizeStr = formatFileSize(size);

  // Create human-readable description (requirements 13.2)
  const description = `[Binary data: ${sizeStr}, ${contentType}, base64-encoded]`;

  // Encode binary data as base64 (requirements 13.2)
  const base64 = bodyBuffer.toString("base64");

  return {
    body: description,
    binaryData: base64,
    bodySize: size,
  };
}
