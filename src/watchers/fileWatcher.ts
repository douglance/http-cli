import { type FSWatcher, watch } from "node:fs";
import { useSavedRequestsStore } from "../stores/savedRequestsStore.js";
import { getStorage } from "../stores/storage.js";
import { logInfo } from "../utils/renderDebug.js";

let activeWatcher: FSWatcher | null = null;
let watchedPath: string | null = null;
let reloadTimeout: NodeJS.Timeout | null = null;

export function startWatchingFile(filePath: string) {
  // If already watching this path, do nothing
  if (watchedPath === filePath && activeWatcher) {
    return;
  }

  // Stop any existing watcher
  stopWatchingFile();

  watchedPath = filePath;

  // Validate file type
  const supportedExtensions = [".http", ".rest", ".json"];
  const isSupported = supportedExtensions.some((ext) => filePath.endsWith(ext));
  if (!isSupported) {
    logInfo(`Warning: Watching unsupported file type: ${filePath}`);
  }

  logInfo(`Watching requests file: ${filePath}`);

  try {
    activeWatcher = watch(filePath, (eventType) => {
      if (eventType === "rename" || eventType === "change") {
        // Debounce rapid changes (editors often write multiple times)
        if (reloadTimeout) {
          clearTimeout(reloadTimeout);
        }

        reloadTimeout = setTimeout(async () => {
          try {
            const storage = getStorage(filePath);
            const data = await storage.load();

            // Update store - deep equality check inside will prevent unnecessary rerenders
            useSavedRequestsStore.getState().updateAll({
              requests: data.requests,
              folders: data.folders,
            });
          } catch (err) {
            // Ignore reload errors (file might be temporarily invalid during save)
            console.error("File reload failed:", err instanceof Error ? err.message : err);
          }
        }, 300); // 300ms debounce
      }
    });
  } catch (err) {
    console.error("Failed to watch file:", err);
  }
}

export function stopWatchingFile() {
  if (reloadTimeout) {
    clearTimeout(reloadTimeout);
    reloadTimeout = null;
  }

  if (activeWatcher) {
    try {
      activeWatcher.close();
    } catch (_err) {
      // Ignore close errors
    }
    activeWatcher = null;
  }

  watchedPath = null;
}
