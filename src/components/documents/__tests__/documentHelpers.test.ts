import {
  getAttachmentDisplayName,
  getDocumentValidityInfo,
  getDocumentOverviewCounts,
  formatCount,
} from '../documentHelpers';
import { DocumentColors } from '../documentTheme';
import { DocumentType } from '@/constants/documentTypes';
import type { VehicleDocument } from '@/types/document';

describe('documentHelpers', () => {
  const colors = DocumentColors.light;

  describe('getAttachmentDisplayName', () => {
    it('returns empty string for null or undefined', () => {
      expect(getAttachmentDisplayName(null)).toBe('');
      expect(getAttachmentDisplayName(undefined)).toBe('');
    });

    it('extracts filename from standard path', () => {
      expect(
        getAttachmentDisplayName('/data/user/0/com.driveledger/files/attachments/rc_certificate.pdf')
      ).toBe('rc_certificate.pdf');
    });

    it('handles query parameters safely', () => {
      expect(
        getAttachmentDisplayName('file:///storage/emulated/0/Download/insurance.jpg?v=123')
      ).toBe('insurance.jpg');
    });

    it('decodes uri encoded characters', () => {
      expect(
        getAttachmentDisplayName('file:///docs/My%20Car%20RC.pdf')
      ).toBe('My Car RC.pdf');
    });
  });

  describe('getDocumentValidityInfo', () => {
    it('returns superseded status when isSuperseded is true', () => {
      const res = getDocumentValidityInfo('2025-01-01', DocumentType.INSURANCE, true, colors);
      expect(res.status).toBe('superseded');
      expect(res.label).toContain('Superseded');
    });

    it('returns no_expiry when expiryDate is null', () => {
      const res = getDocumentValidityInfo(null, DocumentType.RC, false, colors);
      expect(res.status).toBe('no_expiry');
      expect(res.label).toBe('No Expiry');
    });

    it('identifies expired document in the past', () => {
      const res = getDocumentValidityInfo('2020-01-01', DocumentType.INSURANCE, false, colors);
      expect(res.status).toBe('expired');
      expect(res.label).toBe('Expired');
      expect(res.textColor).toBe(colors.statusCritical);
    });

    it('identifies PUC expired fine warning', () => {
      const res = getDocumentValidityInfo('2020-01-01', DocumentType.PUC, false, colors);
      expect(res.status).toBe('expired');
      expect(res.label).toContain('₹10k Fine');
    });

    it('identifies future valid document (> 90 days)', () => {
      const future = new Date();
      future.setDate(future.getDate() + 180);
      const res = getDocumentValidityInfo(future.toISOString().split('T')[0], DocumentType.INSURANCE, false, colors);
      expect(res.status).toBe('valid');
      expect(res.label).toBe('Valid');
      expect(res.textColor).toBe(colors.statusNormal);
    });
  });

  describe('getDocumentOverviewCounts', () => {
    it('accurately tallies active, expiring soon, expired, and valid', () => {
      const today = new Date();

      const futureFar = new Date(today);
      futureFar.setDate(today.getDate() + 100);

      const futureSoon = new Date(today);
      futureSoon.setDate(today.getDate() + 15);

      const past = new Date(today);
      past.setDate(today.getDate() - 10);

      const activeDocs: VehicleDocument[] = [
        {
          id: '1',
          vehicle_id: 'v1',
          type: DocumentType.RC,
          document_number: 'RC1',
          insurer_name: null,
          issue_date: '2024-01-01',
          expiry_date: null, // no expiry -> valid
          file_uri: null,
          superseded_by: null,
          notes: null,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          deleted_at: null,
        },
        {
          id: '2',
          vehicle_id: 'v1',
          type: DocumentType.INSURANCE,
          document_number: 'INS1',
          insurer_name: 'HDFC',
          issue_date: '2024-01-01',
          expiry_date: futureFar.toISOString().split('T')[0], // far -> valid
          file_uri: null,
          superseded_by: null,
          notes: null,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          deleted_at: null,
        },
        {
          id: '3',
          vehicle_id: 'v1',
          type: DocumentType.PUC,
          document_number: 'PUC1',
          insurer_name: null,
          issue_date: '2024-01-01',
          expiry_date: futureSoon.toISOString().split('T')[0], // soon
          file_uri: null,
          superseded_by: null,
          notes: null,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          deleted_at: null,
        },
        {
          id: '4',
          vehicle_id: 'v1',
          type: DocumentType.FITNESS,
          document_number: 'FIT1',
          insurer_name: null,
          issue_date: '2024-01-01',
          expiry_date: past.toISOString().split('T')[0], // expired
          file_uri: null,
          superseded_by: null,
          notes: null,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          deleted_at: null,
        },
      ];

      const counts = getDocumentOverviewCounts(activeDocs, []);
      expect(counts.totalActive).toBe(4);
      expect(counts.valid).toBe(2);
      expect(counts.expiringSoon).toBe(1);
      expect(counts.expired).toBe(1);
    });
  });

  describe('formatCount', () => {
    it('pads single digit numbers', () => {
      expect(formatCount(3)).toBe('03');
      expect(formatCount(0)).toBe('00');
    });

    it('leaves double digit numbers intact', () => {
      expect(formatCount(12)).toBe('12');
    });
  });
});

