import { GitHubRelease, parseGitHubRelease } from "../releaseParser";

describe("parseGitHubRelease", () => {
  const mockRelease: GitHubRelease = {
    tag_name: "v1.1.0",
    name: "DriveLedger v1.1.0",
    body: "• Added tyre pressure\n• Improved maintenance terms",
    html_url: "https://github.com/test/DriveLedger/releases/tag/v1.1.0",
    assets: [
      {
        name: "DriveLedger-v1.1.0.apk",
        browser_download_url:
          "https://github.com/test/DriveLedger/releases/download/v1.1.0/DriveLedger-v1.1.0.apk",
      },
    ],
  };

  it("detects a newer version from release tag", () => {
    const result = parseGitHubRelease(mockRelease, "0.1.0");
    expect(result.hasUpdate).toBe(true);
    expect(result.version).toBe("1.1.0");
    expect(result.downloadUrl).toBe(
      "https://github.com/test/DriveLedger/releases/download/v1.1.0/DriveLedger-v1.1.0.apk",
    );
    expect(result.releaseNotes).toContain("Added tyre pressure");
  });

  it("returns hasUpdate: false if release is same or older", () => {
    const resultSame = parseGitHubRelease(mockRelease, "1.1.0");
    expect(resultSame.hasUpdate).toBe(false);

    const resultNewer = parseGitHubRelease(mockRelease, "1.2.0");
    expect(resultNewer.hasUpdate).toBe(false);
  });

  it("falls back to html_url if no APK asset is uploaded", () => {
    const releaseWithoutApk: GitHubRelease = {
      tag_name: "v2.0.0",
      html_url: "https://github.com/test/DriveLedger/releases/tag/v2.0.0",
      assets: [],
    };
    const result = parseGitHubRelease(releaseWithoutApk, "0.1.0");
    expect(result.hasUpdate).toBe(true);
    expect(result.downloadUrl).toBe(
      "https://github.com/test/DriveLedger/releases/tag/v2.0.0",
    );
  });
});
