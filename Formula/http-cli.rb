class HttpCli < Formula
  desc "Fast, secure HTTP client for .http/.rest files"
  homepage "https://github.com/douglance/http-cli"
  version "0.1.0"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/douglance/http-cli/releases/download/v0.1.0/http-macos-arm64"
      sha256 "73f868bd809c016fe201974cee4ef291207c91b038d9a222239808c4e2b2d679"
    else
      url "https://github.com/douglance/http-cli/releases/download/v0.1.0/http-macos-x64"
      sha256 "610574f17ef2def545e8e1c30b36968d1d61674a8e3b0cf74d715fd514650243"
    end
  end

  on_linux do
    url "https://github.com/douglance/http-cli/releases/download/v0.1.0/http-linux-x64"
    sha256 "81cf1138a2b2a019ba615158fc0196f2f6259cbe412f0e592d8f8ffab1a4f6ff"
  end

  def install
    bin.install Dir["http*"].first => "http-cli"
  end

  test do
    output = shell_output("#{bin}/http-cli --help")
    assert_match "http", output
  end
end
