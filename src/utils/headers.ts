export interface RequestConfig {
  method: string;
  headers: Record<string, string>;
  body?: string;
}

export interface PreparedRequest {
  method: string;
  headers: Record<string, string>;
  body?: string;
}

function hasHeaderCaseInsensitive(headers: Record<string, string>, key: string): boolean {
  const lowerKey = key.toLowerCase();
  return Object.keys(headers).some((k) => k.toLowerCase() === lowerKey);
}

export function prepareRequestHeaders(config: RequestConfig): PreparedRequest {
  const result: PreparedRequest = {
    method: config.method,
    headers: { ...config.headers },
    body: config.body,
  };

  // Add Content-Type if body is non-empty and user didn't specify
  if (config.body && config.body.trim().length > 0) {
    if (!hasHeaderCaseInsensitive(result.headers, "Content-Type")) {
      result.headers["Content-Type"] = "application/json";
    }
  }

  // Add Accept if user didn't specify
  if (!hasHeaderCaseInsensitive(result.headers, "Accept")) {
    result.headers.Accept = "application/json";
  }

  return result;
}
