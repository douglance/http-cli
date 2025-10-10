class DougQuery < Formula
  desc "Terminal-based HTTP client with .http file support"
  homepage "https://github.com/douglance/doug-query"
  url "https://github.com/douglance/doug-query/archive/refs/tags/v1.0.0.tar.gz"
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
    bin.install_symlink libexec/"dist/cli.js" => "dq"
    bin.install_symlink libexec/"dist/cli.js" => "doug-query"
  end

  test do
    # Test help command
    assert_match "doug-query (dq) - Terminal-based HTTP client", shell_output("#{bin}/dq --help")

    # Test version (if we add a version flag)
    # assert_match "1.0.0", shell_output("#{bin}/dq --version")
  end
end
