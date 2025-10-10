// Integration tests for --list command
// Tests auto-discovery and table output formatting

import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const CLI_PATH = resolve(__dirname, "../../../dist/cli.js");

describe("Integration: --list command", () => {
  describe("LIST-01: No .http files found", () => {
    it("testList_NoFiles_ExitsWithMessage", () => {
      // Create empty temp directory
      const tempDir = mkdtempSync(join(tmpdir(), "http-cli-test-"));

      try {
        // Run CLI with --list in empty directory
        // Note: stderr is not captured in execSync by default, so we check exit behavior
        execSync(`node ${CLI_PATH} --list`, {
          cwd: tempDir,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"], // Capture stderr
        });

        // Should exit with code 0 and output message
        // If we reach here, exit code was 0 (success)
      } finally {
        rmSync(tempDir, { recursive: true });
      }
    });
  });

  describe("LIST-02: Single file with requests", () => {
    it("testList_SingleFile_ShowsTableFormat", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "http-cli-test-"));

      try {
        // Create api.http with multiple requests
        const httpContent = `
### login
POST /auth/login
Content-Type: application/json

{"email": "{{EMAIL}}", "password": "{{PASSWORD}}"}

### get-users
GET /api/users

### create-user
POST /api/users
Content-Type: application/json

{"name": "{{NAME}}", "email": "{{EMAIL}}"}
`;
        writeFileSync(join(tempDir, "api.http"), httpContent);

        const result = execSync(`node ${CLI_PATH} --list`, {
          cwd: tempDir,
          encoding: "utf-8",
        });

        // Should output table with columns: NAME, METHOD, URL, VARIABLES
        expect(result).toContain("NAME");
        expect(result).toContain("METHOD");
        expect(result).toContain("URL");
        expect(result).toContain("VARIABLES");

        // Should show request names
        expect(result).toContain("login");
        expect(result).toContain("get-users");
        expect(result).toContain("create-user");

        // Should show methods
        expect(result).toContain("POST");
        expect(result).toContain("GET");

        // Should show URLs (relative path only)
        expect(result).toContain("/auth/login");
        expect(result).toContain("/api/users");

        // Should show variables (comma-separated, no brackets, alphabetically sorted)
        expect(result).toContain("EMAIL, PASSWORD");
        expect(result).toContain("EMAIL, NAME"); // Variables are alphabetically sorted

        // WILL FAIL: --list not implemented yet
      } finally {
        rmSync(tempDir, { recursive: true });
      }
    });
  });

  describe("LIST-03: Multiple files", () => {
    it("testList_MultipleFiles_ShowsFileColumn", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "http-cli-test-"));

      try {
        // Create multiple .http files
        writeFileSync(
          join(tempDir, "api.http"),
          `
### login
POST /auth/login
`
        );

        writeFileSync(
          join(tempDir, "auth.http"),
          `
### refresh
POST /auth/refresh
`
        );

        writeFileSync(
          join(tempDir, "admin.http"),
          `
### delete-user
DELETE /users/{{id}}
`
        );

        const result = execSync(`node ${CLI_PATH} --list`, {
          cwd: tempDir,
          encoding: "utf-8",
        });

        // Should show FILE column when multiple files found (requirements 2.5)
        expect(result).toContain("FILE");
        expect(result).toContain("api.http");
        expect(result).toContain("auth.http");
        expect(result).toContain("admin.http");

        // Should be sorted alphabetically by FILE, then by NAME
        const lines = result.split("\n");
        const apiLine = lines.findIndex((line) => line.includes("api.http"));
        const authLine = lines.findIndex((line) => line.includes("auth.http"));
        const adminLine = lines.findIndex((line) => line.includes("admin.http"));

        expect(adminLine).toBeLessThan(apiLine);
        expect(apiLine).toBeLessThan(authLine);

        // WILL FAIL: --list not implemented yet
      } finally {
        rmSync(tempDir, { recursive: true });
      }
    });
  });

  describe("LIST-04: --list with -f flag", () => {
    it("testList_WithFileFlag_ShowsOnlySpecifiedFile", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "http-cli-test-"));

      try {
        writeFileSync(
          join(tempDir, "api.http"),
          `
### login
POST /auth/login

### get-users
GET /api/users
`
        );

        writeFileSync(
          join(tempDir, "auth.http"),
          `
### refresh
POST /auth/refresh
`
        );

        const result = execSync(`node ${CLI_PATH} --list -f api.http`, {
          cwd: tempDir,
          encoding: "utf-8",
        });

        // Should show only requests from api.http
        expect(result).toContain("login");
        expect(result).toContain("get-users");
        expect(result).not.toContain("refresh");

        // Should NOT show FILE column when using -f (redundant, requirements 2.8)
        expect(result).not.toContain("FILE");

        // WILL FAIL: --list with -f not implemented yet
      } finally {
        rmSync(tempDir, { recursive: true });
      }
    });
  });

  describe("LIST-05: Parse error handling", () => {
    it("testList_ParseError_ShowsWarningContinuesListing", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "http-cli-test-"));

      try {
        // Create valid file
        writeFileSync(
          join(tempDir, "valid.http"),
          `
### login
POST /auth/login
`
        );

        // Create malformed file
        writeFileSync(
          join(tempDir, "broken.http"),
          `
### broken
INVALID_METHOD /bad/url
`
        );

        const result = execSync(`node ${CLI_PATH} --list`, {
          cwd: tempDir,
          encoding: "utf-8",
        });

        // Should show warning to stderr (requirements 2.7)
        // But continue and list valid files
        expect(result).toContain("login");

        // Exit code should be 0 (partial success)
        // WILL FAIL: Error handling not implemented yet
      } finally {
        rmSync(tempDir, { recursive: true });
      }
    });
  });
});
