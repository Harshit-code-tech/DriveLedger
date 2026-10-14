/**
 * Documents Screen
 *
 * Shows vehicle documents (RC, Insurance, PUC, FASTag, Warranty).
 * Highlights documents nearing expiry with color-coded badges.
 *
 * Features:
 * - List of current (non-superseded) documents
 * - Expiry warning badges (expired, expiring soon, valid)
 * - Renew button on expired/expiring documents
 * - Photo thumbnail display
 * - FAB to add new documents
 * - Wired to centralized documentStore
 */

import { VehicleContextHeader } from '@/components/VehicleContextHeader';
import { DOCUMENT_TYPE_ICONS, DOCUMENT_TYPE_LABELS } from '@/constants/documentTypes';
import { Sizing, Spacing, Typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useDocumentStore } from '@/stores/documentStore';
import { useVehicleStore } from '@/stores/vehicleStore';
import type { VehicleDocument } from '@/types/document';
import { daysUntil, formatDisplayDateLong } from '@/utils/date';
import { useFocusEffect, useRouter } from 'expo-router';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Image, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ReportExportModal } from '@/components/ReportExportModal';

export default function DocumentsScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const selectedVehicle = useVehicleStore((s) => s.selectedVehicle);

  const documents = useDocumentStore((s) => s.documents);
  const loadDocuments = useDocumentStore((s) => s.loadDocuments);
  const deleteDocument = useDocumentStore((s) => s.deleteDocument);

  // Fullscreen image viewer state
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);

  // Reload when screen comes into focus (after adding a document)
  useFocusEffect(
    useCallback(() => {
      if (selectedVehicle) {
        loadDocuments(selectedVehicle.id);
      }
    }, [selectedVehicle?.id])
  );

  const getExpiryBadge = (expiryDate: string | null, type?: string) => {
    if (!expiryDate) return { label: 'No Expiry', color: colors.textTertiary, bgColor: colors.shimmer };
    const days = daysUntil(expiryDate);
    if (days < 0) {
      return {
        label: type === 'PUC' ? '🚨 Expired (₹10k Fine)' : 'Expired',
        color: colors.danger,
        bgColor: colors.dangerLight,
      };
    }
    if (days <= 7) {
      return {
        label: type === 'PUC' ? `🚨 ${days}d left (Renew)` : `${days}d left`,
        color: colors.danger,
        bgColor: colors.dangerLight,
      };
    }
    if (days <= 15 && type === 'PUC') {
      return {
        label: `⚠️ ${days}d left`,
        color: colors.warning,
        bgColor: colors.warningLight,
      };
    }
    if (days <= 30) return { label: `${days}d left`, color: colors.warning, bgColor: colors.warningLight };
    if (days <= 90) return { label: `${days}d left`, color: colors.accent, bgColor: colors.accentLight };
    return { label: 'Valid', color: colors.success, bgColor: colors.successLight };
  };

  const handleRenew = (doc: VehicleDocument) => {
    const label = DOCUMENT_TYPE_LABELS[doc.type as keyof typeof DOCUMENT_TYPE_LABELS] || doc.type;
    Alert.alert(
      `Renew ${label} 🔄`,
      `Time to freshen up that ${label}! A new record will be created and the current one retired.\n\nWe'll take you to the form - just fill in the new details.`,
      [
        { text: 'Maybe Later', style: 'cancel' },
        {
          text: 'Let\'s Renew! 🎉',
          onPress: () => {
            router.push({
              pathname: '/add-document',
              params: { renewFrom: doc.id, renewType: doc.type },
            });
          },
        },
      ]
    );
  };

  /**
   * Open a document file:
   * - Images: show fullscreen modal
   * - PDFs: pass the raw file:// URI to expo-sharing.
   *   SharingModule.kt (native Android) internally calls
   *   FileProvider.getUriForFile() to wrap it as a content:// URI
   *   and grants read permission to target apps.
   *   We must NOT pre-convert with getContentUriAsync because
   *   expo-sharing explicitly rejects non-file:// URIs.
   */
  const openDocumentFile = async (uri: string) => {
    const isPDF = Boolean(uri && (uri.toLowerCase().includes('.pdf') || uri.toLowerCase().endsWith('.pdf')));
    if (isPDF) {
      try {
        const cacheDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
        const shareUri = `${cacheDir}share_${Date.now()}.pdf`;

        let readyToOpen = false;

        // Try Method 1: copyAsync (works for content:// and internal files via ContentResolver)
        try {
          await FileSystem.copyAsync({ from: uri, to: shareUri });
          readyToOpen = true;
        } catch (copyErr) {
          console.warn('copyAsync to cache failed, trying stream fallback:', copyErr);
        }

        // Try Method 2: fetch blob -> base64 -> writeAsStringAsync (bypasses Expo permission gate for unscoped paths)
        if (!readyToOpen) {
          try {
            const res = await fetch(uri);
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
            await FileSystem.writeAsStringAsync(shareUri, base64, {
              encoding: FileSystem.EncodingType.Base64,
            });
            readyToOpen = true;
          } catch (fetchErr) {
            console.warn('Fetch fallback to cache failed:', fetchErr);
          }
        }

        if (!readyToOpen) {
          Alert.alert(
            '📄 Document File Inaccessible',
            'This PDF is no longer accessible on your device (it may have been stored in a temporary location that Android cleared). Please tap Edit on this document and re-upload your PDF.'
          );
          return;
        }

        // On Android: Open DIRECTLY with the default PDF viewer (ACTION_VIEW)
        if (Platform.OS === 'android') {
          try {
            const contentUri = await FileSystem.getContentUriAsync(shareUri);
            await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
              data: contentUri,
              flags: 1, // Intent.FLAG_GRANT_READ_URI_PERMISSION
              type: 'application/pdf',
            });
            return;
          } catch (intentErr) {
            console.warn('Direct ACTION_VIEW failed, falling back to share sheet:', intentErr);
          }
        }

        // Fallback for iOS or if no default viewer handled ACTION_VIEW:
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(shareUri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Open PDF',
          });
        } else {
          Alert.alert(
            '📄 No PDF Viewer Available',
            'Your device cannot open PDFs. Install a PDF viewer like Google Drive or Adobe Acrobat to view it.'
          );
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        // User dismissed chooser / viewer — not an error
        if (msg.includes('cancelled') || msg.includes('canceled') || msg.includes('dismiss')) return;
        Alert.alert(
          '🙈 Could Not Open PDF',
          `Unable to open PDF: ${msg || 'File may be inaccessible'}. Try editing the document and re-uploading the PDF.`
        );
      }
    } else {
      setViewerUri(uri);
    }
  };

  const handleEdit = useCallback(
    (item: VehicleDocument) => {
      router.push({ pathname: '/add-document', params: { id: item.id } });
    },
    [router]
  );

  const handleView = useCallback(
    (item: VehicleDocument) => {
      if (item.file_uri) {
        openDocumentFile(item.file_uri);
      } else {
        router.push({ pathname: '/add-document', params: { id: item.id } });
      }
    },
    [openDocumentFile, router]
  );

  const handleDelete = useCallback(
    (item: VehicleDocument) => {
      Alert.alert(
        'Delete This? 🗑️',
        `You're about to delete this ${DOCUMENT_TYPE_LABELS[item.type as keyof typeof DOCUMENT_TYPE_LABELS] || item.type} record. No backsies!`,
        [
          { text: 'Keep It', style: 'cancel' },
          {
            text: 'Delete It',
            style: 'destructive',
            onPress: () => {
              if (selectedVehicle) {
                deleteDocument(item.id, selectedVehicle.id);
              }
            },
          },
        ]
      );
    },
    [selectedVehicle, deleteDocument]
  );

  if (!selectedVehicle) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 48, marginBottom: Spacing.lg }}>📄</Text>
          <Text style={[Typography.h3, { color: colors.text }]}>No vehicle selected</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Vehicle Context ── */}
      <VehicleContextHeader label="Documents for" />

      {/* ── Screen Action Bar ── */}
      <View style={[styles.topActionBar, { borderBottomColor: colors.borderLight }]}>
        <View style={styles.topActionTextGroup}>
          <Text style={[Typography.h3, { color: colors.text }]}>Vehicle Documents</Text>
          <Text style={[Typography.caption, { color: colors.textSecondary }]}>
            {documents.length} {documents.length === 1 ? 'record' : 'records'} active
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.exportButton, { borderColor: colors.primary, backgroundColor: colors.primaryLight }]}
          onPress={() => setShowExportModal(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Export vehicle reports"
        >
          <Text style={[Typography.caption, { color: colors.primary, fontWeight: '700' }]}>
            📄 Export Reports
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={documents}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <DocumentCard
            item={item}
            badge={getExpiryBadge(item.expiry_date, item.type)}
            onEdit={handleEdit}
            onView={handleView}
            onDelete={handleDelete}
            onRenew={handleRenew}
            colors={colors}
          />
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48, marginBottom: Spacing.lg }}>📄</Text>
            <Text style={[Typography.h3, { color: colors.text }]}>No documents yet</Text>
            <Text style={[Typography.bodySmall, { color: colors.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }]}>
              Store your RC, Insurance, PUC, and more digitally.
            </Text>
          </View>
        }
      />

      {/* ── FAB: Add Document ── */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        activeOpacity={0.85}
        onPress={() => router.push('/add-document')}
      >
        <Text style={styles.fabIcon}>+</Text>
        <Text style={[styles.fabText, { color: colors.textOnPrimary }]}>Add Document</Text>
      </TouchableOpacity>

      {/* ── Fullscreen Image Viewer Modal ── */}
      <Modal
        visible={!!viewerUri}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerUri(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalClose}
            onPress={() => setViewerUri(null)}
            activeOpacity={0.8}
          >
            <Text style={styles.modalCloseText}>✕ Close</Text>
          </TouchableOpacity>
          {viewerUri && (
            <Image
              source={{ uri: viewerUri }}
              style={styles.modalImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* ── Vehicle Report Export Modal ── */}
      {selectedVehicle && (
        <ReportExportModal
          visible={showExportModal}
          onClose={() => setShowExportModal(false)}
          vehicle={selectedVehicle}
        />
      )}
    </View>
  );
}

interface DocumentCardProps {
  item: VehicleDocument;
  badge: { label: string; color: string; bgColor: string };
  onEdit: (item: VehicleDocument) => void;
  onView: (item: VehicleDocument) => void;
  onDelete: (item: VehicleDocument) => void;
  onRenew: (item: VehicleDocument) => void;
  colors: ReturnType<typeof useThemeColors>;
}

function DocumentCard({
  item,
  badge,
  onEdit,
  onView,
  onDelete,
  onRenew,
  colors,
}: DocumentCardProps) {
  const lastTapRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const isExpiredOrExpiring = item.expiry_date && daysUntil(item.expiry_date) <= 30;
  const isPDF = Boolean(item.file_uri && (item.file_uri.toLowerCase().endsWith('.pdf') || item.file_uri.toLowerCase().includes('.pdf')));

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      lastTapRef.current = 0;
      onView(item);
    } else {
      lastTapRef.current = now;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        if (lastTapRef.current !== 0) {
          lastTapRef.current = 0;
          onEdit(item);
        }
      }, 310);
    }
  };

  return (
    <TouchableOpacity
      onPress={handleTap}
      onLongPress={() => onDelete(item)}
      activeOpacity={0.7}
      style={[styles.docCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.docRow}>
        <Text style={styles.docIcon}>
          {DOCUMENT_TYPE_ICONS[item.type as keyof typeof DOCUMENT_TYPE_ICONS] || '📄'}
        </Text>
        <View style={styles.docInfo}>
          <Text style={[Typography.body, { color: colors.text, fontWeight: '600' }]}>
            {DOCUMENT_TYPE_LABELS[item.type as keyof typeof DOCUMENT_TYPE_LABELS] || item.type}
          </Text>
          {item.document_number && (
            <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
              {item.document_number}
            </Text>
          )}
          {item.insurer_name && (
            <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
              {item.insurer_name}
            </Text>
          )}
          {item.expiry_date && (
            <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: Spacing.xs }]}>
              Expires: {formatDisplayDateLong(item.expiry_date)}
            </Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', gap: Spacing.xs }}>
          <View style={[styles.badge, { backgroundColor: badge.bgColor }]}>
            <Text style={[Typography.caption, { color: badge.color }]}>{badge.label}</Text>
          </View>
          {item.file_uri && (
            <Text style={{ fontSize: 14 }}>{isPDF ? '📄' : '📷'}</Text>
          )}
        </View>
      </View>
      {item.file_uri && !isPDF && (
        <Image source={{ uri: item.file_uri }} style={styles.docPhoto} resizeMode="cover" />
      )}
      {item.file_uri && isPDF && (
        <TouchableOpacity
          onPress={() => onView(item)}
          activeOpacity={0.7}
          style={[styles.pdfBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={{ fontSize: 20 }}>📄</Text>
          <Text style={[Typography.bodySmall, { color: colors.primary, marginLeft: Spacing.sm, fontWeight: '600' }]}>
            PDF attached — tap to open ↗
          </Text>
        </TouchableOpacity>
      )}

      {/* ── Renew Button (M-07) ── */}
      {isExpiredOrExpiring && (
        <TouchableOpacity
          style={[styles.renewButton, {
            backgroundColor: daysUntil(item.expiry_date!) < 0 ? colors.danger : colors.warning,
          }]}
          onPress={() => onRenew(item)}
          activeOpacity={0.8}
        >
          <Text style={[Typography.caption, { color: '#FFFFFF', fontWeight: '700' }]}>
            🔄 Renew Now
          </Text>
        </TouchableOpacity>
      )}

      <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: Spacing.xs }]}>
        Tap to edit · Double tap to view · Long press to delete
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topActionTextGroup: {
    flex: 1,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Sizing.radiusFull,
    borderWidth: 1,
  },
  list: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: 100 },
  docCard: {
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  docPhoto: {
    width: '100%',
    height: 120,
    borderRadius: Sizing.radiusMd,
    marginTop: Spacing.sm,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  docIcon: {
    fontSize: 28,
    marginRight: Spacing.md,
  },
  docInfo: {
    flex: 1,
  },
  badge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Sizing.radiusFull,
    marginLeft: Spacing.sm,
  },
  renewButton: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Sizing.radiusFull,
    alignSelf: 'flex-start',
  },
  pdfBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: Spacing.section * 2,
    paddingHorizontal: Spacing.xxxl,
  },
  // ── Fullscreen modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: 56,
    right: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 10,
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalImage: {
    width: '95%',
    height: '80%',
    borderRadius: 12,
  },
  fab: {
    position: 'absolute',
    bottom: Spacing.xxl,
    right: Spacing.lg,
    height: Sizing.fab,
    borderRadius: Sizing.radiusFull,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    gap: Spacing.sm,
  },
  fabIcon: { fontSize: 24, color: '#FFFFFF', fontWeight: '700' },
  fabText: { fontSize: 16, fontWeight: '700' },
});
