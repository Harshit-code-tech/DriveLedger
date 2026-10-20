/**
 * Attachment Storage Utility
 *
 * Centralized, offline-first file management for receipts, invoices, and documents.
 * - Stores files permanently in `${FileSystem.documentDirectory}attachments/`.
 * - Validates file types (JPG, PNG, PDF) and prevents path traversal attacks.
 * - Bridges images and PDFs for reliable in-app preview and external viewing.
 * - Keeps filesystem operations outside of SQLite transactions.
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';

export const ATTACHMENTS_DIR = `${FileSystem.documentDirectory}attachments/`;

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.pdf']);

/**
 * Sanitizes an attachment filename to prevent directory traversal and illegal characters.
 */
export function sanitizeAttachmentFilename(rawName: string): string {
  // Strip any directory path components
  const baseName = rawName.replace(/^.*[\\/]/, '');
  // Extract extension
  const dotIndex = baseName.lastIndexOf('.');
  const ext = dotIndex !== -1 ? baseName.slice(dotIndex).toLowerCase() : '';
  const cleanExt = ALLOWED_EXTENSIONS.has(ext) ? ext : '.jpg';

  const nameWithoutExt = dotIndex !== -1 ? baseName.slice(0, dotIndex) : baseName;
  const cleanName = nameWithoutExt.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);

  return `${cleanName || 'attachment'}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}${cleanExt}`;
}

/**
 * Ensures the persistent attachments directory exists.
 */
export async function ensureAttachmentsDirectory(): Promise<void> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(ATTACHMENTS_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(ATTACHMENTS_DIR, { intermediates: true });
    }
  } catch (err) {
    console.warn('[AttachmentStorage] Error creating attachments directory:', err);
  }
}

/**
 * Checks if a URI represents a PDF document.
 */
export function isPdfAttachment(uri?: string | null): boolean {
  if (!uri) return false;
  const lower = uri.toLowerCase();
  return lower.includes('.pdf') || lower.endsWith('.pdf');
}

/**
 * Copies a picked asset (from ImagePicker or DocumentPicker) to permanent app storage.
 * Handles content:// URIs and standard file paths safely.
 */
export async function copyToPermanentStorage(
  sourceUri: string,
  preferredName?: string
): Promise<string> {
  await ensureAttachmentsDirectory();

  const isPdf = isPdfAttachment(sourceUri) || (preferredName && isPdfAttachment(preferredName));
  const filename = preferredName
    ? sanitizeAttachmentFilename(preferredName)
    : `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${isPdf ? '.pdf' : '.jpg'}`;

  const destUri = `${ATTACHMENTS_DIR}${filename}`;

  // Attempt 1: Native copyAsync (handles content:// via Android ContentResolver)
  try {
    await FileSystem.copyAsync({ from: sourceUri, to: destUri });
    return destUri;
  } catch (copyErr) {
    console.warn('[AttachmentStorage] copyAsync failed, attempting stream fallback:', copyErr);
  }

  // Attempt 2: Fetch blob + FileReader base64 (bypasses permission gate)
  try {
    const res = await fetch(sourceUri);
    const blob = await res.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        resolve(dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    await FileSystem.writeAsStringAsync(destUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return destUri;
  } catch (streamErr) {
    console.warn('[AttachmentStorage] Fallback stream failed:', streamErr);
  }

  // If both copy attempts fail, return sourceUri as last resort
  return sourceUri;
}

/**
 * Safely opens or shares an attachment (PDF or Image).
 */
export async function openAttachment(
  uri: string,
  title?: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const isPdf = isPdfAttachment(uri);
    let targetUri = uri;
    if (isPdf) {
      const cacheDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      const stagedUri = `${cacheDir}preview_${Date.now()}.pdf`;
      try {
        await FileSystem.copyAsync({ from: uri, to: stagedUri });
        if ((await FileSystem.getInfoAsync(stagedUri)).exists) {
          targetUri = stagedUri;
        }
      } catch (copyErr) {
        console.warn('[AttachmentStorage] Staging copy failed, using original uri:', copyErr);
      }
    }

    // On Android, attempt to launch native viewer directly without share dialog
    if (Platform.OS === 'android') {
      try {
        const contentUri = await FileSystem.getContentUriAsync(targetUri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
          type: isPdf ? 'application/pdf' : 'image/*',
        });
        return { success: true };
      } catch (intentErr) {
        console.warn('[AttachmentStorage] IntentLauncher VIEW failed, falling back to Sharing:', intentErr);
      }
    }

    const isAvailable = await Sharing.isAvailableAsync();

    if (!isAvailable) {
      return { success: false, message: 'No suitable viewer or sharing application is available on this device.' };
    }

    if (isPdf) {
      // For PDF, stage a copy in cache directory for viewing/sharing
      const cacheDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      const shareUri = `${cacheDir}preview_${Date.now()}.pdf`;

      try {
        await FileSystem.copyAsync({ from: uri, to: shareUri });
      } catch {
        // Fallback: try direct URI
      }

      const target = (await FileSystem.getInfoAsync(shareUri)).exists ? shareUri : uri;
      await Sharing.shareAsync(target, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: title || 'View Invoice / Document',
      });
      return { success: true };
    } else {
      // Image viewing fallback
      await Sharing.shareAsync(uri, {
        dialogTitle: title || 'View Receipt',
      });
      return { success: true };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('dismiss') || msg.includes('cancel')) {
      return { success: true };
    }
    return { success: false, message: `Could not open file: ${msg}` };
  }
}

/**
 * Checks if a file exists and is accessible.
 */
export async function checkFileExists(uri?: string | null): Promise<boolean> {
  if (!uri) return false;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists;
  } catch {
    return false;
  }
}
