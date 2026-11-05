/**
 * DriveLedger — Vehicle Documents Screen
 *
 * Section 1: Objective & Section 4: Final Page Structure
 * Completely redesigned Vehicle Documents management interface:
 * 1. Global Vehicle Selector (reusing HomeVehicleSelector)
 * 2. Vehicle Documents Title and Export Report Action (DocumentHeaderBar)
 * 3. Document Navigation: Active / Renewal History (DocumentNavigation)
 * 4. Document Status Overview (DocumentStatusOverview)
 * 5. Document List & Information Hierarchy (DocumentCard)
 * 6. Document Attachments with independent touch targets
 * 7. Existing Bottom Navigation context
 *
 * Design principle: Organised information density, not minimalism.
 * Fully offline-first, resource-efficient, and preserved database schema.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Stores & Repositories
import { useVehicleStore } from '@/stores/vehicleStore';
import { useDocumentStore } from '@/stores/documentStore';
import type { VehicleDocument } from '@/types/document';
import { DOCUMENT_TYPE_LABELS } from '@/constants/documentTypes';
import { Spacing } from '@/constants/theme';

// Attachment & Export Utilities
import {
  openAttachment,
  checkFileExists,
} from '@/utils/attachmentStorage';
import { ReportExportModal } from '@/components/ReportExportModal';
import { NoVehicleState } from '@/components/NoVehicleState';
import { HomeVehicleSelector } from '@/components/home/HomeVehicleSelector';

// Document Components & Theme
import { useDocumentColors } from '@/components/documents/documentTheme';
import { DocumentsHeader } from '@/components/documents/DocumentsHeader';
import {
  DocumentNavigation,
  type DocumentTab,
} from '@/components/documents/DocumentNavigation';
import { DocumentHeaderBar } from '@/components/documents/DocumentHeaderBar';
import { DocumentStatusOverview } from '@/components/documents/DocumentStatusOverview';
import { DocumentCard } from '@/components/documents/DocumentCard';
import { DocumentEmptyState } from '@/components/documents/DocumentEmptyState';
import { getDocumentOverviewCounts } from '@/components/documents/documentHelpers';

export default function DocumentsScreen() {
  const colors = useDocumentColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ vehicleId?: string }>();

  // ── Global Vehicle State ──
  const selectedVehicle = useVehicleStore((s) => s.selectedVehicle);
  const selectVehicle = useVehicleStore((s) => s.selectVehicle);

  useEffect(() => {
    if (params.vehicleId && params.vehicleId !== selectedVehicle?.id) {
      selectVehicle(params.vehicleId);
    }
  }, [params.vehicleId, selectedVehicle?.id, selectVehicle]);

  // ── Document Store ──
  const documents = useDocumentStore((s) => s.documents);
  const allDocuments = useDocumentStore((s) => s.allDocuments);
  const loadDocuments = useDocumentStore((s) => s.loadDocuments);
  const deleteDocument = useDocumentStore((s) => s.deleteDocument);

  // ── Navigation & Presentation State ──
  const [activeTab, setActiveTab] = useState<DocumentTab>('active');
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);

  // Reload when screen gains focus or selected vehicle changes
  useFocusEffect(
    useCallback(() => {
      if (selectedVehicle) {
        loadDocuments(selectedVehicle.id);
      }
    }, [selectedVehicle?.id, loadDocuments])
  );

  // Derived renewal history documents (superseded records)
  const supersededDocuments = useMemo(() => {
    return allDocuments.filter((d) => d.superseded_by !== null);
  }, [allDocuments]);

  // Document status overview metrics
  const stats = useMemo(() => {
    return getDocumentOverviewCounts(documents, supersededDocuments);
  }, [documents, supersededDocuments]);

  // ── User Actions ──

  const handleEdit = useCallback(
    (item: VehicleDocument) => {
      router.push({
        pathname: '/add-document',
        params: { id: item.id },
      });
    },
    [router]
  );

  const handleRenew = useCallback(
    (doc: VehicleDocument) => {
      const label =
        DOCUMENT_TYPE_LABELS[doc.type as keyof typeof DOCUMENT_TYPE_LABELS] || doc.type;
      Alert.alert(
        `Renew ${label} 🔄`,
        `Renewing will create a new current record and archive this record into Renewal History.\n\nProceed to fill renewal details?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Renew Now',
            onPress: () => {
              router.push({
                pathname: '/add-document',
                params: { renewFrom: doc.id, renewType: doc.type },
              });
            },
          },
        ]
      );
    },
    [router]
  );

  const handleDelete = useCallback(
    (item: VehicleDocument) => {
      const label =
        DOCUMENT_TYPE_LABELS[item.type as keyof typeof DOCUMENT_TYPE_LABELS] || item.type;
      const ref = item.document_number ? ` (${item.document_number})` : '';

      Alert.alert(
        'Delete Document 🗑️',
        `Are you sure you want to delete this ${label}${ref}?`,
        [
          { text: 'Keep It', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              if (selectedVehicle) {
                try {
                  deleteDocument(item.id, selectedVehicle.id);
                } catch {
                  Alert.alert('Error', 'Failed to delete document. Please try again.');
                }
              }
            },
          },
        ]
      );
    },
    [selectedVehicle, deleteDocument]
  );

  const handleViewPdf = useCallback(async (uri: string, title?: string) => {
    try {
      const exists = await checkFileExists(uri);
      if (!exists) {
        Alert.alert(
          'File Unavailable',
          'The attached PDF file could not be found on device storage.'
        );
        return;
      }
      const res = await openAttachment(uri, title || 'Open PDF');
      if (!res.success && res.message) {
        Alert.alert('Document Viewer', res.message);
      }
    } catch {
      Alert.alert('Document Viewer', 'An error occurred while opening the PDF document.');
    }
  }, []);

  const handleViewImage = useCallback(async (uri: string) => {
    try {
      const exists = await checkFileExists(uri);
      if (!exists) {
        Alert.alert(
          'File Unavailable',
          'The attached image file could not be found on device storage.'
        );
        return;
      }
      setViewerUri(uri);
    } catch {
      Alert.alert('Image Viewer', 'Could not open image file.');
    }
  }, []);

  const handleAddDocument = useCallback(() => {
    router.push({
      pathname: '/add-document',
      params: { vehicleId: selectedVehicle?.id },
    });
  }, [router, selectedVehicle?.id]);

  if (!selectedVehicle) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <DocumentsHeader totalCount={0} colors={colors} />
        <NoVehicleState />
      </View>
    );
  }

  const displayedDocs = activeTab === 'active' ? documents : supersededDocuments;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* ── Top Header: Tab Name "Documents" ── */}
      <DocumentsHeader totalCount={documents.length} colors={colors} />

      {/* ── 1. Global Vehicle Selector ── */}
      <HomeVehicleSelector vehicle={selectedVehicle} colors={colors} />

      {/* ── Document List & Integrated Presentation Sections ── */}
      <FlatList
        data={displayedDocs}
        keyExtractor={(item) => item.id}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            {/* ── 2. Title & Export Action ── */}
            <DocumentHeaderBar
              onExport={() => setShowExportModal(true)}
              colors={colors}
            />

            {/* ── 3. Document Navigation: Active / Renewal History ── */}
            <DocumentNavigation
              activeTab={activeTab}
              onTabChange={setActiveTab}
              activeCount={documents.length}
              historyCount={supersededDocuments.length}
              colors={colors}
            />

            {/* ── 4. Document Status Overview ── */}
            <DocumentStatusOverview
              activeTab={activeTab}
              totalActive={stats.totalActive}
              expiringSoon={stats.expiringSoon}
              expired={stats.expired}
              totalSuperseded={stats.totalSuperseded}
              colors={colors}
            />

            {/* Renewal History Informational Notice */}
            {activeTab === 'history' && supersededDocuments.length > 0 && (
              <View
                style={[
                  styles.historyNotice,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderLight,
                  },
                ]}
              >
                <Text style={[styles.historyNoticeText, { color: colors.textSecondary }]}>
                  📜 <Text style={[styles.historyNoticeBold, { color: colors.text }]}>Archived Policies & Certificates:</Text>{' '}
                  Past records superseded upon renewal, retained safely offline for legal, claim, and audit reference.
                </Text>
              </View>
            )}

            {/* List Section Title */}
            <View style={styles.listSectionHeader}>
              <Text style={[styles.listSectionTitle, { color: colors.textSecondary }]}>
                {activeTab === 'active' ? 'ALL DOCUMENTS' : 'RENEWAL ARCHIVE'}
              </Text>
              <Text style={[styles.listSectionCount, { color: colors.textTertiary }]}>
                {displayedDocs.length} {displayedDocs.length === 1 ? 'record' : 'records'}
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <DocumentCard
            item={item}
            isSuperseded={activeTab === 'history'}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onViewImage={handleViewImage}
            onViewPdf={handleViewPdf}
            onRenew={handleRenew}
            colors={colors}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <DocumentEmptyState
            activeTab={activeTab}
            onAddDocument={handleAddDocument}
            colors={colors}
          />
        }
      />

      {/* ── FAB: Add Document ── */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.accentDark }]}
        activeOpacity={0.85}
        onPress={handleAddDocument}
        accessibilityRole="button"
        accessibilityLabel="Add document"
      >
        <Text style={styles.fabIcon}>+</Text>
        <Text style={styles.fabText}>Add Document</Text>
      </TouchableOpacity>

      {/* ── Fullscreen Image Preview Modal ── */}
      <Modal
        visible={Boolean(viewerUri)}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerUri(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalClose}
            onPress={() => setViewerUri(null)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Close image viewer"
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

      {/* ── Vehicle Reports Export Modal ── */}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    paddingBottom: Spacing.xs,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 100,
  },
  historyNotice: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
  },
  historyNoticeText: {
    fontSize: 12,
    lineHeight: 18,
  },
  historyNoticeBold: {
    fontWeight: '700',
  },
  listSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  listSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  listSectionCount: {
    fontSize: 11,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: Spacing.xxl,
    right: Spacing.lg,
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    gap: Spacing.xs,
  },
  fabIcon: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '700',
    marginTop: -1,
  },
  fabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: 56,
    right: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 10,
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  modalImage: {
    width: '95%',
    height: '80%',
    borderRadius: 12,
  },
});
