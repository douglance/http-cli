# Publishing http-cli to Homebrew

Complete guide to distribute `http` via Homebrew.

## Option 1: Personal Tap (Recommended for Start)

### Step 1: Create GitHub Repository

```bash
# 1. Push http-cli to GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/douglance/http-cli.git
git push -u origin main
```

### Step 2: Create a Release

```bash
# 1. Tag a version
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# 2. Create GitHub release (via GitHub UI or gh CLI)
gh release create v1.0.0 \
  --title "v1.0.0" \
  --notes "Initial release of http-cli

Features:
- .http file support
- Multi-format import (Postman, Insomnia, Thunder Client, HAR)
- Environment variable substitution
- Vim-style navigation
- Auto-detection of requests files
"
```

### Step 3: Get SHA256 of the Release

```bash
# Download and calculate SHA256
curl -sL https://github.com/douglance/http-cli/archive/refs/tags/v1.0.0.tar.gz | shasum -a 256
```

### Step 4: Create Homebrew Tap

```bash
# Create new tap repository
mkdir homebrew-http
cd homebrew-http
git init

# Create Formula directory
mkdir Formula

# Copy the formula
cp ../http-cli/Formula/http-cli.rb Formula/

# Update SHA256 in the formula with the value from Step 3

# Commit and push
git add Formula/http-cli.rb
git commit -m "Add http-cli formula"
git remote add origin https://github.com/douglance/homebrew-http.git
git push -u origin main
```

### Step 5: Test Your Tap

```bash
# Install from your tap (modern format - no tap needed)
brew install douglance/http/http-cli

# Test
http --help
```

### Step 6: Users Install Via

```bash
brew install douglance/http/http-cli
```

---

## Option 2: Official Homebrew Core (For Popular Tools)

Requirements:
- ✅ 30+ days since first release
- ✅ 50+ GitHub stars
- ✅ Actively maintained
- ✅ Notable user base
- ✅ Stable releases

### When Ready:

1. **Fork homebrew-core**
   ```bash
   gh repo fork homebrew/homebrew-core
   ```

2. **Create Formula**
   ```bash
   cd homebrew-core
   cp ../http-cli/Formula/http-cli.rb Formula/
   ```

3. **Test Locally**
   ```bash
   brew install --build-from-source Formula/http-cli.rb
   brew test http-cli
   brew audit --strict --online http-cli
   ```

4. **Submit PR**
   ```bash
   git checkout -b http-cli
   git add Formula/http-cli.rb
   git commit -m "http-cli: add new formula"
   git push origin http-cli
   gh pr create --repo homebrew/homebrew-core
   ```

---

## Formula Template (http-cli.rb)

```ruby
class DougQuery < Formula
  desc "Terminal-based HTTP client with .http file support"
  homepage "https://github.com/douglance/http-cli"
  url "https://github.com/douglance/http-cli/archive/refs/tags/v1.0.0.tar.gz"
  sha256 "REPLACE_WITH_ACTUAL_SHA256"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", "--production"
    system "npm", "run", "build"

    libexec.install Dir["*"]

    bin.install_symlink libexec/"dist/cli.js" => "dq"
    bin.install_symlink libexec/"dist/cli.js" => "http-cli"
  end

  test do
    assert_match "http-cli (dq)", shell_output("#{bin}/http --help")
  end
end
```

---

## Updating the Formula

When releasing new versions:

```bash
# 1. Tag new version
git tag -a v1.1.0 -m "Release v1.1.0"
git push origin v1.1.0

# 2. Create GitHub release
gh release create v1.1.0

# 3. Get new SHA256
curl -sL https://github.com/douglance/http-cli/archive/refs/tags/v1.1.0.tar.gz | shasum -a 256

# 4. Update formula
cd homebrew-http
# Edit Formula/http-cli.rb:
#   - Update version in URL
#   - Update sha256

git add Formula/http-cli.rb
git commit -m "http-cli 1.1.0"
git push

# 5. Users upgrade
brew update
brew upgrade http-cli
```

---

## Testing the Formula

```bash
# Audit the formula
brew audit --strict --online http-cli

# Install from local formula
brew install --build-from-source Formula/http-cli.rb

# Test installation
brew test http-cli

# Run actual command
http --help

# Uninstall
brew uninstall http-cli
```

---

## Quick Start Guide

### Minimal Setup (Personal Tap)

1. **Push to GitHub**
   ```bash
   git remote add origin https://github.com/douglance/http-cli.git
   git push -u origin main
   git tag v1.0.0
   git push origin v1.0.0
   gh release create v1.0.0
   ```

2. **Get SHA256**
   ```bash
   curl -sL https://github.com/douglance/http-cli/archive/refs/tags/v1.0.0.tar.gz | shasum -a 256
   ```

3. **Create Tap Repo**
   ```bash
   # On GitHub, create: homebrew-http
   git clone https://github.com/douglance/homebrew-http.git
   cd homebrew-http
   mkdir Formula
   # Copy Formula/http-cli.rb and update SHA256
   git add Formula/http-cli.rb
   git commit -m "Add http-cli formula"
   git push
   ```

4. **Install**
   ```bash
   brew install douglance/http/http-cli
   ```

---

## Promotion Path

1. **Start**: Personal tap (`brew install douglance/http/http-cli`)
2. **Grow**: Get stars, users, feedback
3. **Mature**: After 30+ days and 50+ stars
4. **Official**: Submit to homebrew-core (`brew install http-cli`)

---

## Resources

- [Homebrew Formula Cookbook](https://docs.brew.sh/Formula-Cookbook)
- [Homebrew Node.js Formulas](https://docs.brew.sh/Node-for-Formula-Authors)
- [Acceptable Formulae](https://docs.brew.sh/Acceptable-Formulae)
- [How to Create Homebrew Tap](https://docs.brew.sh/How-to-Create-and-Maintain-a-Tap)

---

## Alternative: npm Install (Fallback)

While building Homebrew presence, users can install via npm:

```bash
npm install -g http-cli
```

This gives immediate distribution while you build the Homebrew tap.
