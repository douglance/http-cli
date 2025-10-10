// Integration tests for request execution
// Tests JSON output according to CLI-REQUIREMENTS.md section 3

import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const CLI_PATH = resolve(__dirname, "../../../dist/cli.js");

describe("Integration: Request execution", () => {
  describe("EXEC-01: Success response (200)", () => {
    it("testExecute_Success_OutputsJSONSchema", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "http-cli-test-"));

      try {
        // Create .http file with simple GET request
        const httpContent = `
### test-request
GET https://jsonplaceholder.typicode.com/todos/1
`;
        writeFileSync(join(tempDir, "api.http"), httpContent);

        // Execute request by name
        const result = execSync(`node ${CLI_PATH} test-request`, {
          cwd: tempDir,
          encoding: "utf-8",
        });

        // Should output JSON (not TUI)
        const json = JSON.parse(result);

        // Verify JSON schema (requirements 3.1)
        expect(json).toHaveProperty("request");
        expect(json).toHaveProperty("response");
        expect(json).toHaveProperty("timings");
        expect(json).toHaveProperty("metadata");

        // Verify request object
        expect(json.request).toHaveProperty("name", "test-request");
        expect(json.request).toHaveProperty("file", "api.http");
        expect(json.request).toHaveProperty("method", "GET");
        expect(json.request).toHaveProperty("url");
        expect(json.request).toHaveProperty("headers");

        // Verify response object
        expect(json.response).toHaveProperty("status");
        expect(json.response.status).toBeGreaterThanOrEqual(200);
        expect(json.response.status).toBeLessThan(300);
        expect(json.response).toHaveProperty("statusText");
        expect(json.response).toHaveProperty("headers");
        expect(json.response).toHaveProperty("body");

        // Verify timings object (requirements 3.1)
        expect(json.timings).toHaveProperty("dnsLookup");
        expect(json.timings).toHaveProperty("tcpConnection");
        expect(json.timings).toHaveProperty("tlsHandshake"); // HTTPS request
        expect(json.timings).toHaveProperty("firstByte");
        expect(json.timings).toHaveProperty("total");

        // WILL FAIL: JSON execution not implemented yet
      } finally {
        rmSync(tempDir, { recursive: true });
      }
    });
  });

  describe("EXEC-02: HTTP error response (404)", () => {
    it("testExecute_404_ExitCode0WithJSON", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "http-cli-test-"));

      try {
        const httpContent = `
### not-found
GET https://jsonplaceholder.typicode.com/todos/999999
`;
        writeFileSync(join(tempDir, "api.http"), httpContent);

        const result = execSync(`node ${CLI_PATH} not-found`, {
          cwd: tempDir,
          encoding: "utf-8",
        });

        const json = JSON.parse(result);

        // Should return JSON with 404 status (requirements 3.3)
        expect(json.response.status).toBe(404);
        expect(json.response.statusText).toContain("Not Found");

        // Exit code should be 0 (request succeeded, server returned error)
        // If we reach here, exit code was 0

        // WILL FAIL: JSON execution not implemented yet
      } finally {
        rmSync(tempDir, { recursive: true });
      }
    });
  });

  describe("EXEC-03: Request not found error", () => {
    it("testExecute_NotFound_ExitCode1WithError", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "http-cli-test-"));

      try {
        writeFileSync(
          join(tempDir, "api.http"),
          `
### login
POST /auth/login
`
        );

        try {
          execSync(`node ${CLI_PATH} nonexistent`, {
            cwd: tempDir,
            encoding: "utf-8",
          });

          // Should not reach here
          expect(false).toBe(true);
        } catch (error) {
          // Should exit with code 1 (requirements 3.5)
          expect((error as { status: number }).status).toBe(1);

          // Should output error JSON
          const stderr = (error as { stderr: Buffer }).stderr.toString();
          const stdout = (error as { stdout: Buffer }).stdout.toString();
          const output = stdout || stderr;

          const json = JSON.parse(output);
          expect(json).toHaveProperty("error");
          expect(json.error.type).toBe("NotFoundError");
          expect(json.error.message).toContain("nonexistent");
        }

        // WILL FAIL: Error handling not implemented yet
      } finally {
        rmSync(tempDir, { recursive: true });
      }
    });
  });

  describe("EXEC-04: Ambiguous request error", () => {
    it("testExecute_Ambiguous_ExitCode1WithError", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "http-cli-test-"));

      try {
        // Create two files with same request name
        writeFileSync(
          join(tempDir, "api.http"),
          `
### login
POST /api/login
`
        );

        writeFileSync(
          join(tempDir, "auth.http"),
          `
### login
POST /auth/login
`
        );

        try {
          execSync(`node ${CLI_PATH} login`, {
            cwd: tempDir,
            encoding: "utf-8",
          });

          // Should not reach here
          expect(false).toBe(true);
        } catch (error) {
          // Should exit with code 1 (requirements 3.6)
          expect((error as { status: number }).status).toBe(1);

          const stderr = (error as { stderr: Buffer }).stderr.toString();
          const stdout = (error as { stdout: Buffer }).stdout.toString();
          const output = stdout || stderr;

          const json = JSON.parse(output);
          expect(json).toHaveProperty("error");
          expect(json.error.type).toBe("AmbiguousRequestError");
          expect(json.error.message).toContain("login");
          expect(json.error.message).toContain("api.http");
          expect(json.error.message).toContain("auth.http");
          expect(json.error).toHaveProperty("hint");
          expect(json.error.hint).toContain("-f");
        }

        // WILL FAIL: Ambiguity detection not implemented yet
      } finally {
        rmSync(tempDir, { recursive: true });
      }
    });
  });

  describe("EXEC-05: Ambiguity resolved with -f flag", () => {
    it("testExecute_AmbiguousWithFile_Success", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "http-cli-test-"));

      try {
        // Create two files with same request name
        writeFileSync(
          join(tempDir, "api.http"),
          `
### login
GET https://jsonplaceholder.typicode.com/users/1
`
        );

        writeFileSync(
          join(tempDir, "auth.http"),
          `
### login
GET https://jsonplaceholder.typicode.com/users/2
`
        );

        // Should succeed when using -f flag (requirements 4.4)
        const result = execSync(`node ${CLI_PATH} -f api.http login`, {
          cwd: tempDir,
          encoding: "utf-8",
        });

        const json = JSON.parse(result);
        expect(json.request.file).toBe("api.http");
        expect(json.response.status).toBeGreaterThanOrEqual(200);
        expect(json.response.status).toBeLessThan(300);

        // WILL FAIL: -f flag with execution not implemented yet
      } finally {
        rmSync(tempDir, { recursive: true });
      }
    });
  });

  describe("EXEC-06: Network error", () => {
    it("testExecute_NetworkError_ExitCode1WithError", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "http-cli-test-"));

      try {
        // Use invalid domain for network error
        const httpContent = `
### network-fail
GET https://this-domain-does-not-exist-12345.com/api
`;
        writeFileSync(join(tempDir, "api.http"), httpContent);

        try {
          execSync(`node ${CLI_PATH} network-fail`, {
            cwd: tempDir,
            encoding: "utf-8",
            timeout: 10000, // 10s timeout
          });

          // Should not reach here
          expect(false).toBe(true);
        } catch (error) {
          // Should exit with code 1 (requirements 3.4)
          expect((error as { status: number }).status).toBe(1);

          const stderr = (error as { stderr: Buffer }).stderr.toString();
          const stdout = (error as { stdout: Buffer }).stdout.toString();
          const output = stdout || stderr;

          const json = JSON.parse(output);
          expect(json).toHaveProperty("error");
          expect(json.error.type).toBe("NetworkError");
          expect(json.error).toHaveProperty("code");
          expect(json.error).toHaveProperty("message");
          expect(json).toHaveProperty("request");
          expect(json.request.name).toBe("network-fail");
        }

        // WILL FAIL: Network error handling not implemented yet
      } finally {
        rmSync(tempDir, { recursive: true });
      }
    });
  });
});
