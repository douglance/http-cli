// Dual-layer variable storage: in-memory (session) + persistent (.env)
// Layered resolution: memory > persistent > undefined

export interface VariableStore {
  setMemory(key: string, value: string): void;
  getMemory(key: string): string | undefined;
  setPersistent(key: string, value: string): Promise<void>;
  getPersistent(key: string): string | undefined;
  get(key: string): string | undefined;
  has(key: string): boolean;
  clearMemory(): void;
  getAll(): Record<string, string>;
}

export interface VariableStoreOptions {
  envWriter?: (key: string, value: string) => Promise<void> | void;
  envData?: Record<string, string>; // Initial persistent data
}

/**
 * Create variable store with dual-layer storage
 * @param options Optional envWriter for persistent storage
 * @returns VariableStore instance
 */
export function createVariableStore(options: VariableStoreOptions = {}): VariableStore {
  const memoryStore = new Map<string, string>();
  const persistentStore = new Map<string, string>();

  // Load initial persistent data if provided
  if (options.envData) {
    for (const [key, value] of Object.entries(options.envData)) {
      persistentStore.set(key, value);
    }
  }

  /**
   * Sanitize key by removing special characters
   */
  function sanitizeKey(key: string): string {
    return key.replace(/[\n\r]/g, "");
  }

  return {
    setMemory(key: string, value: string): void {
      memoryStore.set(key, value);
    },

    getMemory(key: string): string | undefined {
      return memoryStore.get(key);
    },

    async setPersistent(key: string, value: string): Promise<void> {
      const sanitized = sanitizeKey(key);
      persistentStore.set(sanitized, value);

      if (options.envWriter) {
        await options.envWriter(sanitized, value);
      }
    },

    getPersistent(key: string): string | undefined {
      return persistentStore.get(key);
    },

    get(key: string): string | undefined {
      // Layered resolution: memory > persistent > undefined
      const memoryValue = memoryStore.get(key);
      if (memoryValue !== undefined) {
        return memoryValue;
      }

      const persistentValue = persistentStore.get(key);
      if (persistentValue !== undefined) {
        return persistentValue;
      }

      return undefined;
    },

    has(key: string): boolean {
      return memoryStore.has(key) || persistentStore.has(key);
    },

    clearMemory(): void {
      memoryStore.clear();
    },

    getAll(): Record<string, string> {
      // Merge persistent and memory, with memory taking precedence
      const result: Record<string, string> = {};

      // First add persistent vars
      for (const [key, value] of persistentStore.entries()) {
        result[key] = value;
      }

      // Then overlay memory vars (overwrite if exists)
      for (const [key, value] of memoryStore.entries()) {
        result[key] = value;
      }

      return result;
    },
  };
}
