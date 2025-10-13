# http - Fast HTTP Client for .http Files

[![CI](https://github.com/douglance/http-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/douglance/http-cli/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/@douglance%2Fhttp.svg)](https://www.npmjs.com/package/@douglance/http)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Fast, secure HTTP client for `.http` and `.rest` files with variable resolution and sensitive data redaction. Compatible with VS Code REST Client and JetBrains HTTP Client formats.

## ✨ Features

- 📝 **`.http` & `.rest` file support** - Compatible with popular IDE extensions
- 🔐 **Automatic sensitive data redaction** - API keys, tokens, passwords redacted in output
- 🌍 **Variable resolution** - `.env` files and shell environment variables
- 📦 **Binary response handling** - Base64 encoding for images, PDFs, etc.
- ⚡ **Fast single executable** - No dependencies, built with Bun
- 🎯 **JSON output** - Perfect for CI/CD and scripting
- 🧪 **Well tested** - 205 tests, 93% pass rate, strict TDD

## 📦 Installation

### Homebrew (macOS/Linux)

```bash
brew tap douglance/http
brew install http-cli  # installs 'http' command
```

### npm

```bash
npm install -g @douglance/http
```

### Download Binary

Download the latest release for your platform:
- [macOS (Intel)](https://github.com/douglance/http-cli/releases/latest/download/http-macos-x64)
- [macOS (Apple Silicon)](https://github.com/douglance/http-cli/releases/latest/download/http-macos-arm64)
- [Linux](https://github.com/douglance/http-cli/releases/latest/download/http-linux-x64)
- [Windows](https://github.com/douglance/http-cli/releases/latest/download/http-windows-x64.exe)

```bash
# macOS/Linux
chmod +x http-*
mv http-* /usr/local/bin/http

# Verify installation
http --help
```

## 🚀 Quick Start

Create an `api.http` file:

```http
### get-user
GET https://jsonplaceholder.typicode.com/users/1

### create-post
POST https://jsonplaceholder.typicode.com/posts
Content-Type: application/json

{
  "title": "My Post",
  "body": "Content here",
  "userId": 1
}
```

Execute requests:

```bash
# List available requests
http --list

# Execute a specific request
http get-user

# Execute from specific file
http create-post -f api.http
```

## 📖 Usage

### Basic Requests

```http
### Simple GET
GET https://api.example.com/users

### POST with JSON body
POST https://api.example.com/users
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com"
}

### Custom headers
GET https://api.example.com/protected
Authorization: Bearer YOUR_TOKEN
X-Custom-Header: value
```

### Variable Resolution

Create a `.env` file:

```env
BASE_URL=https://api.example.com
USER_ID=123
API_KEY=your-api-key
```

Use variables in requests:

```http
### Get user with variables
GET {{BASE_URL}}/users/{{USER_ID}}
Authorization: Bearer {{API_KEY}}

### Variables in body
POST {{BASE_URL}}/posts
Content-Type: application/json

{
  "userId": {{USER_ID}},
  "title": "Post title"
}
```

**Variable Priority:**
1. `.env` file (highest)
2. Shell environment variables
3. Error if undefined

### Sensitive Data Redaction

API keys, tokens, and passwords are automatically redacted in output:

```http
### Auth example
GET https://api.example.com/users
Authorization: Bearer sk-test-1234567890
X-API-Key: secret-key-here
```

**Output:**
```json
{
  "request": {
    "headers": {
      "Authorization": "Bearer sk-...",
      "X-API-Key": "secret-..."
    }
  }
}
```

Query parameters are also redacted:
- `?api_key=secret` → `?api_key=***`
- `?token=abc123` → `?token=***`
- `?password=pass` → `?password=***`

### Binary Responses

Binary content (images, PDFs, etc.) is automatically detected and base64-encoded:

```http
### Download image
GET https://httpbin.org/image/png
```

**Output:**
```json
{
  "response": {
    "body": "[Binary data: 8.5 KB, image/png, base64-encoded]",
    "binaryData": "iVBORw0KGgoAAAANS...",
    "bodySize": 8704
  }
}
```

## 📋 Command Reference

```bash
# List all requests in current directory
http --list

# List requests in specific file
http --list -f api.http

# Execute a request
http <request-name>

# Execute from specific file
http <request-name> -f api.http

# Show help
http --help
```

## 📊 JSON Output Schema

All responses are output as JSON:

```json
{
  "request": {
    "name": "get-user",
    "file": "api.http",
    "method": "GET",
    "url": "https://api.example.com/users/1",
    "headers": {
      "Authorization": "Bearer sk-..."
    },
    "body": "{...}"
  },
  "response": {
    "status": 200,
    "statusText": "OK",
    "headers": {
      "content-type": "application/json"
    },
    "body": "{...}",
    "bodySize": 1234,
    "binaryData": "..."
  },
  "timings": {
    "dnsLookup": 10,
    "tcpConnection": 25,
    "tlsHandshake": 50,
    "firstByte": 120,
    "total": 150
  },
  "metadata": {
    "timestamp": "2025-01-15T10:30:00.000Z"
  }
}
```

## 🔒 Security Features

- **Automatic redaction**: API keys, tokens, passwords never appear in output
- **Case-insensitive matching**: Catches `API_KEY`, `Api-Key`, `api_key`
- **Redaction patterns**:
  - Headers: `Authorization`, `X-API-Key`, `X-Auth-Token`
  - Query params: `token`, `key`, `secret`, `password`
- **Actual requests unchanged**: Redaction only affects output, not HTTP requests

## 🧪 Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Build
npm run build

# Build executable
npm run build:exe

# Run linter
npm run lint

# Type check
npm run typecheck
```

## 📚 Examples

See the [examples](./examples) directory for more usage examples:
- `basic.http` - Basic HTTP methods
- `variables.http` - Variable resolution examples
- `.env.example` - Environment variable template

## 🤝 Contributing

Contributions welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## 📄 License

MIT © Doug Lance

## 🙏 Acknowledgments

- Inspired by VS Code REST Client and JetBrains HTTP Client
- Built with [Bun](https://bun.sh) and TypeScript
- Uses strict TDD methodology

## 🐛 Known Limitations

This is an MVP release (v0.1.0). The following features from the full requirements are **not yet implemented**:

- **Response handler scripts** (section 8) - JavaScript execution after responses
- **Authentication flows** (section 9) - OAuth, token refresh, CSRF
- **Multiple environments** (section 10) - dev/staging/prod profiles
- **Pagination handling** (section 11) - Automatic pagination following

See [CHANGELOG.md](./CHANGELOG.md) for planned features and roadmap.

## 📞 Support

- 🐛 [Report bugs](https://github.com/douglance/http-cli/issues)
- 💡 [Request features](https://github.com/douglance/http-cli/issues)
- 📖 [View documentation](https://github.com/douglance/http-cli)
