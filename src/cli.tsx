#!/usr/bin/env node
import { render } from "ink";
import { App } from "./App.js";
import { logError, logInfo } from "./utils/renderDebug.js";

logInfo("=== CLI STARTING ===");

// Catch all uncaught errors
process.on("uncaughtException", (error) => {
  logError(error, "UNCAUGHT EXCEPTION");
  console.error("FATAL ERROR:", error.message);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logError(reason instanceof Error ? reason : new Error(String(reason)), "UNHANDLED REJECTION");
  console.error("UNHANDLED REJECTION:", reason);
});

// Parse CLI arguments
const args = process.argv.slice(2);
let requestsFile: string | undefined;
let requestName: string | undefined;
let helpRequested = false;
let listRequested = false;
let _jsonOut = false;
let _outputPath: string | undefined;
let _followRedirects = false;
let _compressed = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (!arg) {
    continue;
  }

  if (arg === "--help" || arg === "-h") {
    helpRequested = true;
  } else if (arg === "--list") {
    listRequested = true;
  } else if (arg === "--file" || arg === "-f") {
    requestsFile = args[i + 1];
    i++; // Skip next arg
  } else if (arg === "--json") {
    _jsonOut = true;
  } else if (arg === "-o" || arg === "--output") {
    _outputPath = args[i + 1];
    i++; // Skip next arg
  } else if (arg === "-L" || arg === "--location") {
    _followRedirects = true;
  } else if (arg === "--compressed") {
    _compressed = true;
  } else if (!arg.startsWith("-")) {
    // First positional argument after -f is request name
    // Otherwise, could be file or request name
    if (requestsFile) {
      // Already have file, this must be request name
      requestName = arg;
    } else if (arg.endsWith(".http") || arg.endsWith(".rest")) {
      // Looks like a file
      requestsFile = arg;
    } else {
      // Assume it's a request name (non-interactive execution)
      requestName = arg;
    }
  }
}

// Show help
if (helpRequested) {
  console.log(`
http - Terminal-based HTTP client

Usage:
  http [options] [file]              # Launch TUI (default)
  http run <name|index> [options]    # Non-interactive execution

Options:
  -f, --file <path>    Path to requests file (.http, .json, etc.)
  -h, --help           Show this help message
  --json               Output JSON (for 'run' command)
  -o, --output <path>  Write response to file
  -L, --location       Follow redirects
  --compressed         Request compressed response

Examples:
  http                           # Auto-detect requests.http, launch TUI
  http api.http                  # Use specific file
  http run "Get Users" --json    # Execute request, JSON output
  http run 0 -o response.json    # Execute first request, save to file

File Formats:
  .http / .rest   (VS Code REST Client, JetBrains) [DEFAULT]
  .json           (Postman, Insomnia, Thunder Client, HAR)

Environment Variables:
  Auto-loads .env* files from current directory
  Use {{VARIABLE}} syntax in requests

Navigation (TUI):
  [h/l]    Navigate between panes
  [j/k]    Navigate between sub-panels
  [↑↓]     Navigate within lists
  [i]      Inspect environment variables
  [q]      Quit
`);
  process.exit(0);
}

// Handle --list flag
if (listRequested) {
  const { listRequests } = await import("./lib/list-requests.js");
  listRequests(process.cwd(), requestsFile);
  // listRequests calls process.exit(0)
}

// Handle request execution (non-interactive mode)
// When request name provided, execute and output JSON (requirements section 1.1)
if (requestName) {
  const { executeRequest } = await import("./lib/execute-request.js");
  await executeRequest(process.cwd(), requestName, requestsFile);
  // executeRequest calls process.exit(0 or 1)
}

// Otherwise, launch TUI
try {
  logInfo(`Rendering app with requestsFile: ${requestsFile || "undefined"}`);
  const { waitUntilExit } = render(<App requestsFilePath={requestsFile} />, {
    exitOnCtrlC: false,
  });
  await waitUntilExit();
  logInfo("=== CLI EXITED CLEANLY ===");
} catch (error) {
  logError(error instanceof Error ? error : new Error(String(error)), "RENDER ERROR");
  console.error("RENDER ERROR:", error);
  process.exit(1);
}
