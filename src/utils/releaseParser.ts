import { isNewerVersion } from "./version";

/**
 * Your GitHub repository in "owner/repo" format.
 * Update this string with your GitHub username and repository name
 * (e.g. 'harsh/DriveLedger').
 */
export const GITHUB_REPO = "Harshit-code-tech/DriveLedger";

export interface GitHubAsset {
  name: string;
  browser_download_url: string;
}

export interface GitHubRelease {
  tag_name: string;
  name?: string;
  body?: string;
  html_url: string;
  assets?: GitHubAsset[];
}

export interface ParsedRelease {
  hasUpdate: boolean;
  version: string;
  downloadUrl: string;
  releaseNotes: string;
}

/**
 * Pure function to parse GitHub release data and determine whether an update is available.
 */
export function parseGitHubRelease(
  release: GitHubRelease,
  currentVersion: string,
): ParsedRelease {
  const version = release.tag_name ? release.tag_name.replace(/^[vV]/, "") : "";
  const hasUpdate = isNewerVersion(currentVersion, version);

  // Find APK in release assets; fallback to the release web page
  const apkAsset = release.assets?.find((a) =>
    a.name.toLowerCase().endsWith(".apk"),
  );
  const downloadUrl = apkAsset?.browser_download_url || release.html_url;
  const releaseNotes =
    release.body || release.name || "New improvements and bug fixes.";

  return {
    hasUpdate,
    version,
    downloadUrl,
    releaseNotes,
  };
}
