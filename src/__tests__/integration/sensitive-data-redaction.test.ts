// Integration tests for sensitive data redaction
// Tests security requirements per CLI-REQUIREMENTS.md section 12.1

import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const CLI_PATH = resolve(__dirname, "../../../dist/cli.js");

describe("Integration: Sensitive data redaction", () => {
  describe("SEC-01: Authorization header redaction", () => {
    it("testRedaction_BearerToken_ShowsPrefix", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "http-cli-test-"));

      try {
        const httpContent = `
### test-request
GET https://jsonplaceholder.typicode.com/users/1
Authorization: Bearer sk-1234567890abcdefghijklmnopqrstuvwxyz
`;
        writeFileSync(join(tempDir, "api.http"), httpContent);

        const result = execSync(`node ${CLI_PATH} test-request`, {
          cwd: tempDir,
          encoding: "utf-8",
        });

        const json = JSON.parse(result);

        // Authorization value should be redacted (requirements 12.1)
        expect(json.request.headers.Authorization).toBe("Bearer sk-...");

        // But actual request should still work (not redacted in real HTTP)
        expect(json.response.status).toBe(200);

        // WILL FAIL: Redaction not implemented yet
      } finally {
        rmSync(tempDir, { recursive: true });
      }
    });

    it("testRedaction_BasicAuth_ShowsPrefix", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "http-cli-test-"));

      try {
        const httpContent = `
### test-request
GET https://jsonplaceholder.typicode.com/users/1
Authorization: Basic dXNlcm5hbWU6cGFzc3dvcmQ=
`;
        writeFileSync(join(tempDir, "api.http"), httpContent);

        const result = execSync(`node ${CLI_PATH} test-request`, {
          cwd: tempDir,
          encoding: "utf-8",
        });

        const json = JSON.parse(result);

        // Basic auth should be redacted
        expect(json.request.headers.Authorization).toBe("Basic dX...");
        expect(json.response.status).toBe(200);
      } finally {
        rmSync(tempDir, { recursive: true });
      }
    });

    it("testRedaction_ApiKey_ShowsPrefix", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "http-cli-test-"));

      try {
        const httpContent = `
### test-request
GET https://jsonplaceholder.typicode.com/users/1
X-API-Key: test_key_1234567890abcdefghijklmnop
`;
        writeFileSync(join(tempDir, "api.http"), httpContent);

        const result = execSync(`node ${CLI_PATH} test-request`, {
          cwd: tempDir,
          encoding: "utf-8",
        });

        const json = JSON.parse(result);

        // API key header should be redacted
        expect(json.request.headers["X-API-Key"]).toBe("test_...");
        expect(json.response.status).toBe(200);
      } finally {
        rmSync(tempDir, { recursive: true });
      }
    });
  });

  describe("SEC-02: Query parameter redaction", () => {
    it("testRedaction_TokenInQuery_RedactsValue", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "http-cli-test-"));

      try {
        const httpContent = `
### test-request
GET https://jsonplaceholder.typicode.com/users/1?token=secret123456&id=5
`;
        writeFileSync(join(tempDir, "api.http"), httpContent);

        const result = execSync(`node ${CLI_PATH} test-request`, {
          cwd: tempDir,
          encoding: "utf-8",
        });

        const json = JSON.parse(result);

        // URL should have token redacted (requirements 12.1)
        expect(json.request.url).toBe(
          "https://jsonplaceholder.typicode.com/users/1?token=***&id=5"
        );

        // But actual request should include real token (not redacted in HTTP)
        expect(json.response.status).toBe(200);
      } finally {
        rmSync(tempDir, { recursive: true });
      }
    });

    it("testRedaction_ApiKeyInQuery_RedactsValue", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "http-cli-test-"));

      try {
        const httpContent = `
### test-request
GET https://jsonplaceholder.typicode.com/users/1?api_key=1234567890&name=test
`;
        writeFileSync(join(tempDir, "api.http"), httpContent);

        const result = execSync(`node ${CLI_PATH} test-request`, {
          cwd: tempDir,
          encoding: "utf-8",
        });

        const json = JSON.parse(result);

        // api_key should be redacted
        expect(json.request.url).toBe(
          "https://jsonplaceholder.typicode.com/users/1?api_key=***&name=test"
        );
      } finally {
        rmSync(tempDir, { recursive: true });
      }
    });

    it("testRedaction_PasswordInQuery_RedactsValue", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "http-cli-test-"));

      try {
        const httpContent = `
### test-request
GET https://jsonplaceholder.typicode.com/users/1?password=mypassword123&username=john
`;
        writeFileSync(join(tempDir, "api.http"), httpContent);

        const result = execSync(`node ${CLI_PATH} test-request`, {
          cwd: tempDir,
          encoding: "utf-8",
        });

        const json = JSON.parse(result);

        // password should be redacted
        expect(json.request.url).toBe(
          "https://jsonplaceholder.typicode.com/users/1?password=***&username=john"
        );
      } finally {
        rmSync(tempDir, { recursive: true });
      }
    });

    it("testRedaction_SecretInQuery_RedactsValue", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "http-cli-test-"));

      try {
        const httpContent = `
### test-request
GET https://jsonplaceholder.typicode.com/users/1?client_secret=abc123xyz&user=5
`;
        writeFileSync(join(tempDir, "api.http"), httpContent);

        const result = execSync(`node ${CLI_PATH} test-request`, {
          cwd: tempDir,
          encoding: "utf-8",
        });

        const json = JSON.parse(result);

        // client_secret should be redacted
        expect(json.request.url).toBe(
          "https://jsonplaceholder.typicode.com/users/1?client_secret=***&user=5"
        );
      } finally {
        rmSync(tempDir, { recursive: true });
      }
    });

    it("testRedaction_MultipleSecrets_RedactsAll", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "http-cli-test-"));

      try {
        const httpContent = `
### test-request
GET https://jsonplaceholder.typicode.com/users/1?token=abc&api_key=xyz&id=5&secret=def
`;
        writeFileSync(join(tempDir, "api.http"), httpContent);

        const result = execSync(`node ${CLI_PATH} test-request`, {
          cwd: tempDir,
          encoding: "utf-8",
        });

        const json = JSON.parse(result);

        // All sensitive params redacted, normal params visible
        expect(json.request.url).toBe(
          "https://jsonplaceholder.typicode.com/users/1?token=***&api_key=***&id=5&secret=***"
        );
      } finally {
        rmSync(tempDir, { recursive: true });
      }
    });
  });

  describe("SEC-03: No redaction in actual HTTP requests", () => {
    it("testRedaction_OnlyInOutput_NotInHttp", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "http-cli-test-"));

      try {
        // Use httpbin.org to echo back headers (proves we sent real values)
        const httpContent = `
### test-request
GET https://httpbin.org/headers
Authorization: Bearer test-token-12345
`;
        writeFileSync(join(tempDir, "api.http"), httpContent);

        const result = execSync(`node ${CLI_PATH} test-request`, {
          cwd: tempDir,
          encoding: "utf-8",
        });

        const json = JSON.parse(result);

        // Output should be redacted
        expect(json.request.headers.Authorization).toBe("Bearer test-...");

        // But server received full token (check response body)
        const responseBody = JSON.parse(json.response.body);
        expect(responseBody.headers.Authorization).toBe("Bearer test-token-12345");
      } finally {
        rmSync(tempDir, { recursive: true });
      }
    });
  });

  describe("SEC-04: Case-insensitive matching", () => {
    it("testRedaction_CaseInsensitive_RedactsAll", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "http-cli-test-"));

      try {
        const httpContent = `
### test-request
GET https://jsonplaceholder.typicode.com/users/1?TOKEN=abc&Api_Key=xyz&PASSWORD=def&Client_Secret=ghi
`;
        writeFileSync(join(tempDir, "api.http"), httpContent);

        const result = execSync(`node ${CLI_PATH} test-request`, {
          cwd: tempDir,
          encoding: "utf-8",
        });

        const json = JSON.parse(result);

        // All variations should be redacted (case-insensitive)
        expect(json.request.url).toContain("TOKEN=***");
        expect(json.request.url).toContain("Api_Key=***");
        expect(json.request.url).toContain("PASSWORD=***");
        expect(json.request.url).toContain("Client_Secret=***");
      } finally {
        rmSync(tempDir, { recursive: true });
      }
    });
  });
});
