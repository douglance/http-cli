import http from "node:http";
import https from "node:https";
import type { Transform } from "node:stream";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import { isBinaryContent } from "./binary.js";

export interface TransportOptions {
  method: string;
  headers: Record<string, string>;
  body?: string;
  followRedirects?: boolean;
  maxRedirects?: number;
  signal?: AbortSignal;
}

export interface TransportResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string | Buffer;
  redirectCount?: number;
  finalUrl?: string;
}

export async function fetchWithTransport(
  url: string,
  options: TransportOptions,
  visitedUrls: Set<string> = new Set(),
  redirectCount = 0
): Promise<TransportResponse> {
  const maxRedirects = options.maxRedirects ?? 5;
  const followRedirects = options.followRedirects ?? true;

  // Check redirect loop
  if (visitedUrls.has(url)) {
    throw new Error("Redirect loop detected");
  }

  if (redirectCount >= maxRedirects) {
    // Return current response instead of throwing
    return makeRequest(url, options, redirectCount, url);
  }

  visitedUrls.add(url);

  const response = await makeRequest(url, options, redirectCount, url);

  // Handle redirects
  if (followRedirects && response.status >= 300 && response.status < 400) {
    const location = response.headers.location || response.headers.Location;

    if (!location) {
      return response;
    }

    // Resolve relative/absolute redirect URL
    const nextUrl = new URL(location, url).toString();

    // 303: Always use GET
    let nextMethod = options.method;
    if (response.status === 303 && options.method !== "GET" && options.method !== "HEAD") {
      nextMethod = "GET";
    }

    // Follow redirect
    return fetchWithTransport(
      nextUrl,
      {
        ...options,
        method: nextMethod,
      },
      visitedUrls,
      redirectCount + 1
    );
  }

  return response;
}

function makeRequest(
  url: string,
  options: TransportOptions,
  redirectCount: number,
  finalUrl: string
): Promise<TransportResponse> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === "https:";
    const httpModule = isHttps ? https : http;

    const requestOptions: http.RequestOptions = {
      method: options.method,
      headers: options.headers,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      signal: options.signal,
    };

    const req = httpModule.request(requestOptions, (res) => {
      const status = res.statusCode || 0;
      const statusText = res.statusMessage || "";

      // Normalize headers
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(res.headers)) {
        headers[key] = Array.isArray(value) ? value.join(", ") : value || "";
      }

      // Create decompression stream if needed
      let stream: NodeJS.ReadableStream = res;
      const encoding = headers["content-encoding"] || headers["Content-Encoding"];

      if (encoding) {
        stream = createDecompressionStream(res, encoding);
      }

      // Detect if binary based on Content-Type
      const isBinary = isBinaryContent(headers);

      // Accumulate chunks
      const chunks: Buffer[] = [];

      stream.on("data", (chunk: Buffer) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });

      stream.on("end", () => {
        const fullBuffer = Buffer.concat(chunks);
        const body = isBinary ? fullBuffer : fullBuffer.toString("utf8");

        resolve({
          status,
          statusText,
          headers,
          body,
          redirectCount: redirectCount > 0 ? redirectCount : undefined,
          finalUrl: redirectCount > 0 ? finalUrl : undefined,
        });
      });

      stream.on("error", (err) => {
        reject(err);
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

function createDecompressionStream(
  res: http.IncomingMessage,
  encoding: string
): Transform | http.IncomingMessage {
  const encodingLower = encoding.toLowerCase().trim();

  switch (encodingLower) {
    case "gzip":
    case "x-gzip":
      return res.pipe(createGunzip());
    case "br":
      return res.pipe(createBrotliDecompress());
    case "deflate":
      return res.pipe(createInflate());
    default:
      return res;
  }
}
