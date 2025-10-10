# HTTP CLI - AI-Consumable Interface Requirements

**Version:** 1.0.0
**Status:** Complete Specification
**Purpose:** Enable AI agents to autonomously discover and execute HTTP requests

---

## 1. CORE BEHAVIOR

### 1.1 Request Execution → Always JSON Output

```bash
$ http login
# ALWAYS outputs structured JSON to stdout
# No TTY detection, no interactive mode
```

**Rationale:** Calling any request by name signals machine-readable output intent.

---

## 2. `--list` FLAG SPECIFICATION

### 2.1 Basic Usage

```bash
$ http --list
# Lists all requests from auto-discovered .http files

$ http --list -f api.http
# Lists only requests in api.http
```

### 2.2 Output Format (Table with Metadata)

```
NAME          METHOD  URL                              VARIABLES
login         POST    /auth/login                      EMAIL, PASSWORD
get-users     GET     /api/users
create-user   POST    /api/users                       API_KEY, NAME, EMAIL
refresh       POST    /auth/refresh                    REFRESH_TOKEN
```

**Column Specifications:**
- **NAME**: Left-aligned, 14 chars min width
- **METHOD**: Left-aligned, 6 chars min width
- **URL**: Left-aligned, 32 chars min width
- **VARIABLES**: Comma-separated, no brackets, left-aligned

**Alignment Rules:**
- Dynamic column width based on content
- Minimum 2 spaces between columns
- Header row separated by content with single blank line (no separators)

### 2.3 Variable Display

**Format:** Comma-separated, no brackets
```
EMAIL, PASSWORD
API_KEY, NAME, EMAIL
```

**Special Cases:**
- No variables: Empty cell (no text)
- Variables in URL (`/users/{{id}}`): Include in VARIABLES column: `id`
- Many variables (>5): Show all, allow wrapping

### 2.4 URL Display

**Show relative path only:**
```
/auth/login          ✅ Correct
https://api.com/auth ❌ Wrong
```

**Variable interpolation:**
```
/users/{{userId}}/posts    ✅ Show as-is
```

### 2.5 Multi-File Display (Option C: Add FILE Column)

```bash
$ http --list
# Multiple files found

FILE          NAME          METHOD  URL                    VARIABLES
api.http      login         POST    /auth/login            EMAIL, PASSWORD
api.http      get-users     GET     /api/users
auth.http     refresh       POST    /auth/refresh          REFRESH_TOKEN
admin.http    delete-user   DELETE  /users/{{id}}          API_KEY, id
```

**Sorting:**
1. Primary: Alphabetical by FILE
2. Secondary: Alphabetical by NAME

### 2.6 Empty Results

```bash
$ http --list
# No .http files found

# Output (to stderr):
No .http files found in current directory

# Exit code: 0 (not an error, just empty result)
```

### 2.7 Parse Errors

```bash
$ http --list
# api.http has syntax error on line 15

# Behavior: Skip errored file, show warning to stderr, list others
# stderr output:
Warning: Failed to parse api.http (line 15: Invalid HTTP method)

# stdout output: List from other files
# Exit code: 0 (partial success)
```

### 2.8 Single File Filtering

```bash
$ http --list -f api.http

# Output: Same format, only shows requests from api.http
NAME          METHOD  URL                    VARIABLES
login         POST    /auth/login            EMAIL, PASSWORD
get-users     GET     /api/users
```

**No FILE column when using `-f` (redundant).**

---

## 3. REQUEST EXECUTION JSON SCHEMA

### 3.1 Success Response Schema

```json
{
  "request": {
    "name": "login",
    "file": "api.http",
    "method": "POST",
    "url": "https://api.example.com/auth/login",
    "headers": {
      "content-type": "application/json",
      "user-agent": "http-cli/1.0.0"
    },
    "body": "{\"email\":\"user@example.com\",\"password\":\"[REDACTED]\"}"
  },
  "response": {
    "status": 200,
    "statusText": "OK",
    "headers": {
      "content-type": "application/json",
      "content-length": "156"
    },
    "body": "{\"token\":\"abc123\",\"user\":{...}}",
    "bodySize": 156
  },
  "timings": {
    "dnsLookup": 12,
    "tcpConnection": 45,
    "tlsHandshake": 23,
    "firstByte": 156,
    "total": 234
  },
  "metadata": {
    "timestamp": "2025-01-15T10:30:45.123Z",
    "environment": "development"
  }
}
```

### 3.2 Field Specifications

**`request.body`:**
- Include full body up to 10KB
- If >10KB: Truncate with `"[body truncated: 15234 bytes]"`
- Redact sensitive fields: `password`, `token`, `secret`, `apiKey` → `"[REDACTED]"`

**`response.body`:**
- Text responses: Include as string
- JSON responses: Include as string (client can parse)
- Binary responses (PDF, images): Base64 encode if <1MB, otherwise:
  ```json
  "body": "[binary data omitted]",
  "bodySize": 1234567,
  "contentType": "application/pdf"
  ```

**`response.headers`:**
- Include ALL headers
- Preserve original case
- Redact: `authorization`, `cookie`, `set-cookie` → `"[REDACTED]"`

**`timings.tlsHandshake`:**
- Only present for HTTPS requests
- Omit for HTTP

**`metadata.environment`:**
- Omit if no environment active
- Include environment name if set via `--env` flag

### 3.3 HTTP Error Response (4xx/5xx)

**Same schema, just different status:**

```json
{
  "request": {...},
  "response": {
    "status": 401,
    "statusText": "Unauthorized",
    "headers": {...},
    "body": "{\"error\":\"Invalid credentials\"}"
  },
  "timings": {...}
}
```

**Exit code: 0** (request succeeded, server returned error)

### 3.4 Network Error Response

```bash
$ http login
# DNS lookup fails

# Output to stdout:
{
  "error": {
    "type": "NetworkError",
    "code": "ENOTFOUND",
    "message": "DNS lookup failed for api.example.com"
  },
  "request": {
    "name": "login",
    "file": "api.http",
    "method": "POST",
    "url": "https://api.example.com/auth/login"
  }
}

# Exit code: 1
```

**Network error types:**
- `NetworkError` - DNS, TCP, TLS failures
- `TimeoutError` - Request timeout
- `AbortError` - Request cancelled

### 3.5 Request Not Found Error

```bash
$ http nonexistent

# Output to stdout:
{
  "error": {
    "type": "NotFoundError",
    "message": "Request 'nonexistent' not found"
  }
}

# Exit code: 1
```

### 3.6 Ambiguous Request Error

```bash
# api.http has "login"
# auth.http also has "login"

$ http login

# Output to stdout:
{
  "error": {
    "type": "AmbiguousRequestError",
    "message": "Request 'login' found in multiple files: api.http, auth.http",
    "hint": "Use -f flag to specify file: http -f api.http login"
  }
}

# Exit code: 1
```

---

## 4. `-f/--file` FLAG SPECIFICATION

### 4.1 Usage

```bash
$ http -f api.http login
$ http --file auth.http refresh
```

### 4.2 File Path Resolution

**Relative paths:**
```bash
$ http -f api.http login           # ./api.http
$ http -f requests/auth.http login # ./requests/auth.http
```

**Absolute paths:**
```bash
$ http -f /home/user/api.http login
```

**Home directory:**
```bash
$ http -f ~/project/api.http login  # Expand ~ to $HOME
```

### 4.3 Extension Handling

**Auto-add `.http` if no extension:**
```bash
$ http -f api login
# Resolves to: api.http
```

**Support these extensions:**
- `.http` (primary)
- `.rest` (alternative)
- Any extension (if explicitly provided)

```bash
$ http -f requests.rest login   ✅ Works
$ http -f custom.txt login      ✅ Works (any extension allowed)
```

### 4.4 Ambiguity Resolution

**Without `-f` flag:**
```bash
# api.http has "login"
# auth.http also has "login"

$ http login
# Error: AmbiguousRequestError (see 3.6)
```

**With `-f` flag:**
```bash
$ http -f api.http login
# Uses api.http, ignores auth.http
```

**Deterministic search order (when no ambiguity):**
1. Alphabetical by filename
2. First match wins

### 4.5 Error Handling

**File not found:**
```json
{
  "error": {
    "type": "FileNotFoundError",
    "message": "File not found: api.http",
    "path": "/home/user/project/api.http"
  }
}
// Exit code: 1
```

**Request not found in file:**
```json
{
  "error": {
    "type": "NotFoundError",
    "message": "Request 'nonexistent' not found in api.http"
  }
}
// Exit code: 1
```

**Parse error:**
```json
{
  "error": {
    "type": "ParseError",
    "message": "Failed to parse api.http",
    "line": 15,
    "details": "Invalid HTTP method"
  }
}
// Exit code: 2
```

---

## 5. `--help` FLAG SPECIFICATION

### 5.1 Content Structure

```
http - Execute HTTP requests from .http files

USAGE:
  http [OPTIONS] <request-name>
  http --list [OPTIONS]
  http --help

DESCRIPTION:
  A terminal-based HTTP client that executes requests defined in .http files.
  Automatically discovers *.http files in the current directory.

EXAMPLES:
  # Discover available requests
  http --list

  # Execute a request (outputs JSON)
  http login

  # Execute from specific file
  http -f api.http get-users

  # List requests in specific file
  http --list -f auth.http

  # Use environment variables
  http --env prod login

OPTIONS:
  --list              List all available requests
  -f, --file <path>   Target specific .http file
  --env <name>        Use environment variables from <name>
  --help              Show this help message
  --version           Show version information

FILE DISCOVERY:
  Automatically searches current directory for:
  - *.http files
  - *.rest files

REQUEST FORMAT:
  .http files use this syntax:

    ### request-name
    POST /api/endpoint
    Content-Type: application/json

    {"key": "{{VARIABLE}}"}

  Variables are resolved from:
  1. .env file in current directory
  2. Shell environment variables

EXIT CODES:
  0  Success
  1  Request not found, network error, or ambiguous request
  2  Parse error in .http file

OUTPUT:
  Request execution always outputs JSON to stdout.
  Use jq or similar tools to parse the response.

EXAMPLES WITH JQ:
  # Extract status code
  http login | jq '.response.status'

  # Extract response body
  http get-users | jq -r '.response.body'

  # Check for errors
  http login | jq 'if .error then "Failed" else "Success" end'

MORE INFO:
  https://github.com/douglance/http-cli
```

### 5.2 Machine-Parseable Help (Optional Enhancement)

```bash
$ http --help=json

{
  "version": "1.0.0",
  "commands": [
    {
      "pattern": "http <request-name>",
      "description": "Execute HTTP request",
      "output": "JSON to stdout"
    },
    {
      "pattern": "http --list",
      "description": "List available requests",
      "output": "Table to stdout"
    }
  ],
  "flags": [
    {
      "flag": "-f, --file <path>",
      "description": "Target specific .http file",
      "required": false
    },
    {
      "flag": "--list",
      "description": "List all available requests",
      "required": false
    }
  ],
  "exitCodes": {
    "0": "Success",
    "1": "General error",
    "2": "Parse error"
  }
}
```

**Note:** `--help=json` is OPTIONAL for v1. Implement if time permits.

---

## 6. EXIT CODES

### 6.1 Exit Code Table

| Code | Scenario | Example |
|------|----------|---------|
| 0 | Success (including HTTP 4xx/5xx) | Request executed, got response |
| 1 | Request not found | `http nonexistent` |
| 1 | File not found | `http -f missing.http login` |
| 1 | Ambiguous request | Multiple files have same request |
| 1 | Network error | DNS failure, connection refused |
| 1 | Timeout | Request took too long |
| 2 | Parse error | Invalid .http file syntax |
| 2 | Invalid arguments | `http --list --badflags` |

### 6.2 HTTP Response Codes Do NOT Affect Exit Code

```bash
$ http login
# Server returns 401 Unauthorized
# Exit code: 0 (request succeeded)

$ http get-users
# Server returns 500 Internal Server Error
# Exit code: 0 (request succeeded)
```

**Rationale:** AI needs to distinguish "request failed to execute" vs "request executed, server returned error."

---

## 7. ENVIRONMENT VARIABLES

### 7.1 Variable Resolution Order

1. `.env` file in current directory (highest priority)
2. Shell environment variables
3. Error if undefined

### 7.2 Variable Syntax in .http Files

```http
POST /auth/login
Content-Type: application/json

{
  "email": "{{EMAIL}}",
  "password": "{{PASSWORD}}"
}
```

### 7.3 Missing Variable Behavior

```bash
$ http login
# EMAIL defined, PASSWORD not defined

# Output:
{
  "error": {
    "type": "MissingVariableError",
    "message": "Undefined variable: PASSWORD",
    "variables": ["PASSWORD"]
  }
}

# Exit code: 1
```

**Do NOT send request with literal `{{PASSWORD}}`.**

### 7.4 Variable Display in Output

```json
{
  "metadata": {
    "variables": {
      "EMAIL": "user@example.com",
      "PASSWORD": "[REDACTED]",
      "API_KEY": "[REDACTED]"
    }
  }
}
```

**Redact these variable names:**
- `password`, `PASSWORD`, `Password`
- `secret`, `SECRET`, `Secret`
- `token`, `TOKEN`, `Token`
- `apikey`, `API_KEY`, `apiKey`
- `key`, `KEY`

---

## 8. EDGE CASES

### 8.1 Duplicate Request Names (Same File)

```http
### login
POST /auth/v1/login

### login
POST /auth/v2/login
```

**Behavior:**
- Use last definition (overwrites previous)
- Show warning to stderr: `Warning: Duplicate request name 'login' in api.http (line 15)`

### 8.2 Special Characters in Request Names

**Allowed:**
```http
### get-users-by-id        ✅ Hyphens
### admin:delete-user      ✅ Colons
### @deprecated-login      ✅ @-prefix
### v2/get_users           ✅ Slashes, underscores
```

**Not allowed:**
```http
### login with spaces      ❌ Spaces (parse error)
### login#admin            ❌ Hash (conflicts with comment)
```

### 8.3 Comments in .http Files

```http
# This is a comment

### login
# This authenticates the user
# @requires EMAIL, PASSWORD
POST /auth/login
```

**Behavior:**
- Comments ignored during execution
- Comments NOT shown in `--list` output (future enhancement)

### 8.4 Circular Variable References

```
BASE_URL={{API_URL}}
API_URL={{BASE_URL}}/api
```

**Behavior:**
```json
{
  "error": {
    "type": "CircularReferenceError",
    "message": "Circular variable reference detected: BASE_URL -> API_URL -> BASE_URL"
  }
}
// Exit code: 1
```

### 8.5 Malformed URLs

```http
### broken
GET not-a-valid-url
```

**Behavior:**
```json
{
  "error": {
    "type": "ParseError",
    "message": "Invalid URL: not-a-valid-url",
    "line": 2
  }
}
// Exit code: 2
```

---

## 9. FLAG INTERACTION MATRIX

| Command | Behavior | Exit Code |
|---------|----------|-----------|
| `http --list` | List all requests from auto-discovered files | 0 |
| `http --list -f api.http` | List requests in api.http only | 0 |
| `http -f api.http --list` | Same as above (order doesn't matter) | 0 |
| `http login` | Execute "login" request (auto-discover) | 0 or 1 |
| `http -f api.http login` | Execute "login" from api.http | 0 or 1 |
| `http --help` | Show help text | 0 |
| `http --help --list` | Error: Conflicting flags | 2 |
| `http --list login` | Error: Can't list and execute | 2 |
| `http` | Error: No request name provided | 2 |
| `http -f api.http` | Error: No request name provided | 2 |

---

## 10. ERROR MESSAGE FORMAT

**All errors output JSON to stdout:**

```json
{
  "error": {
    "type": "ErrorType",
    "message": "Human-readable description",
    "details": {}
  }
}
```

**Error types:**
- `NotFoundError` - Request/file not found
- `AmbiguousRequestError` - Multiple files have same request
- `FileNotFoundError` - Specified file doesn't exist
- `ParseError` - Invalid .http file syntax
- `NetworkError` - DNS, TCP, connection issues
- `TimeoutError` - Request timeout
- `MissingVariableError` - Undefined variable
- `CircularReferenceError` - Variable circular dependency
- `InvalidArgumentError` - Bad CLI flags

**No error messages to stderr** (except warnings for parse errors in `--list`).

---

## 11. PERFORMANCE REQUIREMENTS

### 11.1 `--list` Performance

- Must complete <500ms with 100 .http files
- Must complete <2s with 1000 requests
- No hanging on large files (>10MB)

### 11.2 Request Execution

- DNS timeout: 5s
- TCP connection timeout: 10s
- Total request timeout: 30s (configurable in future)

---

## 12. SECURITY REQUIREMENTS

### 12.1 Sensitive Data Redaction

**Redact in output:**
- Request body fields: `password`, `secret`, `token`, `apiKey`
- Headers: `authorization`, `cookie`, `set-cookie`
- Variables: `PASSWORD`, `SECRET`, `TOKEN`, `API_KEY`, `KEY`

**Redacted format:**
```json
"password": "[REDACTED]"
```

### 12.2 .env File Security

- `.env` files MUST NOT be committed to git (add to .gitignore)
- Variables stored in plain text (no encryption in v1)
- Future: Consider encrypted environment storage

---

## 13. BACKWARD COMPATIBILITY

### 13.1 Existing TUI Mode

- Interactive TUI mode EXISTS SEPARATELY
- These JSON enhancements DO NOT affect TUI
- TUI likely triggered by different command or flag (not our concern)

### 13.2 Breaking Changes

**These changes ARE breaking:**
- Request execution now outputs JSON (was TUI)
- Must update any scripts that parse old output

**Migration path:**
- If old behavior needed, use TUI mode instead
- Document breaking change in CHANGELOG

---

## 14. TESTING REQUIREMENTS

### 14.1 Test Scenarios

**Must have tests for:**
- ✅ `--list` with no files
- ✅ `--list` with multiple files
- ✅ `--list -f` targeting specific file
- ✅ Request execution success (200)
- ✅ Request execution HTTP error (401, 500)
- ✅ Request execution network error (DNS, timeout)
- ✅ Request not found
- ✅ Ambiguous request (multiple files)
- ✅ Missing variable error
- ✅ Parse error in .http file
- ✅ Binary response handling
- ✅ Sensitive data redaction
- ✅ Exit codes for all scenarios

### 14.2 Test Data

Create fixtures:
```
tests/fixtures/
├── simple.http          # Single request
├── multiple.http        # Multiple requests
├── duplicate.http       # Duplicate names
├── malformed.http       # Parse errors
├── variables.http       # Uses {{VARS}}
└── .env                 # Test environment
```

---

## 15. IMPLEMENTATION PRIORITY

### Phase 1 (MVP):
1. ✅ `--help` flag
2. ✅ `--list` flag (basic)
3. ✅ `-f/--file` flag
4. ✅ JSON output for request execution
5. ✅ Exit codes

### Phase 2 (Enhancements):
6. ⏳ Variable redaction
7. ⏳ Binary response handling
8. ⏳ `--list` with FILE column (multi-file display)
9. ⏳ Parse error warnings

### Phase 3 (Nice-to-have):
10. ⏳ `--help=json` machine-parseable help
11. ⏳ Comments in `--list` output
12. ⏳ Circular reference detection

---

## 16. ACCEPTANCE CRITERIA

**This specification is COMPLETE when:**

✅ AI agent can run `http --help` and learn usage
✅ AI agent can run `http --list` and discover requests
✅ AI agent can run `http login` and parse JSON response
✅ AI agent can handle errors without human intervention
✅ All exit codes documented and tested
✅ All edge cases have defined behavior
✅ Zero ambiguity remains

---

## CONFIDENCE: 98%

**Backed by:** Iterative refinement, explicit user decisions, edge case coverage
