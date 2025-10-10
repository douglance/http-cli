import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "dotenv";
import { create } from "zustand";

// Colors assigned to each environment index (Atom One Dark palette - bright variants)
// Using bright colors to avoid conflicts with HTTP syntax highlighting
const ENV_COLORS = [
  "yellowBright", // 0: default/.env (orange-ish, Atom One Dark orange)
  "magentaBright", // 1: .env.local (purple-ish, distinct from boolean magenta)
  "cyanBright", // 2: .env.production (bright cyan, distinct from HTTP verbs)
  "greenBright", // 3: .env.staging (bright green, distinct from JSON strings)
  "blueBright", // 4: .env.development (bright blue, distinct from headers)
  "redBright", // 5+: additional envs (bright red, distinct from errors)
] as const;

export type EnvColor = (typeof ENV_COLORS)[number];

export const getEnvColor = (index: number): EnvColor => {
  return ENV_COLORS[index % ENV_COLORS.length] || "yellowBright";
};

interface EnvFile {
  name: string;
  label: string;
  path: string;
  vars: Record<string, string>;
}

export interface EnvVarInfo {
  varName: string;
  value: string;
  color: EnvColor;
  envIndex: number;
}

interface EnvState {
  envFiles: EnvFile[];
  selectedEnvIndex: number;
  activeEnvIndex: number;
  isLoaded: boolean;
  loadEnv: () => void;
  nextEnv: () => void;
  prevEnv: () => void;
  setSelectedEnvIndex: (index: number) => void;
  activateSelectedEnv: () => void;
  getActiveEnvLabel: () => string;
  getSelectedEnvLabel: () => string;
  replaceVars: (text: string) => string;
  replaceVarsWithIndicator: (text: string) => string;
  getEnvVarInfo: (text: string) => EnvVarInfo[];
  getMissingVars: (text: string) => string[];
  validateRequest: (
    url: string,
    headers: Record<string, string>,
    body?: string
  ) => { valid: boolean; missing: string[] };
}

export const useEnvStore = create<EnvState>((set, get) => ({
  envFiles: [],
  selectedEnvIndex: 0,
  activeEnvIndex: 0,
  isLoaded: false,

  loadEnv: () => {
    const cwd = process.cwd();
    const files = readdirSync(cwd);
    const envFiles: EnvFile[] = [];

    // Find all .env* files, excluding .env.example
    const envFileNames = files.filter((f) => f.startsWith(".env") && f !== ".env.example");

    envFileNames.forEach((fileName) => {
      const envPath = join(cwd, fileName);
      if (existsSync(envPath)) {
        const fileContent = readFileSync(envPath, "utf8");
        const parsed = parse(fileContent);

        // Parse label from filename
        let label = "default";
        if (fileName === ".env") {
          label = "default";
        } else if (fileName.startsWith(".env.")) {
          label = fileName.replace(".env.", "");
        }

        envFiles.push({
          name: fileName,
          label,
          path: envPath,
          vars: parsed,
        });
      }
    });

    // Sort alphabetically by label
    envFiles.sort((a, b) => a.label.localeCompare(b.label));

    // If no .env files found, create a default empty one
    if (envFiles.length === 0) {
      envFiles.push({
        name: ".env",
        label: "default",
        path: join(cwd, ".env"),
        vars: { ...process.env } as Record<string, string>,
      });
    }

    set({ envFiles, selectedEnvIndex: 0, activeEnvIndex: 0, isLoaded: true });
  },

  nextEnv: () => {
    const { envFiles, selectedEnvIndex } = get();
    if (envFiles.length > 0) {
      const nextIndex = (selectedEnvIndex + 1) % envFiles.length;
      set({ selectedEnvIndex: nextIndex });
    }
  },

  prevEnv: () => {
    const { envFiles, selectedEnvIndex } = get();
    if (envFiles.length > 0) {
      const prevIndex = selectedEnvIndex === 0 ? envFiles.length - 1 : selectedEnvIndex - 1;
      set({ selectedEnvIndex: prevIndex });
    }
  },

  setSelectedEnvIndex: (index: number) => {
    const { envFiles } = get();
    if (index >= 0 && index < envFiles.length) {
      set({ selectedEnvIndex: index });
    }
  },

  activateSelectedEnv: () => {
    const { selectedEnvIndex } = get();
    set({ activeEnvIndex: selectedEnvIndex });
  },

  getActiveEnvLabel: () => {
    const { envFiles, activeEnvIndex } = get();
    if (envFiles.length > 0 && envFiles[activeEnvIndex]) {
      return envFiles[activeEnvIndex].label;
    }
    return "default";
  },

  getSelectedEnvLabel: () => {
    const { envFiles, selectedEnvIndex } = get();
    if (envFiles.length > 0 && envFiles[selectedEnvIndex]) {
      return envFiles[selectedEnvIndex].label;
    }
    return "default";
  },

  replaceVars: (text: string): string => {
    const { envFiles, activeEnvIndex } = get();

    if (envFiles.length === 0) {
      return text;
    }

    const vars = envFiles[activeEnvIndex]?.vars || {};

    // Replace {{VAR_NAME}} with environment variable values
    return text.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
      const trimmedName = varName.trim();
      return vars[trimmedName] || match; // Keep original if not found
    });
  },

  replaceVarsWithIndicator: (text: string): string => {
    const { envFiles, activeEnvIndex } = get();

    if (envFiles.length === 0) {
      return text;
    }

    const vars = envFiles[activeEnvIndex]?.vars || {};

    // Replace {{VAR_NAME}} with {VAR_NAME:value} to show substitution
    return text.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
      const trimmedName = varName.trim();
      const value = vars[trimmedName];
      return value ? `{${trimmedName}:${value}}` : match; // Show {VAR:value} if found, keep {{VAR}} if not
    });
  },

  getEnvVarInfo: (text: string): EnvVarInfo[] => {
    const { envFiles, activeEnvIndex } = get();

    if (envFiles.length === 0) {
      return [];
    }

    const vars = envFiles[activeEnvIndex]?.vars || {};
    const varInfos: EnvVarInfo[] = [];

    // Find all {{VAR_NAME}} patterns and extract info
    const matches = text.matchAll(/\{\{([^}]+)\}\}/g);
    for (const match of matches) {
      const varName = match[1]?.trim();
      if (varName) {
        const value = vars[varName];
        if (value) {
          varInfos.push({
            varName,
            value,
            color: getEnvColor(activeEnvIndex),
            envIndex: activeEnvIndex,
          });
        }
      }
    }

    return varInfos;
  },

  getMissingVars: (text: string): string[] => {
    const { envFiles, activeEnvIndex } = get();

    if (envFiles.length === 0) {
      return [];
    }

    const vars = envFiles[activeEnvIndex]?.vars || {};
    const missing: string[] = [];

    // Find all {{VAR_NAME}} patterns
    const matches = text.matchAll(/\{\{([^}]+)\}\}/g);
    for (const match of matches) {
      const varName = match[1]?.trim();
      if (varName && !vars[varName]) {
        missing.push(varName);
      }
    }

    return [...new Set(missing)]; // Remove duplicates
  },

  validateRequest: (
    url: string,
    headers: Record<string, string>,
    body?: string
  ): { valid: boolean; missing: string[] } => {
    const { getMissingVars } = get();

    const allText = [url, ...Object.values(headers), body || ""].join(" ");

    const missing = getMissingVars(allText);
    return {
      valid: missing.length === 0,
      missing,
    };
  },
}));

/**
 * Replace {{varName}} placeholders with values from vars object
 * @param text Text containing {{varName}} placeholders
 * @param vars Object mapping variable names to values
 * @returns Text with all variables substituted
 */
export function replaceVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
    const trimmed = varName.trim();
    return vars[trimmed] ?? match; // Return original if not found
  });
}
