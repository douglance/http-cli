import { existsSync, readdirSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { exportRequests, type Folder, parseRequests } from "../parsers/index.js";

export interface SavedRequest {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
  folderId: string | null;
  createdAt: string;
}

export interface StorageData {
  requests: SavedRequest[];
  folders: Folder[];
  settings: {
    proxyPort: number;
  };
  version: string;
}

export type { Folder };

const DEFAULT_DATA: StorageData = {
  requests: [
    {
      id: "req_1",
      name: "Get Users",
      method: "GET",
      url: "https://jsonplaceholder.typicode.com/users",
      headers: {
        Accept: "application/json",
      },
      body: null,
      folderId: null,
      createdAt: new Date().toISOString(),
    },
    {
      id: "req_2",
      name: "Get Single Post",
      method: "GET",
      url: "https://jsonplaceholder.typicode.com/posts/1",
      headers: {
        Accept: "application/json",
      },
      body: null,
      folderId: null,
      createdAt: new Date().toISOString(),
    },
    {
      id: "req_3",
      name: "Create Post",
      method: "POST",
      url: "https://jsonplaceholder.typicode.com/posts",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(
        {
          title: "Test Post",
          body: "This is a test post",
          userId: 1,
        },
        null,
        2
      ),
      folderId: null,
      createdAt: new Date().toISOString(),
    },
    {
      id: "req_4",
      name: "HTTPBin GET",
      method: "GET",
      url: "https://httpbin.org/get?test=value",
      headers: {
        Accept: "application/json",
        "User-Agent": "HTTP-Inspector/1.0",
      },
      body: null,
      folderId: null,
      createdAt: new Date().toISOString(),
    },
    {
      id: "req_5",
      name: "HTTPBin POST",
      method: "POST",
      url: "https://httpbin.org/post",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(
        {
          message: "Hello from HTTP Inspector",
          timestamp: new Date().toISOString(),
        },
        null,
        2
      ),
      folderId: null,
      createdAt: new Date().toISOString(),
    },
    {
      id: "req_6",
      name: "ENV Vars Test",
      method: "POST",
      url: "{{API_BASE_URL}}/users/{{USER_ID}}",
      headers: {
        "Content-Type": "{{CONTENT_TYPE}}",
        Authorization: "Bearer {{AUTH_TOKEN}}",
        "User-Agent": "{{USER_AGENT}}",
      },
      body: JSON.stringify(
        {
          apiKey: "{{API_KEY}}",
          secret: "{{API_SECRET}}",
          userId: "{{USER_ID}}",
        },
        null,
        2
      ),
      folderId: null,
      createdAt: new Date().toISOString(),
    },
  ],
  folders: [],
  settings: {
    proxyPort: 8888,
  },
  version: "1.0.0",
};

export class FileStorage {
  private httpPath: string;
  private jsonPath: string;
  private data: StorageData | null = null;

  constructor(customPath?: string) {
    if (customPath) {
      // User specified a file
      const absolutePath = path.isAbsolute(customPath)
        ? customPath
        : path.join(process.cwd(), customPath);
      this.httpPath = absolutePath;
      this.jsonPath = absolutePath.replace(/\.(http|rest)$/, ".json");
    } else {
      // Auto-detect: look in CWD first, fallback to ~/.http-inspector
      this.httpPath = this.findRequestsFile();
      this.jsonPath = this.httpPath.replace(/\.(http|rest)$/, ".json");
    }
  }

  /**
   * Find requests file in this order:
   * 1. CWD/requests.http
   * 2. CWD/requests.rest
   * 3. CWD/*.http (first match)
   * 4. CWD/*.rest (first match)
   * 5. ~/.http-inspector/requests.http (fallback)
   */
  private findRequestsFile(): string {
    const cwd = process.cwd();
    const homeDir = os.homedir();
    const configDir = path.join(homeDir, ".http-inspector");

    // Check CWD for common names
    const cwdCandidates = [
      path.join(cwd, "requests.http"),
      path.join(cwd, "requests.rest"),
      path.join(cwd, "api.http"),
      path.join(cwd, "api.rest"),
    ];

    for (const candidate of cwdCandidates) {
      try {
        if (existsSync(candidate)) {
          return candidate;
        }
      } catch {
        // Ignore and continue
      }
    }

    // Look for any .http or .rest file in CWD
    try {
      const files = readdirSync(cwd);
      const httpFile = files.find((f) => f.endsWith(".http") || f.endsWith(".rest"));
      if (httpFile) {
        return path.join(cwd, httpFile);
      }
    } catch {
      // Ignore and fallback
    }

    // Fallback to ~/.http-inspector/requests.http
    return path.join(configDir, "requests.http");
  }

  async ensureFile(): Promise<void> {
    const dir = path.dirname(this.httpPath);
    await fs.mkdir(dir, { recursive: true });

    // Check if .http file exists
    try {
      await fs.access(this.httpPath);
      return; // .http file exists, we're good
    } catch {
      // .http doesn't exist, check for old .json file
      try {
        await fs.access(this.jsonPath);
        // Migrate from .json to .http
        console.log("Migrating from JSON to HTTP format...");
        try {
          const jsonContent = await fs.readFile(this.jsonPath, "utf-8");
          const jsonData: StorageData = JSON.parse(jsonContent);
          const httpContent = exportRequests(jsonData.requests, "http", jsonData.folders || []);
          await fs.writeFile(this.httpPath, httpContent, "utf-8");
          console.log("Migration complete! Using .http format now.");
          return;
        } catch (parseError) {
          const message = parseError instanceof Error ? parseError.message : "Unknown error";
          throw new Error(
            `Failed to migrate from JSON format at ${this.jsonPath}:\n${message}\n\nThe JSON file may be corrupted. Delete it or fix the syntax.`
          );
        }
      } catch {
        // Neither file exists, create new .http file with defaults
        const httpContent = exportRequests(DEFAULT_DATA.requests, "http", DEFAULT_DATA.folders);
        await fs.writeFile(this.httpPath, httpContent, "utf-8");
      }
    }
  }

  async load(): Promise<StorageData> {
    await this.ensureFile();

    try {
      const content = await fs.readFile(this.httpPath, "utf-8");
      const { requests, folders } = parseRequests(content);

      this.data = {
        requests,
        folders,
        settings: {
          proxyPort: 8888,
        },
        version: "1.0.0",
      };

      if (!this.data) {
        throw new Error("Failed to initialize storage data");
      }
      return this.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to load requests from ${this.httpPath}:\n\n${message}`);
    }
  }

  async save(data: StorageData): Promise<void> {
    this.data = data;
    const httpContent = exportRequests(data.requests, "http", data.folders);
    await fs.writeFile(this.httpPath, httpContent, "utf-8");
  }

  async updateRequests(requests: SavedRequest[]): Promise<void> {
    if (!this.data) {
      await this.load();
    }
    if (!this.data) {
      throw new Error("Storage data not available");
    }
    this.data.requests = requests;
    await this.save(this.data);
  }

  async addRequest(request: SavedRequest): Promise<void> {
    if (!this.data) {
      await this.load();
    }
    if (!this.data) {
      throw new Error("Storage data not available");
    }
    this.data.requests.push(request);
    await this.save(this.data);
  }

  async deleteRequest(id: string): Promise<void> {
    if (!this.data) {
      await this.load();
    }
    if (!this.data) {
      throw new Error("Storage data not available");
    }
    this.data.requests = this.data.requests.filter((r) => r.id !== id);
    await this.save(this.data);
  }

  getFilePath(): string {
    return this.httpPath;
  }

  getData(): StorageData | null {
    return this.data;
  }
}

// Default singleton instance (will be overridden if custom path provided)
let storageInstance: FileStorage | null = null;

export function getStorage(customPath?: string): FileStorage {
  if (!storageInstance || customPath) {
    storageInstance = new FileStorage(customPath);
  }
  return storageInstance;
}

// For backward compatibility
export const storage = {
  get instance() {
    return getStorage();
  },
  load: async () => getStorage().load(),
  save: async (data: StorageData) => getStorage().save(data),
  updateRequests: async (requests: SavedRequest[]) => getStorage().updateRequests(requests),
  addRequest: async (request: SavedRequest) => getStorage().addRequest(request),
  deleteRequest: async (id: string) => getStorage().deleteRequest(id),
  getFilePath: () => getStorage().getFilePath(),
  getData: () => getStorage().getData(),
};
