// Performance Benchmarks: Response Handler System
// Measures execution time and resource usage

import { describe, expect, it } from "vitest";
import { createClientAPI } from "../../execution/client-api.js";
import { executeScript } from "../../execution/script-executor.js";
import { parseResponseHandler } from "../../parsers/response-handler-parser.js";
import { createVariableStore } from "../../stores/variableStore.js";

describe("Performance: Handler Benchmarks", () => {
  describe("PERF-01: Parse 1KB handler script", () => {
    it("testPerf_Parse1KB_Under5ms", () => {
      const script = "client.global.set('key', 'value');\n".repeat(50); // ~1KB
      const httpText = `
POST https://api.example.com/login

> {%
${script}
%}
`;

      const iterations = 100;
      const start = Date.now();

      for (let i = 0; i < iterations; i++) {
        parseResponseHandler(httpText);
      }

      const duration = Date.now() - start;
      const avgPerParse = duration / iterations;

      expect(avgPerParse).toBeLessThan(5); // <5ms per parse
      // WILL FAIL: Performance not optimized
    });
  });

  describe("PERF-02: Execute 100 handlers sequentially", () => {
    it("testPerf_Execute100Handlers_Under500ms", async () => {
      const store = createVariableStore();
      const script = 'client.global.set("counter", "1");';

      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        const api = createClientAPI({ response: { status: 200, headers: {}, body: "{}" }, store });
        await executeScript(script, { client: api.client, response: api.response });
      }

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500); // <500ms for 100 executions
      // WILL FAIL: Batch execution slow
    });
  });

  describe("PERF-03: Substitute 1000 variables in 100KB body", () => {
    it("testPerf_Substitute1000Vars_Under100ms", () => {
      const store = createVariableStore();

      // Create 1000 variables
      for (let i = 0; i < 1000; i++) {
        store.setMemory(`var${i}`, `value${i}`);
      }

      // Create 100KB body with variable references
      const bodyParts: string[] = [];
      for (let i = 0; i < 1000; i++) {
        bodyParts.push(`"var${i}": "{{var${i}}}"`);
      }
      const largeBody = `{${bodyParts.join(", ")}}`;
      expect(largeBody.length).toBeGreaterThan(100000); // >100KB

      // Measure substitution time
      const replaceVars = (text: string, vars: Record<string, string>): string => {
        return text.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
          return vars[varName.trim()] || match;
        });
      };

      const start = Date.now();
      const substituted = replaceVars(largeBody, store.getAll());
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100); // <100ms
      expect(substituted).toContain("value999");
      expect(substituted).not.toContain("{{var999}}");
      // WILL FAIL: Substitution not optimized for large inputs
    });
  });

  describe("PERF-04: Store 10,000 variables in memory", () => {
    it("testPerf_Store10kVars_Under50ms", () => {
      const store = createVariableStore();

      const start = Date.now();

      for (let i = 0; i < 10000; i++) {
        store.setMemory(`key${i}`, `value${i}`);
      }

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50); // <50ms
      expect(store.getMemory("key9999")).toBe("value9999");
      // WILL FAIL: Store performance poor
    });
  });

  describe("PERF-05: Parse complex JSON response (10MB)", () => {
    it("testPerf_ParseLargeJson_Under200ms", async () => {
      // Create 10MB JSON response
      const items = [];
      for (let i = 0; i < 50000; i++) {
        items.push({
          id: i,
          name: `Item ${i}`,
          description: "A".repeat(100),
        });
      }
      const largeJson = JSON.stringify({ items });
      expect(largeJson.length).toBeGreaterThan(10 * 1024 * 1024); // >10MB

      const api = createClientAPI({
        response: {
          status: 200,
          headers: {},
          body: largeJson,
        },
      });

      const start = Date.now();
      const parsed = api.response.body.json() as { items: unknown[] };
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(200); // <200ms
      expect(parsed.items?.length).toBe(50000);
      // WILL FAIL: JSON parsing slow for large responses
    });
  });

  describe("PERF-06: Concurrent execution of 50 handlers", () => {
    it("testPerf_Concurrent50Handlers_Under1000ms", async () => {
      const store = createVariableStore();
      const script = 'client.global.set("test", "value");';

      const start = Date.now();

      const promises = [];
      for (let i = 0; i < 50; i++) {
        const api = createClientAPI({
          response: { status: 200, headers: {}, body: "{}" },
          store,
        });
        promises.push(executeScript(script, { client: api.client, response: api.response }));
      }

      await Promise.all(promises);

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // <1s for 50 concurrent
      // WILL FAIL: Concurrency not optimized
    });
  });

  describe("PERF-07: Memory usage stability", () => {
    it("testPerf_MemoryStability_NoLeak", async () => {
      const store = createVariableStore();

      // Measure initial memory
      if (global.gc) {
        global.gc();
      }
      const initialMemory = process.memoryUsage().heapUsed;

      // Execute many handlers
      for (let i = 0; i < 1000; i++) {
        const api = createClientAPI({
          response: { status: 200, headers: {}, body: '{"data": "test"}' },
          store,
        });
        const script = 'client.global.set("temp", response.body.json().data);';
        await executeScript(script, { client: api.client, response: api.response });

        // Clear temp variable to allow GC
        store.clearMemory();
      }

      // Measure final memory
      if (global.gc) {
        global.gc();
      }
      await new Promise((resolve) => setTimeout(resolve, 100)); // Let GC run
      const finalMemory = process.memoryUsage().heapUsed;

      const memoryGrowth = finalMemory - initialMemory;
      const growthMB = memoryGrowth / (1024 * 1024);

      // Memory growth should be < 10MB (allowing for some overhead)
      expect(growthMB).toBeLessThan(10);
      // WILL FAIL: Memory leak detected
    });
  });
});
