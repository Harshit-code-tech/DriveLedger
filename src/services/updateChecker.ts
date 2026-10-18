import {
  GITHUB_REPO,
  GitHubRelease,
  parseGitHubRelease,
} from '@/utils/releaseParser';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { Alert, Linking } from 'react-native';

export { GITHUB_REPO, GitHubRelease, parseGitHubRelease };

/**
 * Displays the 2 golden rules of data safety when updating APKs.
 */
export function showDataSafetyGuide() {
  Alert.alert(
    '🛡️ Update Like a Pro!',
    `1. NEVER UNINSTALL FIRST — seriously, don't!\n` +
    `• Open the downloaded APK and tap "Update".\n` +
    `• Android keeps all your vehicle logs, fuel records, and history safe automatically.\n\n` +

    `2. BACK UP JUST IN CASE 💾\n` +
    `• DriveLedger is 100% offline — data lives only on your device.\n` +
    `• Go to Settings › Download Backup to save an encrypted .dlbak file to Google Drive or Files.\n\n` +

    `3. USE OFFICIAL BUILDS ONLY ✅\n` +
    `• Install only from official GitHub Releases.\n` +
    `• Third-party builds can fail to install and risk your data.`,
    [{ text: 'Got it, thanks! 👍' }]
  );
}

/**
 * Checks GitHub Releases API for new APK versions.
 */
export async function checkForAppUpdate(options?: {
  manual?: boolean;
  repo?: string;
  onBeforeAlert?: () => void;
}): Promise<boolean> {
  const isManual = options?.manual ?? false;
  const repo = options?.repo ?? GITHUB_REPO;
  const currentVersion = Constants.expoConfig?.version || '1.0.0';

  const showAlert = async (title: string, message: string, buttons?: any[]) => {
    if (options?.onBeforeAlert) {
      options.onBeforeAlert();
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    Alert.alert(title, message, buttons);
  };

  if (repo === 'your-username/DriveLedger') {
    if (isManual) {
      await showAlert(
        '🔧 GitHub Repo Not Set Up',
        `You're on v${currentVersion} and looking sharp! 🤝\n\n` +
        `To hook up GitHub release checking, set your "owner/repo" in src/utils/releaseParser.ts.\n\n` +
        `Once you publish a release there, users can check for updates with one tap — pretty cool right?`,
        [
          { text: 'Safety Guide 🛡️', onPress: showDataSafetyGuide },
          { text: 'Got It!', style: 'cancel' },
        ]
      );
    }
    return false;
  }

  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'DriveLedger-App',
      },
    });

    if (response.status === 404) {
      if (isManual) {
        await showAlert(
          '🌚 No Releases Yet',
          `No public releases on GitHub yet for DriveLedger.\n\nYou're on v${currentVersion} — the freshest build around! 💨`
        );
      }
      return false;
    }

    if (!response.ok) {
      throw new Error(`GitHub API error ${response.status}`);
    }

    const data: GitHubRelease = await response.json();
    const result = parseGitHubRelease(data, currentVersion);

    if (result.hasUpdate) {
      await showAlert(
        `🎉 Update Available! v${result.version}`,
        `${result.releaseNotes}\n\n` +
        `🛡️ TWO GOLDEN RULES:\n` +
        `1. Don't uninstall! Just tap 'Download APK' and install over the existing app — all your records stay safe.\n` +
        `2. Backup first in Settings if you want extra peace of mind.\n\n` +
        `Ready to update? Let's go! 🚀`,
        [
          { text: 'Maybe Later', style: 'cancel' },
          {
            text: 'Download APK 📥',
            onPress: async () => {
              if (result.downloadUrl) {
                try {
                  await WebBrowser.openBrowserAsync(result.downloadUrl);
                } catch {
                  await Linking.openURL(result.downloadUrl);
                }
              }
            },
          },
        ]
      );
      return true;
    } else if (isManual) {
      await showAlert(
        "You're Up to Date! ✨",
        `DriveLedger v${currentVersion} is the latest version. You're all set, but it never hurts to check in once in a while! 🚗`
      );
      return false;
    }
  } catch (err) {
    if (isManual) {
      await showAlert(
        '😑 No Internet? Really?',
        `Couldn't reach GitHub to check for updates. Check your connection and try again!\n\nYou're on v${currentVersion} in the meantime 👍`,
        [{ text: 'Noted!' }]
      );
    }
  }

  return false;
}
