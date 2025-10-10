# Request Format Parsers

HTTP Inspector supports importing and exporting requests in multiple industry-standard formats.

## Supported Formats

### 1. **.http / .rest** (Default Format)
**Used by:** VS Code REST Client, JetBrains HTTP Client, HTTPie

**Format:**
```http
### Get Users
GET https://api.example.com/users
Accept: application/json

### Create User
POST https://api.example.com/users
Content-Type: application/json
Authorization: Bearer {{AUTH_TOKEN}}

{
  "name": "John Doe",
  "email": "john@example.com"
}

### Update User
PUT https://api.example.com/users/123
Content-Type: application/json

{
  "name": "Jane Doe"
}
```

**Features:**
- ✅ Human-readable
- ✅ Git-friendly
- ✅ Comments with `###`
- ✅ Environment variable support `{{VAR}}`
- ✅ Widely supported by IDEs

---

### 2. **Postman Collection v2.1**
**Used by:** Postman, Newman

**Format:**
```json
{
  "info": {
    "name": "My API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Get Users",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{baseUrl}}/users",
          "host": ["{{baseUrl}}"],
          "path": ["users"]
        }
      }
    }
  ]
}
```

**Features:**
- ✅ Most widely used
- ✅ Rich ecosystem
- ✅ Environment/variable support
- ✅ Folder organization

---

### 3. **Insomnia Export Format**
**Used by:** Insomnia REST Client

**Format:**
```json
{
  "_type": "export",
  "__export_format": 4,
  "resources": [
    {
      "_id": "req_1",
      "_type": "request",
      "name": "Get Users",
      "method": "GET",
      "url": "https://api.example.com/users",
      "headers": [
        { "name": "Accept", "value": "application/json" }
      ]
    }
  ]
}
```

**Features:**
- ✅ Clean structure
- ✅ Plugin ecosystem
- ✅ GraphQL support

---

### 4. **Thunder Client Collection**
**Used by:** Thunder Client (VS Code Extension)

**Format:**
```json
{
  "client": "Thunder Client",
  "collectionName": "My API",
  "dateExported": "2025-10-10T20:00:00.000Z",
  "version": "1.1",
  "requests": [
    {
      "_id": "req_1",
      "colId": "col_1",
      "name": "Get Users",
      "url": "https://api.example.com/users",
      "method": "GET",
      "headers": []
    }
  ]
}
```

**Features:**
- ✅ Lightweight
- ✅ VS Code native
- ✅ Simple structure

---

### 5. **HAR (HTTP Archive Format)**
**Standard:** W3C HTTP Archive Specification 1.2

**Format:**
```json
{
  "log": {
    "version": "1.2",
    "creator": {
      "name": "HTTP Inspector",
      "version": "1.0.0"
    },
    "entries": [
      {
        "startedDateTime": "2025-10-10T20:00:00.000Z",
        "request": {
          "method": "GET",
          "url": "https://api.example.com/users",
          "headers": [
            { "name": "Accept", "value": "application/json" }
          ]
        },
        "comment": "Get Users"
      }
    ]
  }
}
```

**Features:**
- ✅ W3C standard
- ✅ Browser DevTools compatible
- ✅ Performance analysis support

---

## Usage

### Auto-Detect Import
```typescript
import { parseRequests } from './parsers';

const content = await fs.readFile('requests.http', 'utf-8');
const requests = parseRequests(content); // Auto-detects format
```

### Export to Specific Format
```typescript
import { exportRequests } from './parsers';

const httpContent = exportRequests(requests, 'http');
const postmanContent = exportRequests(requests, 'postman');
const insomniaContent = exportRequests(requests, 'insomnia');
const thunderContent = exportRequests(requests, 'thunder');
const harContent = exportRequests(requests, 'har');
```

### Manual Format Detection
```typescript
import { detectFormat } from './parsers';

const format = detectFormat(content);
console.log(`Detected: ${format}`); // 'http', 'postman', etc.
```

---

## Default Storage

HTTP Inspector uses **.http format** as the default:
- **Location:** `~/.http-inspector/requests.http`
- **Migration:** Automatically migrates from old `requests.json` format
- **Backup:** Old `requests.json` is preserved

---

## Environment Variables

All formats support environment variable substitution using `{{VARIABLE_NAME}}` syntax:

```http
POST {{API_BASE_URL}}/users/{{USER_ID}}
Authorization: Bearer {{AUTH_TOKEN}}
Content-Type: {{CONTENT_TYPE}}

{
  "apiKey": "{{API_KEY}}"
}
```

Variables are loaded from `.env` files (see ENV selector in UI).
