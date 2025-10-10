// Variable resolution from .env files and shell environment
// Resolution order per CLI-REQUIREMENTS.md section 7.1:
// 1. .env file (highest priority)
// 2. Shell environment variables
// 3. Error if undefined

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

interface ResolvedVariables {
  [key: string]: string;
}

interface ErrorResult {
  error: {
    type: string;
    message: string;
    variables: string[];
  };
}

/**
 * Load variables from .env file
 */
function loadEnvFile(directory: string): ResolvedVariables {
  const envPath = join(directory, ".env");

  if (!existsSync(envPath)) {
    return {};
  }

  try {
    const content = readFileSync(envPath, "utf-8");
    const variables: ResolvedVariables = {};

    for (const line of content.split("\n")) {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      // Parse KEY=VALUE format
      const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (match && match[1] && match[2] !== undefined) {
        const key = match[1];
        let value = match[2];

        // Remove surrounding quotes if present
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }

        variables[key] = value;
      }
    }

    return variables;
  } catch {
    return {};
  }
}

/**
 * Extract all {{VARIABLE}} patterns from text
 */
export function extractVariables(text: string): string[] {
  const variablePattern = /\{\{(\w+)\}\}/g;
  const matches = text.matchAll(variablePattern);
  const variables = new Set<string>();

  for (const match of matches) {
    if (match[1]) {
      variables.add(match[1]);
    }
  }

  return Array.from(variables);
}

/**
 * Resolve all variables from .env and shell environment
 * Priority: .env > shell env
 */
export function resolveVariables(
  directory: string,
  requiredVariables: string[]
): ResolvedVariables {
  // Load .env file (highest priority)
  const envFileVars = loadEnvFile(directory);

  // Merge with shell environment (lower priority)
  const resolved: ResolvedVariables = {};

  for (const varName of requiredVariables) {
    if (envFileVars[varName] !== undefined) {
      // .env file takes priority (requirements 7.1)
      resolved[varName] = envFileVars[varName];
    } else if (process.env[varName] !== undefined) {
      // Fall back to shell environment
      resolved[varName] = process.env[varName] as string;
    }
  }

  return resolved;
}

/**
 * Validate all required variables are defined
 */
export function validateVariables(required: string[], resolved: ResolvedVariables): string[] {
  const missing: string[] = [];

  for (const varName of required) {
    if (resolved[varName] === undefined) {
      missing.push(varName);
    }
  }

  return missing;
}

/**
 * Replace {{VARIABLE}} patterns in text with resolved values
 */
export function interpolateVariables(text: string, variables: ResolvedVariables): string {
  let result = text;

  for (const [key, value] of Object.entries(variables)) {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    result = result.replace(pattern, value);
  }

  return result;
}

/**
 * Process request and resolve all variables
 * Throws error if any variables are undefined
 */
export function processRequestVariables(
  directory: string,
  url: string,
  headers: Record<string, string>,
  body: string | null
): {
  url: string;
  headers: Record<string, string>;
  body: string | null;
  variables: ResolvedVariables;
} {
  // Extract all variables from request
  const urlVars = extractVariables(url);
  const headerVars = Object.values(headers).flatMap((value) => extractVariables(value));
  const bodyVars = body ? extractVariables(body) : [];
  const allVars = [...new Set([...urlVars, ...headerVars, ...bodyVars])];

  // Resolve variables
  const resolved = resolveVariables(directory, allVars);

  // Validate all variables are defined
  const missing = validateVariables(allVars, resolved);

  if (missing.length > 0) {
    const error: ErrorResult = {
      error: {
        type: "MissingVariableError",
        message: `Undefined variable${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`,
        variables: missing,
      },
    };
    console.log(JSON.stringify(error, null, 2));
    process.exit(1);
  }

  // Interpolate variables
  const processedUrl = interpolateVariables(url, resolved);
  const processedHeaders: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    processedHeaders[key] = interpolateVariables(value, resolved);
  }

  const processedBody = body ? interpolateVariables(body, resolved) : null;

  return {
    url: processedUrl,
    headers: processedHeaders,
    body: processedBody,
    variables: resolved,
  };
}
