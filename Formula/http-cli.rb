class HttpCli < Formula
  desc "Terminal-based HTTP client with .http file support"
  homepage "https://github.com/douglance/http-cli"
  url "https://github.com/douglance/http-cli/archive/refs/tags/v1.0.0.tar.gz"
  sha256 "SHA256_PLACEHOLDER"
  license "MIT"

  depends_on "node"

  def install
    # Install dependencies
    system "npm", "install", "--production"

    # Build the project
    system "npm", "run", "build"

    # Install to libexec
    libexec.install Dir["*"]

    # Create binaries
    bin.install_symlink libexec/"dist/cli.js" => "http"
    bin.install_symlink libexec/"dist/cli.js" => "rest"
    bin.install_symlink libexec/"dist/cli.js" => "requests"
  end

  test do
    # Test help command
    assert_match "http - Terminal-based HTTP client", shell_output("#{bin}/http --help")

    # Test version (if we add a version flag)
    # assert_match "1.0.0", shell_output("#{bin}/http --version")
  end
end
