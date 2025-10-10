# dq Examples

Example `.http` files demonstrating various features of the dq CLI.

## Files

### basic.http
Basic HTTP request examples:
- GET, POST, PUT, DELETE methods
- Query parameters
- JSON request bodies
- Custom headers

**Usage:**
```bash
dq get-user
dq create-post
dq custom-headers
```

### variables.http
Variable resolution examples:
- `.env` file variables
- Shell environment variables
- Variables in URLs, headers, and bodies

**Setup:**
1. Copy `.env.example` to `.env`
2. Fill in your values
3. Run requests:
```bash
dq get-user-with-vars
dq auth-example
```

## List Available Requests

```bash
# List all requests in current directory
dq --list

# List requests in specific file
dq --list -f basic.http
```

## Features Demonstrated

### Variable Resolution
Variables are resolved in this order:
1. `.env` file (highest priority)
2. Shell environment variables
3. Error if undefined

### Sensitive Data Redaction
API keys, tokens, and passwords are automatically redacted in output:
- `Authorization: Bearer sk-test-123` → `Bearer sk-...`
- `?api_key=secret` → `?api_key=***`

### Binary Response Handling
Binary responses (images, PDFs, etc.) are automatically:
- Detected by Content-Type
- Base64-encoded
- Shown with size information

## Output Format

All responses are output as JSON:
```json
{
  "request": {
    "name": "get-user",
    "method": "GET",
    "url": "https://api.example.com/users/1",
    "headers": {...}
  },
  "response": {
    "status": 200,
    "headers": {...},
    "body": "..."
  },
  "timings": {...}
}
```

## Additional Resources

- [Main README](../README.md)
- [Requirements Document](../CLI-REQUIREMENTS.md)
