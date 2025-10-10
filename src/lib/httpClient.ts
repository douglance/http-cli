import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

export interface NetworkEvent {
  timestamp: number;
  type:
    | "dns_start"
    | "dns_end"
    | "tcp_start"
    | "tcp_connected"
    | "tls_start"
    | "tls_handshake"
    | "request_sent"
    | "response_headers"
    | "response_body"
    | "complete"
    | "error";
  data?: unknown;
}

export interface DetailedResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  events: NetworkEvent[];
  timings: {
    dnsLookup?: number;
    tcpConnection?: number;
    tlsHandshake?: number;
    firstByte?: number;
    total?: number;
  };
}

export async function fetchWithDetails(
  url: string,
  options: {
    method: string;
    headers: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
    onEvent?: (event: NetworkEvent) => void;
  }
): Promise<DetailedResponse> {
  const events: NetworkEvent[] = [];
  const timings: DetailedResponse["timings"] = {};
  const startTime = Date.now();

  const addEvent = (type: NetworkEvent["type"], data?: unknown) => {
    const event: NetworkEvent = {
      timestamp: Date.now() - startTime,
      type,
      data,
    };
    events.push(event);
    options.onEvent?.(event);
  };

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === "https:";
    const httpModule = isHttps ? https : http;

    let dnsStart: number;
    let tcpStart: number;
    let tlsStart: number;

    const requestOptions: http.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method,
      headers: options.headers,
      lookup: (hostname, opts, callback) => {
        dnsStart = Date.now();
        addEvent("dns_start", { hostname });

        // Use default DNS lookup
        dns.lookup(hostname, opts, (err, address, family) => {
          if (err) {
            callback(err as NodeJS.ErrnoException, address as string, family);
            return;
          }

          timings.dnsLookup = Date.now() - dnsStart;
          addEvent("dns_end", { address, family, duration: timings.dnsLookup });
          callback(err, address as string, family);
        });
      },
    };

    const req = httpModule.request(requestOptions, (res) => {
      timings.firstByte = Date.now() - startTime;
      addEvent("response_headers", {
        status: res.statusCode,
        statusMessage: res.statusMessage,
        headers: res.headers,
        duration: timings.firstByte,
      });

      let responseBody = "";

      res.on("data", (chunk) => {
        responseBody += chunk.toString();
        addEvent("response_body", { chunkSize: chunk.length });
      });

      res.on("end", () => {
        timings.total = Date.now() - startTime;
        addEvent("complete", { totalBytes: responseBody.length, duration: timings.total });

        const headers: Record<string, string> = {};
        Object.entries(res.headers).forEach(([key, value]) => {
          headers[key] = Array.isArray(value) ? value.join(", ") : value || "";
        });

        resolve({
          status: res.statusCode || 0,
          statusText: res.statusMessage || "",
          headers,
          body: responseBody,
          events,
          timings,
        });
      });
    });

    // Track socket events
    req.on("socket", (socket) => {
      tcpStart = Date.now();
      addEvent("tcp_start", { localAddress: socket.localAddress, localPort: socket.localPort });

      socket.on("lookup", () => {
        // DNS lookup completed (already tracked above)
      });

      socket.on("connect", () => {
        timings.tcpConnection = Date.now() - tcpStart;
        addEvent("tcp_connected", { duration: timings.tcpConnection });
      });

      if (isHttps) {
        tlsStart = Date.now();
        addEvent("tls_start");

        socket.on("secureConnect", () => {
          timings.tlsHandshake = Date.now() - tlsStart;
          const tlsSocket = socket as import("tls").TLSSocket;
          addEvent("tls_handshake", {
            protocol: tlsSocket.getProtocol?.(),
            cipher: tlsSocket.getCipher?.(),
            authorized: tlsSocket.authorized,
            duration: timings.tlsHandshake,
          });
        });
      }
    });

    req.on("error", (err) => {
      addEvent("error", { message: err.message, code: (err as NodeJS.ErrnoException).code });
      reject(err);
    });

    // Handle abort signal
    if (options.signal) {
      options.signal.addEventListener("abort", () => {
        req.destroy();
        addEvent("error", { message: "Request aborted" });
        reject(new Error("Request aborted"));
      });
    }

    // Send request body if present
    if (options.body) {
      req.write(options.body);
    }

    addEvent("request_sent", {
      method: options.method,
      url,
      headers: options.headers,
    });

    req.end();
  });
}
