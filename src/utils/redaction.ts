export interface RedactionConfig {
  patterns?: string[];
  headers?: Record<string, string>;
  body?: string | Record<string, unknown>;
  url?: string;
}

export interface RedactedData {
  headers?: Record<string, string>;
  body?: string | Record<string, unknown>;
  url?: string;
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[-_]/g, "");
}

export function redactHeaders(
  headers: Record<string, string>,
  patterns: string[]
): Record<string, string> {
  if (!patterns || patterns.length === 0) {
    return { ...headers };
  }

  const result: Record<string, string> = {};
  const normalizedPatterns = patterns.map((p) => normalizeKey(p));

  for (const [key, value] of Object.entries(headers)) {
    const normalizedKey = normalizeKey(key);
    const matches = normalizedPatterns.some((pattern) => normalizedKey.includes(pattern));

    if (matches) {
      if (value.startsWith("Bearer ")) {
        result[key] = "Bearer ****";
      } else {
        result[key] = "****";
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}

export function redactJsonBody(
  body: string | Record<string, unknown>,
  patterns: string[]
): string | Record<string, unknown> {
  if (!patterns || patterns.length === 0) {
    return body;
  }

  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      const redacted = redactObject(parsed, patterns, 0);
      return JSON.stringify(redacted);
    } catch {
      return body;
    }
  }

  return redactObject(body, patterns, 0) as Record<string, unknown>;
}

function redactObject(obj: unknown, patterns: string[], depth: number): unknown {
  if (depth >= 10) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactObject(item, patterns, depth + 1));
  }

  if (typeof obj !== "object" || obj === null) {
    return obj;
  }

  const result: Record<string, unknown> = {};
  const normalizedPatterns = patterns.map((p) => normalizeKey(p));

  for (const [key, value] of Object.entries(obj)) {
    const normalizedKey = normalizeKey(key);
    const matches = normalizedPatterns.some((pattern) => normalizedKey.includes(pattern));

    if (matches) {
      result[key] = "****";
    } else if (typeof value === "object" && value !== null) {
      result[key] = redactObject(value, patterns, depth + 1);
    } else {
      result[key] = value;
    }
  }

  return result;
}

export function redactUrl(url: string, patterns: string[]): string {
  if (!patterns || patterns.length === 0) {
    return url;
  }

  try {
    const parsed = new URL(url);

    // Redact userinfo (username:password@)
    if (parsed.username || parsed.password) {
      parsed.username = "";
      parsed.password = "";
    }

    const params = parsed.searchParams;
    const normalizedPatterns = patterns.map((p) => normalizeKey(p));

    for (const [key] of params) {
      const normalizedKey = normalizeKey(key);
      const matches = normalizedPatterns.some((pattern) => normalizedKey.includes(pattern));

      if (matches) {
        params.set(key, "****");
      }
    }

    return parsed.toString();
  } catch {
    return url;
  }
}

export function redactRequest(config: RedactionConfig): RedactedData {
  const patterns = config.patterns || [];
  const result: RedactedData = {};

  if (config.headers) {
    result.headers = redactHeaders(config.headers, patterns);
  }

  if (config.body !== undefined) {
    result.body = redactJsonBody(config.body, patterns);
  }

  if (config.url) {
    result.url = redactUrl(config.url, patterns);
  }

  return result;
}
