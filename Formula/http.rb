class Http < Formula
  desc "Fast, secure HTTP client for .http/.rest files"
  homepage "https://github.com/douglance/http-cli"
  version "0.1.0"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/douglance/http-cli/releases/download/v#{version}/http-macos-arm64"
      sha256 "REPLACE_WITH_ARM64_SHA256"
    else
      url "https://github.com/douglance/http-cli/releases/download/v#{version}/http-macos-x64"
      sha256 "REPLACE_WITH_X64_SHA256"
    end
  end

  on_linux do
    url "https://github.com/douglance/http-cli/releases/download/v#{version}/http-linux-x64"
    sha256 "REPLACE_WITH_LINUX_SHA256"
  end

  def install
    bin.install Dir["http*"].first => "http"
  end

  test do
    output = shell_output("#{bin}/http --help")
    assert_match "http", output
  end
end
