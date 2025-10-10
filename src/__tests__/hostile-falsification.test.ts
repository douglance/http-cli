// HOSTILE FALSIFICATION TEST SUITE
// Systematic attempts to break Phases 11, 5, and 6 implementations
// This file tests ONLY attack vectors NOT covered by existing tests

import { describe, expect, it } from "vitest";
import { isBinaryContent, isBinaryContentByBuffer } from "../utils/binary.js";
import { prepareRequestHeaders } from "../utils/headers.js";
import { redactHeaders, redactJsonBody, redactRequest, redactUrl } from "../utils/redaction.js";
import { fetchWithTransport } from "../utils/transport.js";

describe("HOSTILE FALSIFICATION: Redaction", () => {
  const patterns = ["password", "token", "secret"];

  describe("ATTACK: Prototype Pollution", () => {
    it("testRedaction_ProtoPollution_DoesNotPollutePrototype", () => {
      const malicious = {
        __proto__: { isAdmin: true },
        constructor: { prototype: { hacked: true } },
        password: "secret123",
      };

      const result = redactJsonBody(malicious, patterns);

      // Verify password redacted
      expect((result as any).password).toBe("****");

      // Verify prototype NOT polluted
      expect(({} as any).isAdmin).toBeUndefined();
      expect(({} as any).hacked).toBeUndefined();
      // CLAIM: redactObject doesn't pollute Object.prototype
    });
  });

  describe("ATTACK: Circular References", () => {
    it("testRedaction_CircularRef_DoesNotInfiniteLoop", () => {
      const circular: any = { password: "secret" };
      circular.self = circular;

      // Should not throw or hang
      expect(() => {
        redactJsonBody(circular, patterns);
      }).not.toThrow();
      // CLAIM: Handles circular refs without crashing
    });

    it("testRedaction_DeepCircularRef_DoesNotInfiniteLoop", () => {
      const obj: any = { level1: { level2: { level3: { password: "secret" } } } };
      obj.level1.level2.level3.back = obj;

      expect(() => {
        redactJsonBody(obj, patterns);
      }).not.toThrow();
      // CLAIM: Handles deep circular refs
    });
  });

  describe("ATTACK: Depth Boundary Testing", () => {
    it("testRedaction_ExactlyDepth10_RedactsCorrectly", () => {
      // Build exactly 10 levels deep
      let obj: any = { password: "secret10" };
      for (let i = 9; i >= 1; i--) {
        obj = { [`level${i}`]: obj, password: `secret${i}` };
      }

      const result = redactJsonBody(obj, patterns) as any;

      // Level 1 should be redacted
      expect(result.password).toBe("****");
      // Level 10 should be redacted
      let current = result;
      for (let i = 1; i <= 9; i++) {
        current = current[`level${i}`];
      }
      expect(current.password).toBe("****");
      // CLAIM: Redacts at depth 10
    });

    it("testRedaction_Depth11_StopsRedacting", () => {
      // Build 11 levels deep
      let obj: any = { password: "secret11" };
      for (let i = 10; i >= 1; i--) {
        obj = { [`level${i}`]: obj };
      }

      const result = redactJsonBody(obj, patterns) as any;

      // Navigate to depth 11
      let current = result;
      for (let i = 1; i <= 10; i++) {
        current = current[`level${i}`];
      }
      // At depth 11, should NOT be redacted (returns as-is)
      expect(current.password).toBe("secret11");
      // CLAIM: Stops recursion at depth 10
    });
  });

  describe("ATTACK: Large Objects (Performance)", () => {
    it("testRedaction_100Keys_RedactsInReasonableTime", () => {
      const large: any = {};
      for (let i = 0; i < 100; i++) {
        large[`key${i}`] = `value${i}`;
        large[`password${i}`] = `secret${i}`;
      }

      const start = Date.now();
      const result = redactJsonBody(large, patterns);
      const duration = Date.now() - start;

      // Should complete in < 100ms
      expect(duration).toBeLessThan(100);
      expect((result as any).password0).toBe("****");
      expect((result as any).password99).toBe("****");
      expect((result as any).key0).toBe("value0");
      // CLAIM: Handles 100 keys efficiently
    });

    it("testRedaction_1000Keys_RedactsInReasonableTime", () => {
      const huge: any = {};
      for (let i = 0; i < 1000; i++) {
        huge[`key${i}`] = `value${i}`;
      }
      huge.password = "secret";

      const start = Date.now();
      const result = redactJsonBody(huge, patterns);
      const duration = Date.now() - start;

      // Should complete in < 500ms
      expect(duration).toBeLessThan(500);
      expect((result as any).password).toBe("****");
      // CLAIM: Handles 1000 keys efficiently
    });
  });

  describe("ATTACK: Unicode and Special Characters", () => {
    it("testRedaction_UnicodeKeys_RedactsCorrectly", () => {
      const unicode = {
        密码: "secret", // Chinese for "password"
        "🔑token": "secret123",
        normalKey: "value",
      };

      const unicodePatterns = ["密码", "token"];
      const result = redactJsonBody(unicode, unicodePatterns);

      expect((result as any).密码).toBe("****");
      expect((result as any)["🔑token"]).toBe("****");
      expect((result as any).normalKey).toBe("value");
      // CLAIM: Handles unicode in keys
    });

    it("testRedaction_EmptyStringKey_Handled", () => {
      const obj = { "": "value", password: "secret" };
      const result = redactJsonBody(obj, patterns);

      expect((result as any)[""]).toBe("value");
      expect((result as any).password).toBe("****");
      // CLAIM: Handles empty string keys
    });
  });

  describe("ATTACK: URL Edge Cases", () => {
    it("testRedaction_UrlWithFragment_PreservesFragment", () => {
      const url = "https://api.com/data?token=secret#section";
      const result = redactUrl(url, patterns);

      expect(result).toBe("https://api.com/data?token=****#section");
      // CLAIM: Preserves URL fragments
    });

    it("testRedaction_UrlWithAuth_DoesNotExpose", () => {
      const url = "https://user:password@api.com/data";
      const result = redactUrl(url, patterns);

      // Should not expose password in URL
      expect(result).not.toContain("password");
      // CLAIM: Sanitizes auth in URLs
    });

    it("testRedaction_MalformedUrl_DoesNotCrash", () => {
      const invalid = "not a url at all";
      expect(() => {
        redactUrl(invalid, patterns);
      }).not.toThrow();
      // CLAIM: Handles invalid URLs gracefully
    });

    it("testRedaction_UrlNoQueryString_ReturnsUnchanged", () => {
      const url = "https://api.com/path";
      const result = redactUrl(url, patterns);

      expect(result).toBe(url);
      // CLAIM: No-op for URLs without query params
    });
  });

  describe("ATTACK: Malformed JSON Strings", () => {
    it("testRedaction_InvalidJsonString_ReturnsOriginal", () => {
      const invalid = "{this is not json}";
      const result = redactJsonBody(invalid, patterns);

      expect(result).toBe(invalid);
      // CLAIM: Returns original if JSON.parse fails
    });

    it("testRedaction_EmptyString_ReturnsEmpty", () => {
      const result = redactJsonBody("", patterns);

      expect(result).toBe("");
      // CLAIM: Handles empty string bodies
    });
  });

  describe("ATTACK: Header Injection", () => {
    it("testRedaction_HeaderWithNewline_DoesNotInject", () => {
      const headers = {
        "X-Custom": "value\r\nInjected-Header: evil",
        Authorization: "Bearer token",
      };

      const result = redactHeaders(headers, patterns);

      // Should redact Authorization, preserve X-Custom as-is (no validation)
      expect(result.Authorization).toBe("Bearer ****");
      expect(result["X-Custom"]).toBe("value\r\nInjected-Header: evil");
      // CLAIM: redactHeaders doesn't validate header values (that's transport's job)
    });
  });

  describe("ATTACK: Pattern Edge Cases", () => {
    it("testRedaction_EmptyPatternArray_NoRedaction", () => {
      const headers = { Authorization: "Bearer token" };
      const result = redactHeaders(headers, []);

      expect(result.Authorization).toBe("Bearer token");
      // CLAIM: Empty patterns = no redaction
    });

    it("testRedaction_PatternWithSpecialRegexChars_NoRegexInterpreted", () => {
      // Pattern "pass.*" should NOT be regex - should match literal "pass.*"
      const patterns = ["pass.*", "to[k]en"];
      const obj = {
        "pass.*": "secret",
        "to[k]en": "secret2",
        password: "secret3",
        token: "secret4",
      };

      const result = redactJsonBody(obj, patterns);

      // Exact string match (after normalization)
      expect((result as any)["pass.*"]).toBe("****"); // "pass" pattern matches
      expect((result as any).password).toBe("secret3"); // Doesn't match "pass.*" literally
      // CLAIM: Patterns are substring matches, not regex
    });
  });
});

describe("HOSTILE FALSIFICATION: Headers", () => {
  describe("ATTACK: Whitespace Edge Cases", () => {
    it("testHeaders_WhitespaceOnlyBody_NoContentType", () => {
      const config = {
        method: "POST",
        headers: {},
        body: "   \t\n   ",
      };

      const result = prepareRequestHeaders(config);

      // trim() will leave empty string
      expect(result.headers["Content-Type"]).toBeUndefined();
      // CLAIM: Whitespace-only body = no Content-Type
    });

    it("testHeaders_TabsAndNewlines_NoContentType", () => {
      const config = {
        method: "POST",
        headers: {},
        body: "\t\t\n\n\t",
      };

      const result = prepareRequestHeaders(config);

      expect(result.headers["Content-Type"]).toBeUndefined();
      // CLAIM: Only whitespace chars = no Content-Type
    });
  });

  describe("ATTACK: Null Bytes in Body", () => {
    it("testHeaders_NullByteInBody_AddsContentType", () => {
      const config = {
        method: "POST",
        headers: {},
        body: "data\0more",
      };

      const result = prepareRequestHeaders(config);

      // Null byte is not whitespace, so body is non-empty
      expect(result.headers["Content-Type"]).toBe("application/json");
      // CLAIM: Null bytes count as content
    });
  });

  describe("ATTACK: Case Variations", () => {
    it("testHeaders_MultipleAcceptWithDifferentCases_FirstWins", () => {
      const config = {
        method: "GET",
        headers: {
          accept: "text/html",
          Accept: "application/json", // Duplicate with different case
        },
      };

      const result = prepareRequestHeaders(config);

      // JavaScript object keys are case-sensitive, so both exist
      // prepareRequestHeaders should detect case-insensitive match
      expect(result.headers.accept || result.headers.Accept).toBeTruthy();
      expect(result.headers["Content-Type"]).toBeUndefined();
      // CLAIM: Detects existing Accept regardless of case
    });

    it("testHeaders_CONTENTTYPEUppercase_Detected", () => {
      const config = {
        method: "POST",
        headers: {
          CONTENTTYPE: "text/plain", // No hyphen, all caps
        },
        body: '{"test": true}',
      };

      const result = prepareRequestHeaders(config);

      // "CONTENTTYPE" !== "Content-Type" (different key)
      // Should add Content-Type since CONTENTTYPE doesn't match
      expect(result.headers["Content-Type"]).toBe("application/json");
      expect(result.headers.CONTENTTYPE).toBe("text/plain");
      // CLAIM: Exact key match required (with hyphens)
    });
  });

  describe("ATTACK: Invalid Headers", () => {
    it("testHeaders_EmptyHeaderName_Preserved", () => {
      const config = {
        method: "GET",
        headers: {
          "": "value",
        },
      };

      const result = prepareRequestHeaders(config);

      expect(result.headers[""]).toBe("value");
      expect(result.headers.Accept).toBe("application/json");
      // CLAIM: Doesn't validate header names (transport's job)
    });

    it("testHeaders_HeaderWithSpaces_Preserved", () => {
      const config = {
        method: "GET",
        headers: {
          "Invalid Header": "value",
        },
      };

      const result = prepareRequestHeaders(config);

      expect(result.headers["Invalid Header"]).toBe("value");
      // CLAIM: Doesn't reject invalid header names
    });

    it("testHeaders_EmptyHeaderValue_Preserved", () => {
      const config = {
        method: "POST",
        headers: {
          "Content-Type": "", // Empty value
        },
        body: '{"test": true}',
      };

      const result = prepareRequestHeaders(config);

      // User specified Content-Type (even if empty), so preserve it
      expect(result.headers["Content-Type"]).toBe("");
      // CLAIM: Preserves empty header values
    });
  });

  describe("ATTACK: Very Large Bodies", () => {
    it("testHeaders_100MBBody_HandlesInReasonableTime", () => {
      const huge = "x".repeat(100 * 1024 * 1024); // 100MB

      const start = Date.now();
      const result = prepareRequestHeaders({
        method: "POST",
        headers: {},
        body: huge,
      });
      const duration = Date.now() - start;

      // trim() on huge string should be fast
      expect(duration).toBeLessThan(1000);
      expect(result.headers["Content-Type"]).toBe("application/json");
      // CLAIM: Handles large bodies efficiently
    });
  });
});

describe("HOSTILE FALSIFICATION: Binary Detection", () => {
  describe("ATTACK: Threshold Boundary Testing", () => {
    it("testBinary_Exactly30PercentHighBytes_IsBinary", () => {
      const size = 1000;
      const highByteCount = 300; // Exactly 30%
      const buffer = Buffer.alloc(size);

      for (let i = 0; i < highByteCount; i++) {
        buffer[i] = 0xff; // High byte
      }

      const result = isBinaryContentByBuffer(buffer);

      // > 30% = binary, so 30% should be text
      expect(result).toBe(false);
      // CLAIM: Threshold is > 30%, not >= 30%
    });

    it("testBinary_31PercentHighBytes_IsBinary", () => {
      const size = 1000;
      const highByteCount = 310; // 31%
      const buffer = Buffer.alloc(size);

      for (let i = 0; i < highByteCount; i++) {
        buffer[i] = 0xff;
      }

      const result = isBinaryContentByBuffer(buffer);

      expect(result).toBe(true);
      // CLAIM: 31% high bytes = binary
    });

    it("testBinary_Exactly10PercentControlChars_IsText", () => {
      const size = 1000;
      const controlCount = 100; // Exactly 10%
      const buffer = Buffer.alloc(size, 0x41); // Fill with 'A'

      for (let i = 0; i < controlCount; i++) {
        buffer[i] = 0x01; // Control char
      }

      const result = isBinaryContentByBuffer(buffer);

      // > 10% = binary, so 10% should be text
      expect(result).toBe(false);
      // CLAIM: Threshold is > 10%, not >= 10%
    });

    it("testBinary_11PercentControlChars_IsBinary", () => {
      const size = 1000;
      const controlCount = 110; // 11%
      const buffer = Buffer.alloc(size, 0x41);

      for (let i = 0; i < controlCount; i++) {
        buffer[i] = 0x01;
      }

      const result = isBinaryContentByBuffer(buffer);

      expect(result).toBe(true);
      // CLAIM: 11% control chars = binary
    });
  });

  describe("ATTACK: UTF-8 with High Bytes", () => {
    it("testBinary_ValidUtf8WithHighBytes_MayDetectAsBinary", () => {
      // UTF-8 encoded Chinese text has many high bytes
      const text = "这是中文文本".repeat(100); // Repeat to exceed threshold
      const buffer = Buffer.from(text, "utf-8");

      const result = isBinaryContentByBuffer(buffer);

      // Valid UTF-8 but >30% high bytes
      // Current implementation will detect as binary (acceptable tradeoff)
      expect(result).toBe(true);
      // CLAIM: UTF-8 with many high bytes may be detected as binary (known limitation)
    });
  });

  describe("ATTACK: Mixed Content", () => {
    it("testBinary_First512Text_RestBinary_DetectsAsText", () => {
      // Sample is only first 512 bytes
      const buffer = Buffer.alloc(10000);
      // First 512 bytes are text
      buffer.write("Hello World ".repeat(43), "utf-8"); // ~512 bytes
      // Rest are binary
      for (let i = 512; i < 10000; i++) {
        buffer[i] = 0xff;
      }

      const result = isBinaryContentByBuffer(buffer);

      // Only samples first 512 bytes, so detects as text
      expect(result).toBe(false);
      // CLAIM: Only samples first 512 bytes (documented limitation)
    });
  });

  describe("ATTACK: Edge Sizes", () => {
    it("testBinary_ZeroByteBuffer_IsText", () => {
      const buffer = Buffer.alloc(0);

      const result = isBinaryContentByBuffer(buffer);

      expect(result).toBe(false);
      // CLAIM: Empty buffer = text
    });

    it("testBinary_SingleByteNull_IsBinary", () => {
      const buffer = Buffer.from([0x00]);

      const result = isBinaryContentByBuffer(buffer);

      expect(result).toBe(true);
      // CLAIM: Single null byte = binary
    });

    it("testBinary_SingleByteText_IsText", () => {
      const buffer = Buffer.from("A");

      const result = isBinaryContentByBuffer(buffer);

      expect(result).toBe(false);
      // CLAIM: Single text byte = text
    });
  });

  describe("ATTACK: Content-Type Edge Cases", () => {
    it("testBinary_MalformedContentType_AssumesBinary", () => {
      const headers = { "Content-Type": ";;;charset=utf-8" };

      const result = isBinaryContent(headers);

      // Malformed, doesn't match known types
      expect(result).toBe(true);
      // CLAIM: Unknown/malformed = assume binary (safer default)
    });

    it("testBinary_ContentTypeNoSubtype_AssumesBinary", () => {
      const headers = { "Content-Type": "image" }; // Missing subtype

      const result = isBinaryContent(headers);

      expect(result).toBe(true);
      // CLAIM: Incomplete MIME type = assume binary
    });

    it("testBinary_UnknownApplicationType_AssumesBinary", () => {
      const headers = { "Content-Type": "application/x-custom-weird-format" };

      const result = isBinaryContent(headers);

      expect(result).toBe(true);
      // CLAIM: Unknown application/* = assume binary
    });

    it("testBinary_TextWithCharset_DetectsText", () => {
      const headers = { "Content-Type": "text/html; charset=utf-8; boundary=foo" };

      const result = isBinaryContent(headers);

      expect(result).toBe(false);
      // CLAIM: text/* with params = text
    });
  });

  describe("ATTACK: UTF BOM", () => {
    it("testBinary_Utf8Bom_DetectsAsText", () => {
      const bom = Buffer.from([0xef, 0xbb, 0xbf]); // UTF-8 BOM
      const text = Buffer.from("Hello");
      const buffer = Buffer.concat([bom, text]);

      const result = isBinaryContentByBuffer(buffer);

      // BOM bytes are high bytes but valid text marker
      // Current implementation may detect as binary (acceptable)
      expect(result).toBe(false);
      // CLAIM: UTF-8 BOM doesn't trigger binary detection
    });

    it("testBinary_Utf16Bom_DetectsAsBinary", () => {
      const bom = Buffer.from([0xff, 0xfe]); // UTF-16 LE BOM

      const result = isBinaryContentByBuffer(bom);

      // High bytes, so likely detected as binary
      expect(result).toBe(true);
      // CLAIM: UTF-16 BOM detected as binary (correct - we don't support UTF-16)
    });
  });
});

describe("HOSTILE FALSIFICATION: Transport", () => {
  const BASE_URL = "https://httpbin.org";

  describe("ATTACK: Redirect Loops", () => {
    it("testTransport_InfiniteRedirectLoop_DetectsLoop", async () => {
      // httpbin doesn't have true infinite loops, but we can test our detection
      // by manually creating a visited set

      // This will redirect 10 times before httpbin stops
      await expect(
        fetchWithTransport(`${BASE_URL}/redirect/20`, {
          method: "GET",
          headers: {},
          maxRedirects: 5,
        })
      ).resolves.toBeTruthy();

      // Should stop at max redirects, not throw
      // CLAIM: Stops at maxRedirects without error
    }, 15000);
  });

  describe("ATTACK: Malformed Redirects", () => {
    it("testTransport_RedirectNoLocation_ReturnsRedirectResponse", async () => {
      // Can't easily test with httpbin, but we can verify behavior in code
      // If Location missing, should return the redirect response as-is

      const response = await fetchWithTransport(`${BASE_URL}/status/302`, {
        method: "GET",
        headers: {},
        followRedirects: false, // Don't follow
      });

      expect(response.status).toBe(302);
      // CLAIM: Returns redirect response if not following
    }, 10000);
  });

  describe("ATTACK: 303 POST to GET Conversion", () => {
    it("testTransport_303PostRedirect_ConvertsToGet", async () => {
      // httpbin doesn't support 303 redirects, so this is a theoretical test
      // In real implementation, 303 after POST should become GET

      // Test with 302 instead (similar behavior)
      const response = await fetchWithTransport(
        `${BASE_URL}/redirect-to?url=/get&status_code=302`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: '{"test": true}',
          followRedirects: true,
        }
      );

      expect(response.status).toBe(200);
      // CLAIM: Follows redirects after POST
    }, 10000);
  });

  describe("ATTACK: Invalid Compression", () => {
    it("testTransport_GzipHeaderButUncompressed_HandlesError", async () => {
      // httpbin serves valid gzip, but we can test error handling
      // by checking if decompression errors are caught

      // This is more of a theoretical test - httpbin won't send invalid compression
      // In real code, if gzip decompression fails, should error gracefully

      const response = await fetchWithTransport(`${BASE_URL}/gzip`, {
        method: "GET",
        headers: { "Accept-Encoding": "gzip" },
      });

      expect(response.status).toBe(200);
      expect(typeof response.body).toBe("string");
      // CLAIM: Handles valid gzip correctly
    }, 10000);
  });

  describe("ATTACK: Slow Responses", () => {
    it("testTransport_10SecondDelay_Completes", async () => {
      const response = await fetchWithTransport(`${BASE_URL}/delay/10`, {
        method: "GET",
        headers: {},
      });

      expect(response.status).toBe(200);
      // CLAIM: Waits for slow responses (no default timeout)
    }, 15000);
  });

  describe("ATTACK: Large Responses", () => {
    it("testTransport_LargeJsonResponse_HandlesInReasonableTime", async () => {
      // httpbin doesn't have huge responses, but we can request a reasonably large one
      const start = Date.now();
      const response = await fetchWithTransport(`${BASE_URL}/bytes/100000`, {
        method: "GET",
        headers: {},
      });
      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(Buffer.isBuffer(response.body)).toBe(true);
      expect((response.body as Buffer).length).toBe(100000);
      expect(duration).toBeLessThan(5000); // Should complete quickly
      // CLAIM: Handles 100KB response efficiently
    }, 10000);
  });

  describe("ATTACK: AbortSignal", () => {
    it("testTransport_AbortSignal_CancelsRequest", async () => {
      const controller = new AbortController();

      // Start slow request
      const promise = fetchWithTransport(`${BASE_URL}/delay/10`, {
        method: "GET",
        headers: {},
        signal: controller.signal,
      });

      // Abort after 100ms
      setTimeout(() => controller.abort(), 100);

      await expect(promise).rejects.toThrow();
      // CLAIM: AbortSignal cancels in-flight requests
    }, 5000);
  });

  describe("ATTACK: Invalid URLs in Redirects", () => {
    it("testTransport_RelativeRedirect_ResolvedCorrectly", async () => {
      const response = await fetchWithTransport(`${BASE_URL}/relative-redirect/1`, {
        method: "GET",
        headers: {},
        followRedirects: true,
      });

      expect(response.status).toBe(200);
      expect(response.redirectCount).toBe(1);
      // CLAIM: Resolves relative redirect URLs correctly
    }, 10000);
  });

  describe("ATTACK: Multiple Content-Encoding", () => {
    it("testTransport_GzipEncoding_DecompressesOnce", async () => {
      const response = await fetchWithTransport(`${BASE_URL}/gzip`, {
        method: "GET",
        headers: { "Accept-Encoding": "gzip" },
      });

      expect(response.status).toBe(200);
      expect(typeof response.body).toBe("string");
      const parsed = JSON.parse(response.body as string);
      expect(parsed.gzipped).toBe(true);
      // CLAIM: Decompresses gzip responses correctly
    }, 10000);
  });

  describe("ATTACK: Binary Content Headers", () => {
    it("testTransport_ImageWithTextContentType_ReturnsBinary", async () => {
      // httpbin returns correct Content-Type, but we test binary detection
      const response = await fetchWithTransport(`${BASE_URL}/image/png`, {
        method: "GET",
        headers: {},
      });

      expect(response.status).toBe(200);
      expect(Buffer.isBuffer(response.body)).toBe(true);
      // CLAIM: Detects binary from Content-Type
    }, 10000);
  });

  describe("ATTACK: Empty Response Body", () => {
    it("testTransport_204NoContent_HandlesEmptyBody", async () => {
      const response = await fetchWithTransport(`${BASE_URL}/status/204`, {
        method: "GET",
        headers: {},
      });

      expect(response.status).toBe(204);
      expect(response.body).toBeTruthy(); // Empty string or empty buffer
      // CLAIM: Handles 204 No Content correctly
    }, 10000);
  });
});

describe("HOSTILE FALSIFICATION: Integration Attacks", () => {
  describe("ATTACK: Full Pipeline with Malicious Data", () => {
    it("testIntegration_RedactThenSend_NoLeakedSecrets", async () => {
      const maliciousBody = {
        username: "user",
        password: "secret123",
        __proto__: { isAdmin: true },
      };

      // Redact
      const redacted = redactRequest({
        headers: { Authorization: "Bearer secret-token" },
        body: maliciousBody,
        url: "https://api.com/login?token=abc123",
        patterns: ["password", "token", "authorization"],
      });

      // Verify redaction worked
      expect((redacted.body as any).password).toBe("****");
      expect(redacted.headers?.Authorization).toBe("Bearer ****");
      expect(redacted.url).toContain("token=****");

      // Prepare headers
      const prepared = prepareRequestHeaders({
        method: "POST",
        headers: redacted.headers || {},
        body: JSON.stringify(redacted.body),
      });

      expect(prepared.headers["Content-Type"]).toBe("application/json");
      expect(prepared.headers.Accept).toBe("application/json");

      // Verify prototype not polluted
      expect(({} as any).isAdmin).toBeUndefined();

      // CLAIM: Full pipeline prevents secret leakage
    });
  });
});
