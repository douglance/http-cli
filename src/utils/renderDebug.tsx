import { appendFileSync } from "node:fs";
import { useEffect, useRef } from "react";

const DEBUG_LOG = "/tmp/http-inspector-render-debug.log";

export function logError(error: Error, context: string) {
  const timestamp = new Date().toISOString().substring(11, 23);
  const msg = `${timestamp} [ERROR] ${context}: ${error.message}\n${error.stack}\n\n`;
  try {
    appendFileSync(DEBUG_LOG, msg);
  } catch (_err) {
    // Ignore
  }
}

export function logInfo(message: string) {
  const timestamp = new Date().toISOString().substring(11, 23);
  const msg = `${timestamp} [INFO] ${message}\n`;
  try {
    appendFileSync(DEBUG_LOG, msg);
  } catch (_err) {
    // Ignore
  }
}

export function useRenderDebug(componentName: string, props: Record<string, unknown>) {
  const renderCount = useRef(0);
  const prevProps = useRef(props);

  useEffect(() => {
    renderCount.current++;
    const changes: string[] = [];

    Object.keys(props).forEach((key) => {
      if (prevProps.current[key] !== props[key]) {
        const prev = String(prevProps.current[key]).substring(0, 50);
        const curr = String(props[key]).substring(0, 50);
        changes.push(`${key}: ${prev} → ${curr}`);
      }
    });

    const timestamp = new Date().toISOString().substring(11, 23); // HH:MM:SS.mmm
    const msg = `${timestamp} [${componentName}] Render #${renderCount.current} ${changes.length > 0 ? changes.join(", ") : "(no prop changes)"}\n`;

    try {
      appendFileSync(DEBUG_LOG, msg);
    } catch (_err) {
      // Ignore file write errors
    }

    prevProps.current = props;
  });

  return renderCount.current;
}
