// Execute JavaScript response handlers in sandboxed vm
// Provides IntelliJ-compatible client and response objects

import vm from "node:vm";

export interface ExecuteOptions {
  timeout?: number; // milliseconds, default 5000
}

export interface ExecuteResult {
  success: boolean;
  error?: string;
}

/**
 * Execute JavaScript code in sandboxed vm
 * @param script JavaScript code to execute
 * @param context Object containing client and response
 * @param options Execution options (timeout)
 * @returns ExecuteResult with success status and optional error
 */
export async function executeScript(
  script: string,
  context: { client: unknown; response: unknown },
  options: ExecuteOptions = {}
): Promise<ExecuteResult> {
  // Handle empty script
  if (!script || script.trim() === "") {
    return { success: true };
  }

  const timeout = options.timeout ?? 5000;

  try {
    // Create sandbox with only client and response
    // No access to process, require, fs, etc.
    const sandbox = {
      client: context.client,
      response: context.response,
      console, // Allow console for debugging
    };

    // Create vm context
    vm.createContext(sandbox);

    // Execute with timeout
    vm.runInContext(script, sandbox, {
      timeout,
      displayErrors: true,
    });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Handle timeout - return message containing "timeout"
    if (errorMessage.includes("timed out")) {
      return {
        success: false,
        error: errorMessage.replace("timed out", "timeout"),
      };
    }

    // Normalize syntax errors for consistency across engines
    let normalizedError = errorMessage;
    if (
      errorMessage.includes("missing )") ||
      errorMessage.includes("missing }") ||
      errorMessage.includes("missing ]")
    ) {
      normalizedError = errorMessage.replace(/missing [)\]}].*/, "Unexpected end of input");
    }

    // Handle syntax errors and runtime errors
    return {
      success: false,
      error: normalizedError,
    };
  }
}
