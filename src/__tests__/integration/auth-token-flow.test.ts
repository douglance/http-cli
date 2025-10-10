// Integration Test: Complete auth token extraction and reuse flow
// Tests parser → executor → store → substitutor integration

import { describe, expect, it } from "vitest";
import { createClientAPI } from "../../execution/client-api.js";
import { executeScript } from "../../execution/script-executor.js";
import { parseResponseHandler } from "../../parsers/response-handler-parser.js";
import { replaceVars } from "../../stores/envStore.js";
import { createVariableStore } from "../../stores/variableStore.js";

describe("Integration: Auth Token Flow", () => {
  describe("INT-01: OAuth token extraction and reuse", () => {
    it("testFlow_LoginExtractUse_WorksEndToEnd", async () => {
      // Step 1: Parse login request with handler
      const loginRequest = `
POST https://api.example.com/oauth/token
Content-Type: application/json

{
  "grant_type": "client_credentials",
  "client_id": "{{CLIENT_ID}}",
  "client_secret": "{{CLIENT_SECRET}}"
}

> {%
client.global.set("access_token", response.body.json().access_token);
client.global.set("expires_in", response.body.json().expires_in);
%}
`;

      const parsed = parseResponseHandler(loginRequest);
      expect(parsed.hasHandler).toBe(true);

      // Step 2: Simulate API response
      const mockResponse = {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: "eyJhbGciOiJIUzI1NiIs...",
          expires_in: 3600,
          token_type: "Bearer",
        }),
      };

      // Step 3: Execute handler with response
      const store = createVariableStore();
      const api = createClientAPI({ response: mockResponse, store });
      const executionResult = await executeScript(parsed.script!, {
        client: api.client,
        response: api.response,
      });

      expect(executionResult.success).toBe(true);

      // Step 4: Verify token stored in memory
      expect(store.getMemory("access_token")).toBe("eyJhbGciOiJIUzI1NiIs...");
      expect(store.getMemory("expires_in")).toBe("3600");

      // Step 5: Use token in next request
      const apiRequest = `
GET https://api.example.com/user/profile
Authorization: Bearer {{access_token}}
`;

      const substituted = replaceVars(apiRequest, store.getAll());
      expect(substituted).toContain("Bearer eyJhbGciOiJIUzI1NiIs...");
      expect(substituted).not.toContain("{{access_token}}");

      // WILL FAIL: End-to-end flow not connected
    });
  });

  describe("INT-02: Token expiry and refresh", () => {
    it("testFlow_TokenExpires_RefreshesAutomatically", async () => {
      const store = createVariableStore();

      // Initial token with expiry
      store.setMemory("access_token", "old_token");
      store.setMemory("refresh_token", "refresh_abc");
      store.setMemory("expires_at", String(Date.now() - 1000)); // Expired

      // Refresh request
      const refreshRequest = `
POST https://api.example.com/oauth/refresh
Content-Type: application/json

{
  "grant_type": "refresh_token",
  "refresh_token": "{{refresh_token}}"
}

> {%
if (response.status === 200) {
  client.global.set("access_token", response.body.json().access_token);
  client.global.set("expires_at", String(Date.now() + 3600000));
}
%}
`;

      const parsed = parseResponseHandler(refreshRequest);
      const mockResponse = {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: "new_token" }),
      };

      const api = createClientAPI({ response: mockResponse, store });
      await executeScript(parsed.script!, { client: api.client, response: api.response });

      expect(store.getMemory("access_token")).toBe("new_token");
      expect(Number(store.getMemory("expires_at"))).toBeGreaterThan(Date.now());

      // WILL FAIL: Refresh logic not implemented
    });
  });

  describe("INT-03: Multi-request auth chain", () => {
    it("testFlow_ThreeStepAuth_ChainsCorrectly", async () => {
      const store = createVariableStore();

      // Step 1: Get CSRF token
      const csrfRequest = `
GET https://api.example.com/csrf

> {%
client.global.set("csrf_token", response.headers.get("X-CSRF-Token"));
%}
`;

      const csrfResponse = {
        status: 200,
        headers: { "X-CSRF-Token": "csrf123" },
        body: "",
      };

      const csrfParsed = parseResponseHandler(csrfRequest);
      const csrfApi = createClientAPI({ response: csrfResponse, store });
      await executeScript(csrfParsed.script!, {
        client: csrfApi.client,
        response: csrfApi.response,
      });

      expect(store.getMemory("csrf_token")).toBe("csrf123");

      // Step 2: Login with CSRF
      const loginRequest = `
POST https://api.example.com/login
X-CSRF-Token: {{csrf_token}}
Content-Type: application/json

{"username": "user", "password": "pass"}

> {%
client.global.set("session_id", response.body.json().session_id);
%}
`;

      const loginResponse = {
        status: 200,
        headers: {},
        body: JSON.stringify({ session_id: "sess_abc" }),
      };

      const loginParsed = parseResponseHandler(loginRequest);
      const loginApi = createClientAPI({ response: loginResponse, store });
      await executeScript(loginParsed.script!, {
        client: loginApi.client,
        response: loginApi.response,
      });

      expect(store.getMemory("session_id")).toBe("sess_abc");

      // Step 3: Access protected resource
      const apiCall = `
GET https://api.example.com/data
Cookie: session_id={{session_id}}
X-CSRF-Token: {{csrf_token}}
`;

      const substituted = replaceVars(apiCall, store.getAll());
      expect(substituted).toContain("session_id=sess_abc");
      expect(substituted).toContain("X-CSRF-Token: csrf123");

      // WILL FAIL: Multi-step chain orchestration missing
    });
  });

  describe("INT-04: Store token, use in next request", () => {
    it("testFlow_StoreAndRetrieve_Immediate", async () => {
      const store = createVariableStore();
      const api = createClientAPI({
        response: {
          status: 200,
          headers: {},
          body: JSON.stringify({ token: "xyz789" }),
        },
        store,
      });

      // Store
      const script = 'client.global.set("api_key", response.body.json().token);';
      await executeScript(script, { client: api.client, response: api.response });

      // Retrieve immediately
      const retrieved = store.getMemory("api_key");

      expect(retrieved).toBe("xyz789");
      // WILL FAIL: Immediate consistency not guaranteed (race condition possible)
    });
  });

  describe("INT-05: Handler saves to .env, survives restart", () => {
    it("testFlow_PersistentStorage_SurvivesRestart", async () => {
      const envData: Record<string, string> = {};
      const mockEnvWrite = (key: string, value: string) => {
        envData[key] = value;
      };

      const store = createVariableStore({ envWriter: mockEnvWrite });
      const api = createClientAPI({
        response: {
          status: 200,
          headers: {},
          body: JSON.stringify({ refresh_token: "long_lived_token" }),
        },
        store,
      });

      // Save to persistent storage
      const script = 'client.environment.set("REFRESH_TOKEN", response.body.json().refresh_token);';
      await executeScript(script, { client: api.client, response: api.response });

      expect(envData.REFRESH_TOKEN).toBe("long_lived_token");

      // Simulate restart: create new store
      const newStore = createVariableStore({
        envData, // Load from persisted data
      });

      expect(newStore.getPersistent("REFRESH_TOKEN")).toBe("long_lived_token");

      // WILL FAIL: Persistent storage not implemented correctly
    });
  });

  describe("INT-06: Handler extracts nested JSON token", () => {
    it("testFlow_NestedJson_ExtractsCorrectly", async () => {
      const store = createVariableStore();
      const api = createClientAPI({
        response: {
          status: 200,
          headers: {},
          body: JSON.stringify({
            data: {
              auth: {
                credentials: {
                  access_token: "deeply_nested_token",
                },
              },
            },
          }),
        },
        store,
      });

      const script =
        'client.global.set("token", response.body.json().data.auth.credentials.access_token);';
      await executeScript(script, { client: api.client, response: api.response });

      expect(store.getMemory("token")).toBe("deeply_nested_token");

      // WILL FAIL: Deep property access not tested/supported
    });
  });
});
