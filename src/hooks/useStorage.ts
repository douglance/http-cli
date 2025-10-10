import { useEffect, useState } from "react";
import { useSavedRequestsStore } from "../stores/savedRequestsStore.js";
import { getStorage } from "../stores/storage.js";
import { startWatchingFile, stopWatchingFile } from "../watchers/fileWatcher.js";

export function useStorage(requestsFilePath?: string) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [initialLoadError, setInitialLoadError] = useState<string | null>(null);
  const [reloadError, setReloadError] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string>("");

  useEffect(() => {
    let isActive = true;

    async function loadStorage() {
      try {
        const storage = getStorage(requestsFilePath);
        const data = await storage.load();

        if (!isActive) {
          return; // Component unmounted during load
        }

        // Initial load
        const storagePath = storage.getFilePath();
        useSavedRequestsStore
          .getState()
          .updateAll({ requests: data.requests, folders: data.folders });
        setFilePath(storagePath);
        setIsLoaded(true);
        setInitialLoadError(null);
        setReloadError(null);

        // Start watching for file changes
        startWatchingFile(storagePath);
      } catch (err) {
        if (!isActive) {
          return;
        }
        const errorMessage = err instanceof Error ? err.message : "Failed to load storage";
        setInitialLoadError(errorMessage);
        setIsLoaded(true);
      }
    }

    loadStorage();

    return () => {
      isActive = false;
      stopWatchingFile();
    };
  }, [requestsFilePath]);

  return { isLoaded, initialLoadError, reloadError, filePath };
}
