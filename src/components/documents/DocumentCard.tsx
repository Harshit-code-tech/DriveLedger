/**
 * DocumentCard
 *
 * Section 10 & 11: Document List and Information Hierarchy & Attachment Interaction
 * Detailed, structured card displaying:
 * - Document type & category icon
 * - Document name & provider/policy number
 * - Issued date BEFORE expiry date
 * - Calculated validity status
 * - Visible, independently tappable image / PDF attachment
 * - Long-press deletion initiation
 * - Tapping card triggers editing
 * - Tapping attachment triggers file viewer
 *
 * Styled in the Refined Technical Automotive Cockpit design:
 * - High-contrast card with crisp borders and subtle depth
 * - Status pills and urgent renew button in Automotive Orange / Critical Red
 * - Tabular numbers for dates and policy codes
 * - Dedicated independently touch-isolated attachment drawer
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import type { VehicleDocument } from '@/types/document';
import { DOCUMENT_TYPE_ICONS, DOCUMENT_TYPE_LABELS } from '@/constants/documentTypes';
import { Spacing } from '@/constants/theme';
import { formatDisplayDateLong, daysUntil } from '@/utils/date';
import { isPdfAttachment, getThumbnailUri } from '@/utils/attachmentStorage';
import type { DocumentPalette } from './documentTheme';
import {
  getAttachmentDisplayName,
  getDocumentValidityInfo,
} from './documentHelpers';

interface DocumentCardProps {
  item: VehicleDocument;
  isSuperseded: boolean;
  onEdit: (item: VehicleDocument) => void;
  onDelete: (item: VehicleDocument) => void;
  onViewImage: (uri: string) => void;
  onViewPdf: (uri: string, title?: string) => void;
  onRenew?: (item: VehicleDocument) => void;
  colors: DocumentPalette;
}

export const DocumentCard = React.memo(function DocumentCard({
  item,
  isSuperseded,
  onEdit,
  onDelete,
  onViewImage,
  onViewPdf,
  onRenew,
  colors,
}: DocumentCardProps) {
  const typeLabel =
    DOCUMENT_TYPE_LABELS[item.type as keyof typeof DOCUMENT_TYPE_LABELS] || item.type;
  const typeIcon =
    DOCUMENT_TYPE_ICONS[item.type as keyof typeof DOCUMENT_TYPE_ICONS] || '📄';

  const validity = getDocumentValidityInfo(
    item.expiry_date,
    item.type,
    isSuperseded,
    colors
  );

  const hasAttachment = Boolean(item.file_uri);
  const isPdf = hasAttachment && isPdfAttachment(item.file_uri);
  const filename = hasAttachment ? getAttachmentDisplayName(item.file_uri) : '';
  const initialThumb = hasAttachment && !isPdf ? getThumbnailUri(item.file_uri) || item.file_uri : null;

  const [thumbUri, setThumbUri] = useState<string | null>(initialThumb);
  const [imageError, setImageError] = useState(false);

  const isExpiringOrExpired =
    !isSuperseded &&
    item.expiry_date &&
    daysUntil(item.expiry_date) <= 30;

  const handleAttachmentPress = () => {
    if (!item.file_uri) return;
    if (isPdf) {
      onViewPdf(item.file_uri, `${typeLabel} Document`);
    } else {
      onViewImage(item.file_uri);
    }
  };

  return (
    <View
      style={[
        styles.cardContainer,
        {
          backgroundColor: colors.surface,
          borderColor: isSuperseded ? colors.borderLight : colors.border,
          opacity: isSuperseded ? 0.9 : 1,
        },
      ]}
    >
      {/* ── Main Entry Touch Target (Opens Document Editing) ── */}
      <TouchableOpacity
        style={styles.mainContent}
        onPress={() => onEdit(item)}
        onLongPress={() => onDelete(item)}
        delayLongPress={400}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${typeLabel}, status: ${validity.label}. Tap to edit, long press to delete.`}
      >
        {/* Header Row: Category Icon + Primary Name + Chevron */}
        <View style={styles.headerRow}>
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderLight },
            ]}
          >
            <Text style={styles.iconText}>{typeIcon}</Text>
          </View>

          <View style={styles.titleCol}>
            <Text style={[styles.primaryTitle, { color: colors.text }]} numberOfLines={1}>
              {typeLabel}
            </Text>

            {/* Provider and Policy/Doc Number */}
            {(item.insurer_name || item.document_number) && (
              <Text
                style={[
                  styles.providerSubtext,
                  { color: colors.textSecondary, fontVariant: ['tabular-nums'] },
                ]}
                numberOfLines={1}
              >
                {[item.insurer_name, item.document_number].filter(Boolean).join(' · ')}
              </Text>
            )}
          </View>

          <View style={styles.rightHeaderWrap}>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: validity.bgColor,
                  borderColor: validity.borderColor,
                },
              ]}
            >
              <Text style={[styles.statusBadgeText, { color: validity.textColor }]}>
                {validity.label}
              </Text>
            </View>

            <Text style={[styles.editChevron, { color: colors.textTertiary }]}>→</Text>
          </View>
        </View>

        {/* Structured Metadata: Issued Date BEFORE Expiry Date */}
        <View style={[styles.metadataContainer, { borderTopColor: colors.borderLight }]}>
          {item.issue_date && (
            <View style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Issued:</Text>
              <Text
                style={[
                  styles.metaValue,
                  { color: colors.text, fontVariant: ['tabular-nums'] },
                ]}
              >
                {formatDisplayDateLong(item.issue_date)}
              </Text>
            </View>
          )}

          {item.expiry_date && (
            <View style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Expires:</Text>
              <Text
                style={[
                  styles.metaValue,
                  { color: colors.text, fontVariant: ['tabular-nums'] },
                ]}
              >
                {formatDisplayDateLong(item.expiry_date)}
              </Text>
            </View>
          )}

          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Status:</Text>
            <Text
              style={[
                styles.metaValue,
                { color: validity.textColor, fontWeight: '700' },
              ]}
            >
              {validity.label}
            </Text>
          </View>

          {item.notes && (
            <View style={styles.notesRow}>
              <Text style={[styles.notesText, { color: colors.textTertiary }]} numberOfLines={1}>
                Note: {item.notes}
              </Text>
            </View>
          )}
        </View>

        {/* Quick Renew Action for Expiring or Expired Active Documents */}
        {isExpiringOrExpired && onRenew && (
          <TouchableOpacity
            style={[
              styles.renewButton,
              {
                backgroundColor:
                  validity.status === 'expired'
                    ? colors.statusCritical
                    : '#EA580C',
              },
            ]}
            onPress={() => onRenew(item)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Renew ${typeLabel}`}
          >
            <Text style={styles.renewButtonText}>🔄 Renew Document</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* ── Attachment Area (Independently Tappable, Never Triggers Edit) ── */}
      {hasAttachment && (
        <View style={[styles.attachmentDivider, { borderTopColor: colors.borderLight }]}>
          <TouchableOpacity
            style={[
              styles.attachmentButton,
              {
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.borderLight,
              },
            ]}
            onPress={handleAttachmentPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`View attachment ${filename}`}
          >
            {/* Left: Thumbnail or PDF Icon */}
            {isPdf ? (
              <View
                style={[
                  styles.pdfIconWrap,
                  { backgroundColor: colors.surface, borderColor: colors.borderLight },
                ]}
              >
                <Text style={styles.pdfIcon}>📄</Text>
              </View>
            ) : thumbUri && !imageError ? (
              <Image
                source={{ uri: thumbUri }}
                style={styles.thumbnail}
                resizeMode="cover"
                onError={() => {
                  if (thumbUri !== item.file_uri && item.file_uri) {
                    setThumbUri(item.file_uri);
                  } else {
                    setImageError(true);
                  }
                }}
              />
            ) : (
              <View
                style={[
                  styles.pdfIconWrap,
                  { backgroundColor: colors.surface, borderColor: colors.borderLight },
                ]}
              >
                <Text style={styles.pdfIcon}>🖼️</Text>
              </View>
            )}

            {/* Middle: Filename and Type Descriptor */}
            <View style={styles.attachmentInfoCol}>
              <Text
                style={[styles.attachmentFilename, { color: colors.text }]}
                numberOfLines={1}
              >
                {filename || (isPdf ? 'document.pdf' : 'attachment.jpg')}
              </Text>
              <Text
                style={[styles.attachmentTypeLabel, { color: colors.textSecondary }]}
              >
                {isPdf ? 'PDF Document · Tap to view' : 'Image Scan · Tap to preview'}
              </Text>
            </View>

            {/* Right: Open Arrow Icon */}
            <View style={styles.openIconWrap}>
              <Text style={[styles.openIcon, { color: colors.accent }]}>↗</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  mainContent: {
    padding: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 20,
  },
  titleCol: {
    flex: 1,
    justifyContent: 'center',
  },
  primaryTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  providerSubtext: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  rightHeaderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  editChevron: {
    fontSize: 16,
    fontWeight: '600',
  },
  metadataContainer: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs + 2,
    borderTopWidth: 1,
    gap: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: '500',
    width: 58,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  notesRow: {
    marginTop: 2,
  },
  notesText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  renewButton: {
    marginTop: Spacing.sm,
    paddingVertical: 7,
    paddingHorizontal: Spacing.md,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  renewButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  attachmentDivider: {
    borderTopWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    paddingTop: Spacing.xs,
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  thumbnail: {
    width: 34,
    height: 34,
    borderRadius: 6,
  },
  pdfIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfIcon: {
    fontSize: 18,
  },
  attachmentInfoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  attachmentFilename: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  attachmentTypeLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },
  openIconWrap: {
    paddingRight: 4,
  },
  openIcon: {
    fontSize: 16,
    fontWeight: '800',
  },
});
