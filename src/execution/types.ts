// Core interfaces for response handler execution

export interface ParsedHandler {
  script: string;
  startLine: number;
  language: "javascript";
}

export interface ResponseAPI {
  body: {
    json<T = unknown>(): T;
    text(): string;
  };
  headers: {
    get(name: string): string | undefined;
    valuesOf(name: string): string[];
  };
  status: number;
  contentType: {
    mimeType: string;
    charset?: string;
  };
}

export interface GlobalVariableAPI {
  set(name: string, value: string): void;
  get(name: string): string | undefined | null;
  clear(name?: string): void;
  isEmpty(): boolean;
}

export interface EnvironmentVariableAPI {
  set(name: string, value: string): void;
  get(name: string): string | undefined;
}

export interface ClientAPI {
  global: GlobalVariableAPI;
  environment: EnvironmentVariableAPI;
  test(name: string, fn: () => void): void;
}

export interface ScriptContext {
  response: ResponseAPI;
  client: ClientAPI;
  variables: Record<string, string>;
}

export interface ExecutionResult {
  success: boolean;
  error?: Error;
  updatedVars: {
    global: Record<string, string>;
    environment: Record<string, string>;
  };
}
