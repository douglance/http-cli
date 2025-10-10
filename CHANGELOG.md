# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-01-XX

### Added
- Initial release
- `.http` and `.rest` file parsing
- Request execution with JSON output
- `--list` command to show available requests
- Variable resolution from `.env` files and shell environment
- Sensitive data redaction (Authorization headers, API keys, passwords)
- Binary response handling (base64 encoding for images, PDFs, etc.)
- HTTP error handling (4xx/5xx responses with exit code 0)
- Request ambiguity detection
- File-specific request execution with `-f` flag
- Single executable builds for macOS (Intel/ARM), Linux, Windows
- Comprehensive test suite (205 tests, 93% pass rate)

### Features

#### Variable Resolution
- Priority order: `.env` file > shell environment > error
- Supports variables in URLs, headers, and request bodies
- Clear error messages for undefined variables

#### Security
- Automatic redaction of sensitive data in output:
  - Authorization headers: `Bearer sk-test-123` → `Bearer sk-...`
  - Query parameters: `?api_key=secret` → `?api_key=***`
  - Case-insensitive matching for common secret patterns

#### Binary Responses
- Content-Type based detection (image/*, application/pdf, etc.)
- Base64 encoding for JSON compatibility
- Human-readable size formatting (B, KB, MB)

### Known Limitations
- Response handler scripts (section 8) - not implemented
- Authentication flows (section 9) - not implemented
- Multiple environments (section 10) - not implemented
- Pagination handling (section 11) - not implemented
- Large binary responses (>8KB) may hit Node.js execSync buffer limit in tests

### Testing
- 52/52 integration tests passing
- 205/220 total tests passing
- Strict TDD methodology (RED → GREEN → REFACTOR)

## [Unreleased]

### Planned
- Response handler JavaScript execution
- OAuth and token refresh flows
- Multiple environment profiles (dev/staging/prod)
- Automatic pagination following
- Performance optimizations for large responses

[0.1.0]: https://github.com/douglance/http-cli/releases/tag/v0.1.0
