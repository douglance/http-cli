import { existsSync, type FSWatcher, readdirSync, watch } from "node:fs";
import { join } from "node:path";
import { useEnvStore } from "../stores/envStore.js";
import { logInfo } from "../utils/renderDebug.js";

const watchers: FSWatcher[] = [];
let reloadTimeout: NodeJS.Timeout | null = null;

export function startWatchingEnvFiles() {
  // Stop any existing watchers first
  stopWatchingEnvFiles();

  const cwd = process.cwd();
  const files = readdirSync(cwd);
  const envFiles = files.filter((f) => f.startsWith(".env") && f !== ".env.example");

  if (envFiles.length === 0) {
    logInfo("No .env files found to watch");
    return;
  }

  logInfo(`Watching ${envFiles.length} env file(s): ${envFiles.join(", ")}`);

  envFiles.forEach((fileName) => {
    const envPath = join(cwd, fileName);
    if (existsSync(envPath)) {
      try {
        const watcher = watch(envPath, (eventType) => {
          if (eventType === "rename" || eventType === "change") {
            // Debounce rapid changes
            if (reloadTimeout) {
              clearTimeout(reloadTimeout);
            }

            reloadTimeout = setTimeout(() => {
              useEnvStore.getState().loadEnv();
            }, 300);
          }
        });

        watchers.push(watcher);
      } catch (error) {
        console.error(`Could not watch ${fileName}:`, error);
      }
    }
  });
}

export function stopWatchingEnvFiles() {
  if (reloadTimeout) {
    clearTimeout(reloadTimeout);
    reloadTimeout = null;
  }

  watchers.forEach((watcher) => {
    try {
      watcher.close();
    } catch (_err) {
      // Ignore close errors
    }
  });

  watchers.length = 0; // Clear array
}
