// IntelliJ HTTP Client-compatible API implementation
// Provides client.global and client.environment APIs

import type { VariableStore } from "../stores/variableStore.js";
import type { ClientAPI, EnvironmentVariableAPI, GlobalVariableAPI, ResponseAPI } from "./types.js";

/**
 * Implementation of global variable storage (in-memory)
 * IntelliJ-compatible: variables lost on process exit
 */
export class GlobalVariableStore implements GlobalVariableAPI {
  private vars = new Map<string, unknown>();

  set(name: string, value: string): void {
    this.vars.set(name, value);
  }

  get(name: string): string | undefined | null {
    const val = this.vars.get(name);
    return val === null ? null : (val as string | undefined);
  }

  clear(name?: string): void {
    if (name) {
      this.vars.delete(name);
    } else {
      this.vars.clear();
    }
  }

  isEmpty(): boolean {
    return this.vars.size === 0;
  }

  getAllVars(): Record<string, string> {
    return Object.fromEntries(this.vars) as Record<string, string>;
  }
}

/**
 * Implementation of environment variable storage (persistent to .env)
 * CLI extension: writes to .env file
 */
export class EnvironmentVariableStore implements EnvironmentVariableAPI {
  private vars = new Map<string, string>();

  set(name: string, value: string): void {
    this.vars.set(name, String(value));
  }

  get(name: string): string | undefined {
    return this.vars.get(name);
  }

  getAllVars(): Record<string, string> {
    return Object.fromEntries(this.vars) as Record<string, string>;
  }
}

/**
 * Main ClientAPI implementation
 * Provides IntelliJ-compatible interface with CLI extensions
 */
export class ClientAPIImpl implements ClientAPI {
  global: GlobalVariableAPI;
  environment: EnvironmentVariableAPI;

  constructor(globalStore?: GlobalVariableStore, environmentStore?: EnvironmentVariableStore) {
    this.global = globalStore || new GlobalVariableStore();
    this.environment = environmentStore || new EnvironmentVariableStore();
  }

  test(name: string, fn: () => void): void {
    try {
      fn();
      console.log(`✅ Test "${name}" passed`);
    } catch (error) {
      console.error(`❌ Test "${name}" failed:`, error);
    }
  }

  getUpdatedVars(): {
    global: Record<string, string>;
    environment: Record<string, string>;
  } {
    return {
      global: (this.global as GlobalVariableStore).getAllVars(),
      environment: (this.environment as EnvironmentVariableStore).getAllVars(),
    };
  }
}

/**
 * Factory function to create ClientAPI and ResponseAPI instances
 * Used for testing and execution
 */
export function createClientAPI(config: {
  response: { status: number; headers: Record<string, string>; body: string };
  envStore?: Map<string, string>;
  store?: VariableStore;
}): { client: ClientAPI; response: ResponseAPI } {
  // If VariableStore provided, wire it to client APIs
  if (config.store) {
    const globalStore: GlobalVariableAPI = {
      set: (name: string, value: string) => config.store?.setMemory(name, String(value)),
      get: (name: string) => config.store?.getMemory(name),
      clear: (name?: string) => {
        if (name) {
          // Not supported by VariableStore interface
        } else {
          config.store?.clearMemory();
        }
      },
      isEmpty: () => false, // Not tracked by VariableStore
    };

    const environmentStore: EnvironmentVariableAPI = {
      set: (name: string, value: string) => {
        void config.store?.setPersistent(name, String(value));
      },
      get: (name: string) => config.store?.getPersistent(name),
    };

    const clientImpl = new ClientAPIImpl(
      globalStore as GlobalVariableStore,
      environmentStore as EnvironmentVariableStore
    );

    const responseImpl: ResponseAPI = {
      body: {
        json: () => JSON.parse(config.response.body),
        text: () => config.response.body,
      },
      headers: {
        get: (name) => config.response.headers[name] ?? undefined,
        valuesOf: (name) => [config.response.headers[name] || ""],
      },
      status: config.response.status,
      contentType: {
        mimeType: config.response.headers["content-type"] || "text/plain",
      },
    };

    return { client: clientImpl, response: responseImpl };
  }

  // Legacy path: use internal stores
  const environmentStore = new EnvironmentVariableStore();

  if (config.envStore) {
    const originalSet = environmentStore.set.bind(environmentStore);
    const envStore = config.envStore;
    environmentStore.set = (name: string, value: string): void => {
      originalSet(name, value);
      envStore.set(name, value);
    };
  }

  const clientImpl = new ClientAPIImpl(undefined, environmentStore);

  const responseImpl: ResponseAPI = {
    body: {
      json: () => JSON.parse(config.response.body),
      text: () => config.response.body,
    },
    headers: {
      get: (name) => config.response.headers[name] ?? undefined,
      valuesOf: (name) => [config.response.headers[name] || ""],
    },
    status: config.response.status,
    contentType: {
      mimeType: config.response.headers["content-type"] || "text/plain",
    },
  };

  return { client: clientImpl, response: responseImpl };
}
