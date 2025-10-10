// Integration tests for variable resolution
// Tests .env loading and {{VARIABLE}} interpolation per CLI-REQUIREMENTS.md section 7

import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const CLI_PATH = resolve(__dirname, "../../../dist/cli.js");

describe("Integration: Variable resolution", () => {
  describe("VAR-01: Variable from .env file", () => {
    it("testVariable_FromEnv_Resolves", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "http-cli-test-"));

      try {
        // Create .env file
        writeFileSync(
          join(tempDir, ".env"),
          `USER_ID=1
API_KEY=test-key-12345
BASE_URL=https://jsonplaceholder.typicode.com`
        );

        // Create .http file with variables
        const httpContent = `
### get-user
GET {{BASE_URL}}/users/{{USER_ID}}
Authorization: Bearer {{API_KEY}}
`;
        writeFileSync(join(tempDir, "api.http"), httpContent);

        const result = execSync(`node ${CLI_PATH} get-user`, {
          cwd: tempDir,
          encoding: "utf-8",
        });

        const json = JSON.parse(result);

        // Variables should be resolved in request
        expect(json.request.url).toBe("https://jsonplaceholder.typicode.com/users/1");
        // Authorization header is redacted (requirements 12.1), but should start with "Bearer test-"
        expect(json.request.headers.Authorization).toBe("Bearer test-...");

        // Response should succeed
        expect(json.response.status).toBe(200);

        // WILL FAIL: Variable resolution not implemented yet
      } finally {
        rmSync(tempDir, { recursive: true });
      }
    });
  });

  describe("VAR-02: Undefined variable error", () => {
    it("testVariable_Undefined_ExitCode1WithError", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "http-cli-test-"));

      try {
        // Create .http file with undefined variable
        const httpContent = `
### test-request
GET https://api.example.com/users/{{UNDEFINED_VAR}}
`;
        writeFileSync(join(tempDir, "api.http"), httpContent);

        try {
          execSync(`node ${CLI_PATH} test-request`, {
            cwd: tempDir,
            encoding: "utf-8",
          });

          // Should not reach here
          expect(false).toBe(true);
        } catch (error) {
          // Should exit with code 1 (requirements 7.3)
          expect((error as { status: number }).status).toBe(1);

          const stderr = (error as { stderr: Buffer }).stderr.toString();
          const stdout = (error as { stdout: Buffer }).stdout.toString();
          const output = stdout || stderr;

          const json = JSON.parse(output);
          expect(json).toHaveProperty("error");
          expect(json.error.type).toBe("MissingVariableError");
          expect(json.error.message).toContain("UNDEFINED_VAR");
          expect(json.error).toHaveProperty("variables");
          expect(json.error.variables).toContain("UNDEFINED_VAR");
        }

        // WILL FAIL: Error handling not implemented yet
      } finally {
        rmSync(tempDir, { recursive: true });
      }
    });
  });

  describe("VAR-03: Multiple undefined variables", () => {
    it("testVariable_MultipleUndefined_ListsAll", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "http-cli-test-"));

      try {
        const httpContent = `
### test-request
POST https://api.example.com/{{ENDPOINT}}
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
  "userId": "{{USER_ID}}"
}
`;
        writeFileSync(join(tempDir, "api.http"), httpContent);

        try {
          execSync(`node ${CLI_PATH} test-request`, {
            cwd: tempDir,
            encoding: "utf-8",
            env: { PATH: process.env.PATH }, // Only PATH, no USER_ID or other vars
          });

          expect(false).toBe(true);
        } catch (error) {
          expect((error as { status: number }).status).toBe(1);

          const stderr = (error as { stderr: Buffer }).stderr.toString();
          const stdout = (error as { stdout: Buffer }).stdout.toString();
          const output = stdout || stderr;

          const json = JSON.parse(output);
          expect(json.error.type).toBe("MissingVariableError");
          expect(json.error.variables).toContain("ENDPOINT");
          expect(json.error.variables).toContain("TOKEN");
          expect(json.error.variables).toContain("USER_ID");
        }

        // WILL FAIL: Multiple variable detection not implemented yet
      } finally {
        rmSync(tempDir, { recursive: true });
      }
    });
  });

  describe("VAR-04: Shell environment variable", () => {
    it("testVariable_FromShellEnv_Resolves", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "http-cli-test-"));

      try {
        const httpContent = `
### test-request
GET https://jsonplaceholder.typicode.com/users/{{TEST_USER_ID}}
`;
        writeFileSync(join(tempDir, "api.http"), httpContent);

        // Set environment variable for this execution
        const result = execSync(`node ${CLI_PATH} test-request`, {
          cwd: tempDir,
          encoding: "utf-8",
          env: { ...process.env, TEST_USER_ID: "1" },
        });

        const json = JSON.parse(result);
        expect(json.request.url).toBe("https://jsonplaceholder.typicode.com/users/1");
        expect(json.response.status).toBe(200);

        // WILL FAIL: Shell env resolution not implemented yet
      } finally {
        rmSync(tempDir, { recursive: true });
      }
    });
  });

  describe("VAR-05: .env takes priority over shell", () => {
    it("testVariable_EnvFileOverridesShell", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "http-cli-test-"));

      try {
        // Create .env with USER_ID=2
        writeFileSync(join(tempDir, ".env"), "TEST_VAR=from-env-file");

        const httpContent = `
### test-request
GET https://jsonplaceholder.typicode.com/users/1
X-Test-Header: {{TEST_VAR}}
`;
        writeFileSync(join(tempDir, "api.http"), httpContent);

        // Set shell env to different value
        const result = execSync(`node ${CLI_PATH} test-request`, {
          cwd: tempDir,
          encoding: "utf-8",
          env: { ...process.env, TEST_VAR: "from-shell" },
        });

        const json = JSON.parse(result);
        // .env should win (requirements 7.1)
        expect(json.request.headers["X-Test-Header"]).toBe("from-env-file");

        // WILL FAIL: Priority order not implemented yet
      } finally {
        rmSync(tempDir, { recursive: true });
      }
    });
  });

  describe("VAR-06: Variable in URL path", () => {
    it("testVariable_InUrlPath_Resolves", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "http-cli-test-"));

      try {
        writeFileSync(join(tempDir, ".env"), "USER_ID=1");

        const httpContent = `
### get-user
GET https://jsonplaceholder.typicode.com/users/{{USER_ID}}
`;
        writeFileSync(join(tempDir, "api.http"), httpContent);

        const result = execSync(`node ${CLI_PATH} get-user`, {
          cwd: tempDir,
          encoding: "utf-8",
        });

        const json = JSON.parse(result);
        expect(json.request.url).toBe("https://jsonplaceholder.typicode.com/users/1");
        expect(json.response.status).toBe(200);
      } finally {
        rmSync(tempDir, { recursive: true });
      }
    });
  });

  describe("VAR-07: Variable in request body", () => {
    it("testVariable_InBody_Resolves", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "http-cli-test-"));

      try {
        writeFileSync(
          join(tempDir, ".env"),
          `TITLE=Test Post
BODY=This is test content
USER_ID=1`
        );

        const httpContent = `
### create-post
POST https://jsonplaceholder.typicode.com/posts
Content-Type: application/json

{
  "title": "{{TITLE}}",
  "body": "{{BODY}}",
  "userId": {{USER_ID}}
}
`;
        writeFileSync(join(tempDir, "api.http"), httpContent);

        const result = execSync(`node ${CLI_PATH} create-post`, {
          cwd: tempDir,
          encoding: "utf-8",
        });

        const json = JSON.parse(result);
        const bodyObj = JSON.parse(json.request.body);
        expect(bodyObj.title).toBe("Test Post");
        expect(bodyObj.body).toBe("This is test content");
        expect(bodyObj.userId).toBe(1);
        expect(json.response.status).toBe(201);
      } finally {
        rmSync(tempDir, { recursive: true });
      }
    });
  });
});
