# Example Files

This directory contains example configuration files for http-cli.

## Files

- **requests.http** - Example HTTP request file with various request types
- **.env** - Example environment variables file

## Usage

Copy these files to get started:

```bash
# Copy example requests to current directory
cp .example/requests.http ./requests.http

# Copy example environment variables
cp .example/.env ./.env
```

Or run http-cli in this directory:

```bash
http .example/requests.http
```

## Notes

- Edit `.env` with your actual API credentials
- The `.http` file format supports environment variable substitution using `{{VAR_NAME}}`
- Both files are ignored by git when placed in the root directory
