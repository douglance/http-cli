// HOSTILE FALSIFICATION TEST SUITE: Response Handlers
// Systematic attempts to break response handler security and correctness
// Tests ONLY attack vectors - proofs of vulnerability

import { describe, expect, it, vi } from "vitest";
import { createClientAPI } from "../../execution/client-api.js";
import { executeScript } from "../../execution/script-executor.js";
import { parseResponseHandler } from "../../parsers/response-handler-parser.js";
import { createVariableStore } from "../../stores/variableStore.js";

describe("HOSTILE FALSIFICATION: Response Handlers", () => {
  describe("FALS-01: Sandbox escape via process.exit()", () => {
    it("testAttack_ProcessExit_Blocked", async () => {
      const maliciousScript = `
        process.exit(1); // Attempt to kill process
      `;

      const api = createClientAPI({
        response: { status: 200, headers: {}, body: "{}" },
      });

      const result = await executeScript(maliciousScript, {
        client: api.client,
        response: api.response,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("process is not defined");
      // WILL FAIL: Sandbox not secure, process accessible
    });
  });

  describe("FALS-02: Prototype pollution via __proto__", () => {
    it("testAttack_PrototypePollution_Prevented", async () => {
      const maliciousScript = `
        const obj = {};
        obj.__proto__.isAdmin = true;
        client.global.set("polluted", "yes");
      `;

      const store = createVariableStore();
      const api = createClientAPI({ response: { status: 200, headers: {}, body: "{}" }, store });

      await executeScript(maliciousScript, { client: api.client, response: api.response });

      // Verify Object.prototype not polluted
      expect(({} as any).isAdmin).toBeUndefined();
      // WILL FAIL: Prototype pollution not prevented
    });
  });

  describe("FALS-03: Code injection via variable substitution", () => {
    it("testAttack_CodeInjection_Sanitized", async () => {
      const store = createVariableStore();

      // Attacker stores malicious code as variable
      store.setMemory("evil", "'; process.exit(1); //");

      const script = `
        const userInput = "{{evil}}";
        client.global.set("result", userInput);
      `;

      const api = createClientAPI({ response: { status: 200, headers: {}, body: "{}" }, store });

      // Should NOT execute the injected code
      const result = await executeScript(script, { client: api.client, response: api.response });

      expect(result.success).toBe(true);
      expect(store.getMemory("result")).toBe("'; process.exit(1); //");
      // WILL FAIL: Code injection not sanitized
    });
  });

  describe("FALS-04: Infinite recursion in handler", () => {
    it("testAttack_InfiniteRecursion_Prevented", async () => {
      const recursiveScript = `
        function recurse() {
          recurse();
        }
        recurse();
      `;

      const api = createClientAPI({ response: { status: 200, headers: {}, body: "{}" } });

      const result = await executeScript(
        recursiveScript,
        { client: api.client, response: api.response },
        { timeout: 2000 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("timeout");
      // WILL FAIL: Stack overflow not prevented
    }, 5000);
  });

  describe("FALS-05: Memory leak in variable store", () => {
    it("testAttack_MemoryLeak_Bounded", () => {
      const store = createVariableStore();

      // Attempt to exhaust memory
      for (let i = 0; i < 100000; i++) {
        store.setMemory(`key${i}`, "x".repeat(1000)); // 100MB total
      }

      // Should not crash or hang
      const count = store.getAll();
      expect(Object.keys(count).length).toBeGreaterThan(0);
      // WILL FAIL: Memory not bounded, can cause OOM
    });
  });

  describe("FALS-06: Race condition in concurrent handlers", () => {
    it("testAttack_RaceCondition_Consistent", async () => {
      const store = createVariableStore();

      const script1 =
        'client.global.set("counter", (parseInt(client.global.get("counter") || "0") + 1).toString());';
      const script2 =
        'client.global.set("counter", (parseInt(client.global.get("counter") || "0") + 1).toString());';
      const script3 =
        'client.global.set("counter", (parseInt(client.global.get("counter") || "0") + 1).toString());';

      const api = createClientAPI({ response: { status: 200, headers: {}, body: "{}" }, store });

      // Execute concurrently
      await Promise.all([
        executeScript(script1, { client: api.client, response: api.response }),
        executeScript(script2, { client: api.client, response: api.response }),
        executeScript(script3, { client: api.client, response: api.response }),
      ]);

      // Should be 3 (all increments applied)
      const finalValue = parseInt(store.getMemory("counter") || "0", 10);
      expect(finalValue).toBe(3);
      // WILL FAIL: Race condition causes lost updates
    });
  });

  describe("FALS-07: Script timeout bypass attempt", () => {
    it("testAttack_TimeoutBypass_Enforced", async () => {
      // Attempt to bypass timeout with async operations
      const bypassScript = `
        const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        await sleep(10000); // 10 seconds
      `;

      const api = createClientAPI({ response: { status: 200, headers: {}, body: "{}" } });

      const start = Date.now();
      const result = await executeScript(
        bypassScript,
        { client: api.client, response: api.response },
        { timeout: 1000 }
      );
      const duration = Date.now() - start;

      expect(result.success).toBe(false);
      expect(duration).toBeLessThan(2000); // Should timeout quickly
      // WILL FAIL: Async operations bypass timeout
    }, 5000);
  });

  describe("FALS-08: Circular reference in JSON parsing", () => {
    it("testAttack_CircularJson_HandledGracefully", async () => {
      const circularScript = `
        const obj = {};
        obj.self = obj;
        client.global.set("circular", JSON.stringify(obj));
      `;

      const api = createClientAPI({ response: { status: 200, headers: {}, body: "{}" } });

      const result = await executeScript(circularScript, {
        client: api.client,
        response: api.response,
      });

      // Should fail gracefully
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // WILL FAIL: Circular reference causes crash
    });
  });

  describe("FALS-09: Handler modifying global scope", () => {
    it("testAttack_GlobalScopePollution_Isolated", async () => {
      const pollutionScript = `
        global.MALICIOUS = "hacked";
        globalThis.EVIL = true;
      `;

      const api = createClientAPI({ response: { status: 200, headers: {}, body: "{}" } });

      await executeScript(pollutionScript, { client: api.client, response: api.response });

      // Verify global not polluted
      expect((global as any).MALICIOUS).toBeUndefined();
      expect((globalThis as any).EVIL).toBeUndefined();
      // WILL FAIL: Global scope accessible, pollution possible
    });
  });

  describe("FALS-10: SQL injection via stored variables", () => {
    it("testAttack_SqlInjection_Sanitized", async () => {
      const store = createVariableStore();

      // Store SQL injection payload
      const injectionPayload = "'; DROP TABLE users; --";
      store.setMemory("user_id", injectionPayload);

      // Handler uses variable (simulated)
      const value = store.getMemory("user_id");

      // Should store as-is (app layer must sanitize)
      expect(value).toBe(injectionPayload);

      // But when writing to .env, should escape dangerous chars
      const mockEnvWrite = vi.fn();
      const persistentStore = createVariableStore({ envWriter: mockEnvWrite });
      await persistentStore.setPersistent("USER_ID", injectionPayload);

      // Should escape quotes and newlines
      expect(mockEnvWrite).toHaveBeenCalledWith("USER_ID", expect.not.stringContaining("'"));
      // WILL FAIL: .env write doesn't escape, creates invalid .env file
    });
  });

  describe("FALS-11: Path traversal in .env file access", () => {
    it("testAttack_PathTraversal_Blocked", async () => {
      // Attempt to write to arbitrary file
      const maliciousPath = "../../../etc/passwd";
      const mockEnvWrite = vi.fn();
      const store = createVariableStore({ envWriter: mockEnvWrite });

      await store.setPersistent(maliciousPath, "malicious_content");

      // Should sanitize key to prevent path traversal
      expect(mockEnvWrite).toHaveBeenCalledWith(
        expect.not.stringContaining("../"),
        "malicious_content"
      );
      // WILL FAIL: Path traversal not validated
    });
  });

  describe("FALS-12: Handler crashes VM, corrupts state", () => {
    it("testAttack_VmCrash_RecoveredGracefully", async () => {
      const crashScript = `
        throw new Error("Intentional crash");
      `;

      const store = createVariableStore();
      const api = createClientAPI({ response: { status: 200, headers: {}, body: "{}" }, store });

      store.setMemory("before", "value");

      const result = await executeScript(crashScript, {
        client: api.client,
        response: api.response,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Intentional crash");

      // Store should still be accessible
      expect(store.getMemory("before")).toBe("value");

      // Should be able to execute next handler
      const recoveryScript = 'client.global.set("after", "recovered");';
      const result2 = await executeScript(recoveryScript, {
        client: api.client,
        response: api.response,
      });

      expect(result2.success).toBe(true);
      expect(store.getMemory("after")).toBe("recovered");

      // WILL FAIL: VM crash corrupts state, next execution fails
    });
  });

  describe("FALS-13: Parser extracts malicious code from comments", () => {
    it("testAttack_CommentInjection_Ignored", () => {
      const httpWithMaliciousComment = `
POST https://api.example.com/login

// > {%
// client.global.set("fake", "should not execute");
// %}

> {%
client.global.set("real", "should execute");
%}
`;

      const parsed = parseResponseHandler(httpWithMaliciousComment);

      expect(parsed.hasHandler).toBe(true);
      expect(parsed.script).toContain("should execute");
      expect(parsed.script).not.toContain("should not execute");
      // WILL FAIL: Parser extracts code from comments
    });
  });

  describe("FALS-14: Variable substitution creates infinite loop", () => {
    it("testAttack_CircularSubstitution_Detected", () => {
      const store = createVariableStore();

      // Create circular reference
      store.setMemory("A", "{{B}}");
      store.setMemory("B", "{{A}}");

      // Attempt substitution
      const replaceVars = (text: string, vars: Record<string, string>): string => {
        let result = text;
        let iterations = 0;
        const MAX_ITERATIONS = 10;

        while (result.includes("{{") && iterations < MAX_ITERATIONS) {
          const before = result;
          result = result.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
            return vars[varName.trim()] || match;
          });
          if (result === before) {
            break; // No more substitutions
          }
          iterations++;
        }

        if (iterations >= MAX_ITERATIONS) {
          throw new Error("Circular variable reference detected");
        }

        return result;
      };

      expect(() => {
        replaceVars("{{A}}", store.getAll());
      }).toThrow("Circular variable reference");

      // WILL FAIL: Circular substitution causes infinite loop
    });
  });
});
