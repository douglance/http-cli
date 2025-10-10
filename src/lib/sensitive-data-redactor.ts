// Sensitive data redaction for JSON output
// Redacts Authorization headers and sensitive query parameters per CLI-REQUIREMENTS.md section 12.1
// IMPORTANT: Redaction only affects JSON output, NOT actual HTTP requests

/**
 * Extract meaningful prefix from token
 * For "sk-xxx" show "sk-"
 * For "sk_live_51234..." show "sk_live_51"
 * For "test-token-xxx" show "test-"
 * For "dXNlcm5hbWU..." show "dX"
 */
function extractTokenPrefix(credentials: string): string {
  // Check for tokens with underscores (e.g., "sk_live_51234...")
  // Match pattern: word_word_digits (show up to and including second underscore + first 2 chars)
  const underscoreMatch = credentials.match(/^([^_]+_[^_]+_\d{0,2})/);
  if (underscoreMatch?.[1]) {
    return underscoreMatch[1];
  }

  // Check for tokens with hyphens (e.g., "test-token-xxx" or "sk-xxx")
  // Match pattern: show up to and including first hyphen
  const hyphenMatch = credentials.match(/^([^-]+)-/);
  if (hyphenMatch?.[1]) {
    return `${hyphenMatch[1]}-`;
  }

  // Default: show first 2 characters
  return credentials.slice(0, Math.min(2, credentials.length));
}

/**
 * Redact Authorization header value
 * Shows only prefix (e.g., "Bearer sk-..." or "Basic dX...")
 */
export function redactAuthorizationHeader(value: string): string {
  // Extract prefix and first few characters
  const parts = value.split(" ");

  if (parts.length >= 2) {
    const scheme = parts[0]; // "Bearer", "Basic", etc.
    const credentials = parts.slice(1).join(" ");

    const prefix = extractTokenPrefix(credentials);
    return `${scheme} ${prefix}...`;
  }

  // Single token without scheme
  if (value.length > 3) {
    const prefix = extractTokenPrefix(value);
    return `${prefix}...`;
  }

  return value;
}

/**
 * Check if header name indicates sensitive data
 * Case-insensitive matching for common auth header names
 */
function isSensitiveHeader(headerName: string): boolean {
  const name = headerName.toLowerCase();
  return (
    name === "authorization" ||
    name === "x-api-key" ||
    name === "api-key" ||
    name === "x-auth-token" ||
    name === "auth-token"
  );
}

/**
 * Redact sensitive headers in headers object
 * Returns new object with redacted values
 */
export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const redacted: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (isSensitiveHeader(key)) {
      redacted[key] = redactAuthorizationHeader(value);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Check if query parameter name indicates sensitive data
 * Case-insensitive matching for: token, key, secret, password
 */
function isSensitiveQueryParam(paramName: string): boolean {
  const name = paramName.toLowerCase();
  return (
    name.includes("token") ||
    name.includes("key") ||
    name.includes("secret") ||
    name.includes("password")
  );
}

/**
 * Redact sensitive query parameters in URL
 * Returns new URL with sensitive values replaced with "***"
 */
export function redactUrlQueryParams(url: string): string {
  try {
    const urlObj = new URL(url);

    // Iterate through query parameters
    for (const [key] of urlObj.searchParams.entries()) {
      if (isSensitiveQueryParam(key)) {
        urlObj.searchParams.set(key, "***");
      }
    }

    return urlObj.toString();
  } catch {
    // If URL parsing fails, return original
    return url;
  }
}

/**
 * Redact all sensitive data in request for JSON output
 * Returns redacted copies, does NOT modify originals
 */
export function redactRequestForOutput(
  url: string,
  headers: Record<string, string>
): {
  url: string;
  headers: Record<string, string>;
} {
  return {
    url: redactUrlQueryParams(url),
    headers: redactHeaders(headers),
  };
}
