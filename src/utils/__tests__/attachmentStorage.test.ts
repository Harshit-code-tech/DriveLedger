import * as FileSystem from 'expo-file-system/legacy';
import { ImageManipulator, manipulateAsync } from 'expo-image-manipulator';
import {
  sanitizeAttachmentFilename,
  isPdfAttachment,
  getThumbnailUri,
  getEffectivePreviewUri,
  copyToPermanentStorage,
  cleanupOrphanedAttachments,
  getAllActiveAttachmentUris,
  MAX_ATTACHMENT_DIMENSION,
  ATTACHMENT_JPEG_QUALITY,
  THUMBNAIL_MAX_DIMENSION,
  THUMBNAIL_JPEG_QUALITY,
  MAX_ATTACHMENT_FILE_SIZE,
  ATTACHMENTS_DIR,
} from '../attachmentStorage';
import { getDatabase } from '@/database/connection';

jest.mock('@/database/connection', () => ({
  getDatabase: jest.fn(),
}));

describe('attachmentStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sanitizeAttachmentFilename', () => {
    it('strips directory traversal paths', () => {
      const sanitized = sanitizeAttachmentFilename('../../secret/invoice.pdf');
      expect(sanitized).not.toContain('../');
      expect(sanitized).not.toContain('secret');
      expect(sanitized).toMatch(/^invoice_\d+_[a-z0-9]+\.pdf$/);
    });

    it('enforces allowed extensions and defaults illegal ones to .jpg', () => {
      const sanitized = sanitizeAttachmentFilename('malicious_script.exe');
      expect(sanitized).toMatch(/\.jpg$/);
    });

    it('handles filenames with multiple dots', () => {
      const sanitized = sanitizeAttachmentFilename('receipt.backup.png');
      expect(sanitized).toMatch(/\.png$/);
    });
  });

  describe('isPdfAttachment', () => {
    it('identifies PDF uris and case-insensitive variations', () => {
      expect(isPdfAttachment('/path/to/invoice.pdf')).toBe(true);
      expect(isPdfAttachment('content://media/docs/CERT.PDF')).toBe(true);
      expect(isPdfAttachment('https://example.com/receipt.pdf?token=123')).toBe(true);
    });

    it('returns false for image files or null/undefined', () => {
      expect(isPdfAttachment('/path/to/photo.jpg')).toBe(false);
      expect(isPdfAttachment('/path/to/receipt.png')).toBe(false);
      expect(isPdfAttachment(null)).toBe(false);
      expect(isPdfAttachment(undefined)).toBe(false);
    });
  });

  describe('getThumbnailUri', () => {
    it('derives thumbnail filename with thumb_ prefix', () => {
      const uri = `${ATTACHMENTS_DIR}doc_12345.jpg`;
      expect(getThumbnailUri(uri)).toBe(`${ATTACHMENTS_DIR}thumb_doc_12345.jpg`);
    });

    it('does not double prefix already prefixed thumbnails', () => {
      const uri = `${ATTACHMENTS_DIR}thumb_doc_12345.jpg`;
      expect(getThumbnailUri(uri)).toBe(`${ATTACHMENTS_DIR}thumb_doc_12345.jpg`);
    });

    it('returns original uri for PDFs', () => {
      const uri = `${ATTACHMENTS_DIR}policy.pdf`;
      expect(getThumbnailUri(uri)).toBe(uri);
    });

    it('handles empty input gracefully', () => {
      expect(getThumbnailUri('')).toBe('');
      expect(getThumbnailUri(null)).toBe('');
    });
  });

  describe('getEffectivePreviewUri', () => {
    it('returns thumbnail uri when thumbnail exists', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({ exists: true });
      const uri = `${ATTACHMENTS_DIR}doc_123.jpg`;
      const result = await getEffectivePreviewUri(uri);
      expect(result).toBe(`${ATTACHMENTS_DIR}thumb_doc_123.jpg`);
    });

    it('falls back to original uri when thumbnail does not exist', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({ exists: false });
      const uri = `${ATTACHMENTS_DIR}doc_legacy.jpg`;
      const result = await getEffectivePreviewUri(uri);
      expect(result).toBe(uri);
    });
  });

  describe('copyToPermanentStorage', () => {
    it('rejects files exceeding 15MB size limit', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation(async (uri: string) => {
        if (uri.includes('huge_image.jpg')) {
          return { exists: true, size: 20 * 1024 * 1024 };
        }
        return { exists: true, size: 100 };
      });

      await expect(copyToPermanentStorage('file:///huge_image.jpg')).rejects.toThrow(
        /Attachment exceeds maximum allowed size/
      );
    });

    it('copies PDFs without invoking image manipulator', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 500 * 1024 });

      const dest = await copyToPermanentStorage('content://docs/receipt.pdf');
      expect(dest).toMatch(/\.pdf$/);
      expect(FileSystem.copyAsync).toHaveBeenCalled();
      expect(ImageManipulator.manipulate).not.toHaveBeenCalled();
    });

    it('downsamples images to 1920 max dimension and generates thumbnail', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 2 * 1024 * 1024 });

      const dest = await copyToPermanentStorage('file:///camera/photo.jpg');
      expect(dest).toMatch(/\.jpg$/);

      // Verify ImageManipulator called for main image and thumbnail
      expect(ImageManipulator.manipulate).toHaveBeenCalledWith('file:///camera/photo.jpg', {
        maxWidth: MAX_ATTACHMENT_DIMENSION,
        maxHeight: MAX_ATTACHMENT_DIMENSION,
      });

      expect(ImageManipulator.manipulate).toHaveBeenCalledWith(dest, {
        maxWidth: THUMBNAIL_MAX_DIMENSION,
        maxHeight: THUMBNAIL_MAX_DIMENSION,
      });
    });

    it('supports boolean isPdf argument for backwards compatibility', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 100 * 1024 });

      const dest = await copyToPermanentStorage('file:///temp/upload', true);
      expect(dest).toMatch(/\.pdf$/);
    });
  });

  describe('cleanupOrphanedAttachments', () => {
    it('deletes unreferenced attachments and thumbnails but preserves active ones', async () => {
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
        'active_1.jpg',
        'thumb_active_1.jpg',
        'orphan_old.jpg',
        'thumb_orphan_old.jpg',
      ]);

      (FileSystem.getInfoAsync as jest.Mock).mockImplementation(async (uri: string) => {
        return { exists: true, size: 50000 };
      });

      const activeUris = new Set([`${ATTACHMENTS_DIR}active_1.jpg`]);
      const result = await cleanupOrphanedAttachments(activeUris);

      expect(result.deletedCount).toBe(2);
      expect(result.freedBytes).toBe(100000);
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(`${ATTACHMENTS_DIR}orphan_old.jpg`, { idempotent: true });
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(`${ATTACHMENTS_DIR}thumb_orphan_old.jpg`, { idempotent: true });
      expect(FileSystem.deleteAsync).not.toHaveBeenCalledWith(`${ATTACHMENTS_DIR}active_1.jpg`, expect.anything());
      expect(FileSystem.deleteAsync).not.toHaveBeenCalledWith(`${ATTACHMENTS_DIR}thumb_active_1.jpg`, expect.anything());
    });
  });

  describe('getAllActiveAttachmentUris', () => {
    it('aggregates URIs from fuel, service, expense, and document tables', async () => {
      const mockGetAllSync = jest.fn()
        .mockReturnValueOnce([{ uri: 'file:///att/fuel1.jpg' }])
        .mockReturnValueOnce([{ uri: 'file:///att/service1.jpg' }])
        .mockReturnValueOnce([{ uri: 'file:///att/expense1.jpg' }])
        .mockReturnValueOnce([{ uri: 'file:///att/doc1.pdf' }]);

      (getDatabase as jest.Mock).mockReturnValue({
        getAllSync: mockGetAllSync,
      });

      const uris = await getAllActiveAttachmentUris();
      expect(uris.size).toBe(4);
      expect(uris.has('file:///att/fuel1.jpg')).toBe(true);
      expect(uris.has('file:///att/service1.jpg')).toBe(true);
      expect(uris.has('file:///att/expense1.jpg')).toBe(true);
      expect(uris.has('file:///att/doc1.pdf')).toBe(true);
      expect(mockGetAllSync).toHaveBeenCalledWith(
        expect.stringContaining('FROM fuel_entries')
      );
      expect(mockGetAllSync).toHaveBeenCalledWith(
        expect.stringContaining('FROM service_records')
      );
      expect(mockGetAllSync).toHaveBeenCalledWith(
        expect.stringContaining('FROM expenses')
      );
      expect(mockGetAllSync).toHaveBeenCalledWith(
        expect.stringContaining('FROM documents')
      );
    });
  });
});
