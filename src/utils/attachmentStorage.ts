/**
 * Attachment Storage Utility
 *
 * Centralized, offline-first file management for receipts, invoices, and documents.
 * - Stores files permanently in `${FileSystem.documentDirectory}attachments/`.
 * - Automatically downsamples images to a bounded dimension (max 1920px) and quality (0.72)
 *   to control memory consumption and backup size.
 * - Generates lightweight thumbnails (max 320px) for list card previews.
 * - Enforces file size limits (15MB) and provides orphan attachment cleanup.
 * - Validates file types (JPG, PNG, PDF) and prevents path traversal attacks.
 * - Bridges images and PDFs for reliable in-app preview and external viewing.
 * - Keeps filesystem operations outside of SQLite transactions.
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { ImageManipulator, manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { getDatabase } from '@/database/connection';

export const ATTACHMENTS_DIR = `${FileSystem.documentDirectory}attachments/`;

export const MAX_ATTACHMENT_DIMENSION = 1920;
export const ATTACHMENT_JPEG_QUALITY = 0.72;
export const THUMBNAIL_MAX_DIMENSION = 320;
export const THUMBNAIL_JPEG_QUALITY = 0.60;
export const MAX_ATTACHMENT_FILE_SIZE = 15 * 1024 * 1024; // 15MB

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
 * Computes the corresponding thumbnail URI for an image attachment.
 */
export function getThumbnailUri(originalUri?: string | null): string {
  if (!originalUri) return '';
  if (isPdfAttachment(originalUri)) return originalUri;
  const lastSlash = originalUri.lastIndexOf('/');
  const dir = lastSlash !== -1 ? originalUri.slice(0, lastSlash + 1) : '';
  const filename = lastSlash !== -1 ? originalUri.slice(lastSlash + 1) : originalUri;

  if (filename.startsWith('thumb_')) {
    return originalUri;
  }
  return `${dir}thumb_${filename}`;
}

/**
 * Resolves the optimal preview URI for list views, preferring a thumbnail if one exists.
 */
export async function getEffectivePreviewUri(originalUri?: string | null): Promise<string | null> {
  if (!originalUri) return null;
  if (isPdfAttachment(originalUri)) return originalUri;
  const thumbUri = getThumbnailUri(originalUri);
  if (thumbUri !== originalUri) {
    const exists = await checkFileExists(thumbUri);
    if (exists) return thumbUri;
  }
  return originalUri;
}

/**
 * Internal helper to copy a file using native copyAsync with fetch stream fallback.
 */
async function copyFileWithFallback(from: string, to: string): Promise<void> {
  // Attempt 1: Native copyAsync (handles content:// via Android ContentResolver)
  try {
    await FileSystem.copyAsync({ from, to });
    return;
  } catch (copyErr) {
    console.warn('[AttachmentStorage] copyAsync failed, attempting stream fallback:', copyErr);
  }

  // Attempt 2: Fetch blob + FileReader base64 (bypasses permission gate)
  try {
    const res = await fetch(from);
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
    await FileSystem.writeAsStringAsync(to, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch (streamErr) {
    console.warn('[AttachmentStorage] Fallback stream failed:', streamErr);
  }
}

/**
 * Copies a picked asset (from ImagePicker or DocumentPicker) to permanent app storage.
 * Handles content:// URIs and standard file paths safely.
 * For images, automatically downsamples to MAX_ATTACHMENT_DIMENSION (1920px),
 * compresses to JPEG quality 0.72, and creates a lightweight thumbnail (320px)
 * for fast list rendering.
 */
export async function copyToPermanentStorage(
  sourceUri: string,
  preferredNameOrIsPdf?: string | boolean
): Promise<string> {
  await ensureAttachmentsDirectory();

  const isPdf = typeof preferredNameOrIsPdf === 'boolean'
    ? preferredNameOrIsPdf
    : isPdfAttachment(sourceUri) || (typeof preferredNameOrIsPdf === 'string' && isPdfAttachment(preferredNameOrIsPdf));

  // Check file size limit (15MB) if accessible
  try {
    const info = await FileSystem.getInfoAsync(sourceUri);
    if (info.exists && typeof info.size === 'number' && info.size > MAX_ATTACHMENT_FILE_SIZE) {
      throw new Error(`Attachment exceeds maximum allowed size of 15MB (${(info.size / (1024 * 1024)).toFixed(1)}MB)`);
    }
  } catch (sizeErr) {
    if (sizeErr instanceof Error && sizeErr.message.includes('Attachment exceeds maximum')) {
      throw sizeErr;
    }
  }

  const preferredName = typeof preferredNameOrIsPdf === 'string' ? preferredNameOrIsPdf : undefined;
  const filename = preferredName
    ? sanitizeAttachmentFilename(preferredName)
    : `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${isPdf ? '.pdf' : '.jpg'}`;

  const destUri = `${ATTACHMENTS_DIR}${filename}`;

  if (isPdf) {
    await copyFileWithFallback(sourceUri, destUri);
    return destUri;
  }

  // Optimize full-resolution image
  let optimized = false;
  try {
    if (ImageManipulator && typeof ImageManipulator.manipulate === 'function') {
      const context = ImageManipulator.manipulate(sourceUri, {
        maxWidth: MAX_ATTACHMENT_DIMENSION,
        maxHeight: MAX_ATTACHMENT_DIMENSION,
      });
      const imgRef = await context.renderAsync();
      const res = await imgRef.saveAsync({
        format: SaveFormat.JPEG,
        compress: ATTACHMENT_JPEG_QUALITY,
      });
      await copyFileWithFallback(res.uri, destUri);
      optimized = true;
    } else if (typeof manipulateAsync === 'function') {
      const res = await manipulateAsync(
        sourceUri,
        [{ resize: { width: MAX_ATTACHMENT_DIMENSION } }],
        { format: SaveFormat.JPEG, compress: ATTACHMENT_JPEG_QUALITY }
      );
      await copyFileWithFallback(res.uri, destUri);
      optimized = true;
    }
  } catch (manipErr) {
    console.warn('[AttachmentStorage] Image manipulation failed, falling back to direct copy:', manipErr);
  }

  if (!optimized) {
    await copyFileWithFallback(sourceUri, destUri);
  }

  // Generate thumbnail for fast list previews
  try {
    const thumbDestUri = getThumbnailUri(destUri);
    if (ImageManipulator && typeof ImageManipulator.manipulate === 'function') {
      const thumbCtx = ImageManipulator.manipulate(destUri, {
        maxWidth: THUMBNAIL_MAX_DIMENSION,
        maxHeight: THUMBNAIL_MAX_DIMENSION,
      });
      const thumbRef = await thumbCtx.renderAsync();
      const thumbRes = await thumbRef.saveAsync({
        format: SaveFormat.JPEG,
        compress: THUMBNAIL_JPEG_QUALITY,
      });
      await copyFileWithFallback(thumbRes.uri, thumbDestUri);
    } else if (typeof manipulateAsync === 'function') {
      const thumbRes = await manipulateAsync(
        destUri,
        [{ resize: { width: THUMBNAIL_MAX_DIMENSION } }],
        { format: SaveFormat.JPEG, compress: THUMBNAIL_JPEG_QUALITY }
      );
      await copyFileWithFallback(thumbRes.uri, thumbDestUri);
    }
  } catch (thumbErr) {
    // Non-fatal if thumbnail creation fails
    console.warn('[AttachmentStorage] Thumbnail generation skipped:', thumbErr);
  }

  return destUri;
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

/**
 * Returns all attachment URIs currently referenced in active or soft-deleted records.
 */
export async function getAllActiveAttachmentUris(): Promise<Set<string>> {
  const db = getDatabase();
  const uris = new Set<string>();

  const queries = [
    'SELECT receipt_photo_uri AS uri FROM fuel_entries WHERE receipt_photo_uri IS NOT NULL',
    'SELECT receipt_photo_uri AS uri FROM service_records WHERE receipt_photo_uri IS NOT NULL',
    'SELECT receipt_photo_uri AS uri FROM expenses WHERE receipt_photo_uri IS NOT NULL',
    'SELECT file_uri AS uri FROM documents WHERE file_uri IS NOT NULL',
  ];

  for (const sql of queries) {
    try {
      const rows = db.getAllSync<{ uri: string }>(sql);
      for (const row of rows) {
        if (row.uri) uris.add(row.uri);
      }
    } catch (e) {
      console.warn('[AttachmentStorage] Error fetching active URIs:', e);
    }
  }

  return uris;
}

/**
 * Scans the attachments directory and deletes unreferenced files and their thumbnails.
 */
export async function cleanupOrphanedAttachments(
  providedActiveUris?: Set<string>
): Promise<{ deletedCount: number; freedBytes: number }> {
  await ensureAttachmentsDirectory();
  let deletedCount = 0;
  let freedBytes = 0;

  try {
    const activeUris = providedActiveUris || (await getAllActiveAttachmentUris());

    // Normalize active sets to fast-lookup sets of filenames and full paths
    const activeFilenames = new Set<string>();
    for (const uri of activeUris) {
      if (!uri) continue;
      const baseName = uri.replace(/^.*[\\/]/, '');
      activeFilenames.add(baseName);
      activeFilenames.add(uri);
    }

    const files = await FileSystem.readDirectoryAsync(ATTACHMENTS_DIR);
    for (const filename of files) {
      const isThumb = filename.startsWith('thumb_');
      const baseFilename = isThumb ? filename.slice(6) : filename;
      const fileUri = `${ATTACHMENTS_DIR}${filename}`;

      const isReferenced =
        activeFilenames.has(baseFilename) ||
        activeFilenames.has(`${ATTACHMENTS_DIR}${baseFilename}`) ||
        activeFilenames.has(fileUri);

      if (!isReferenced) {
        try {
          const info = await FileSystem.getInfoAsync(fileUri);
          const size = info.exists && typeof info.size === 'number' ? info.size : 0;
          await FileSystem.deleteAsync(fileUri, { idempotent: true });
          deletedCount++;
          freedBytes += size;
        } catch (delErr) {
          console.warn('[AttachmentStorage] Error deleting orphan attachment:', fileUri, delErr);
        }
      }
    }
  } catch (err) {
    console.warn('[AttachmentStorage] Error during orphan attachment cleanup:', err);
  }

  return { deletedCount, freedBytes };
}
