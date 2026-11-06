/**
 * InsightsJumpToModal Component
 *
 * Fast navigation sheet opened via the header hamburger button.
 * Allows one-tap jumping to:
 * - Insights Overview
 * - Spending Analysis
 * - Efficiency & Mileage
 * - Vehicle Statistics
 * - Garage Comparison (when 2+ vehicles exist)
 * - Export Report
 * - Share Summary
 */

import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Spacing, Sizing, Typography } from '@/constants/theme';
import type { InsightsPalette } from './insightsTheme';
import type { InsightsSection } from './insightsHelpers';

interface InsightsJumpToModalProps {
  visible: boolean;
  onClose: () => void;
  activeSection: InsightsSection;
  onSelectSection: (section: InsightsSection) => void;
  onExport: () => void;
  onShare: () => void;
  hasFleet: boolean;
  vehicleName: string;
  colors: InsightsPalette;
}

export const InsightsJumpToModal: React.FC<InsightsJumpToModalProps> = ({
  visible,
  onClose,
  activeSection,
  onSelectSection,
  onExport,
  onShare,
  hasFleet,
  vehicleName,
  colors,
}) => {
  const sections: {
    id: InsightsSection;
    title: string;
    description: string;
    icon: string;
    iconBg: string;
  }[] = [
    {
      id: 'overview',
      title: 'Insights Overview',
      description: 'Running costs summary, key metrics & health trajectory',
      icon: '🏠',
      iconBg: colors.accent + '20',
    },
    {
      id: 'spending',
      title: 'Spending Analysis',
      description: 'Fuel vs other costs, category donut chart & monthly spend',
      icon: '💳',
      iconBg: colors.accent + '20',
    },
    {
      id: 'efficiency',
      title: 'Efficiency & Mileage',
      description: 'Mileage trendline, rolling average curve & powertrain config',
      icon: '⚡',
      iconBg: colors.tierGreenBg,
    },
    {
      id: 'statistics',
      title: 'Vehicle Statistics',
      description: 'Fixed 6-month Quick Numbers, consumption & amortization',
      icon: '📊',
      iconBg: colors.tierOrangeBg,
    },
    ...(hasFleet
      ? [
          {
            id: 'fleet' as InsightsSection,
            title: 'Garage Comparison',
            description: 'Compare running costs and mileage across all your vehicles',
            icon: '🚗',
            iconBg: colors.tierYellowBg,
          },
        ]
      : []),
  ];

  const handleSelect = (section: InsightsSection) => {
    onSelectSection(section);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                Jump to Section
              </Text>
              <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>
                {vehicleName} · Quick Navigation
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.closeBtn, { backgroundColor: colors.surfaceSecondary }]}
            >
              <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '800' }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Section List */}
          <ScrollView style={styles.scrollList} showsVerticalScrollIndicator={false}>
            <View style={styles.listContainer}>
              <Text style={[styles.groupHeader, { color: colors.textTertiary }]}>
                ANALYTICS SCREENS
              </Text>

              {sections.map((s) => {
                const isActive = activeSection === s.id;
                return (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => handleSelect(s.id)}
                    activeOpacity={0.7}
                    style={[
                      styles.sectionItem,
                      {
                        backgroundColor: isActive ? colors.primaryLight : colors.surface,
                        borderColor: isActive ? colors.accent : colors.borderLight,
                      },
                    ]}
                  >
                    <View style={[styles.iconWrapper, { backgroundColor: s.iconBg }]}>
                      <Text style={{ fontSize: 18 }}>{s.icon}</Text>
                    </View>
                    <View style={styles.itemTextCol}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.itemTitle, { color: colors.text }]}>
                          {s.title}
                        </Text>
                        {isActive && (
                          <View style={[styles.activePill, { backgroundColor: colors.accent + '25' }]}>
                            <Text style={[styles.activePillText, { color: colors.accent }]}>Active</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.itemDescription, { color: colors.textTertiary }]}>
                        {s.description}
                      </Text>
                    </View>
                    <Text style={[styles.itemArrow, { color: colors.accent }]}>→</Text>
                  </TouchableOpacity>
                );
              })}

              {/* Actions Group */}
              <Text style={[styles.groupHeader, { color: colors.textTertiary, marginTop: Spacing.md }]}>
                ACTIONS & EXPORTS
              </Text>

              <TouchableOpacity
                onPress={() => {
                  onClose();
                  onExport();
                }}
                activeOpacity={0.7}
                style={[styles.actionItem, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderLight }]}
              >
                <View style={[styles.iconWrapper, { backgroundColor: colors.surface }]}>
                  <Text style={{ fontSize: 18 }}>📄</Text>
                </View>
                <View style={styles.itemTextCol}>
                  <Text style={[styles.itemTitle, { color: colors.text }]}>Export Reports</Text>
                  <Text style={[styles.itemDescription, { color: colors.textTertiary }]}>
                    Generate PDF dossier, service ledger & CSV spreadsheet
                  </Text>
                </View>
                <Text style={[styles.itemArrow, { color: colors.accent }]}>→</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  onClose();
                  onShare();
                }}
                activeOpacity={0.7}
                style={[styles.actionItem, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderLight }]}
              >
                <View style={[styles.iconWrapper, { backgroundColor: colors.surface }]}>
                  <Text style={{ fontSize: 18 }}>📤</Text>
                </View>
                <View style={styles.itemTextCol}>
                  <Text style={[styles.itemTitle, { color: colors.text }]}>Share Summary</Text>
                  <Text style={[styles.itemDescription, { color: colors.textTertiary }]}>
                    Send vehicle mileage and expense snapshot via messaging
                  </Text>
                </View>
                <Text style={[styles.itemArrow, { color: colors.accent }]}>→</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '82%',
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollList: {
    paddingHorizontal: Spacing.md,
  },
  listContainer: {
    paddingVertical: Spacing.sm,
    gap: 8,
  },
  groupHeader: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: Spacing.xs,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  sectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    gap: 12,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    gap: 12,
  },
  iconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTextCol: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  itemDescription: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  activePill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Sizing.radiusFull,
  },
  activePillText: {
    fontSize: 9,
    fontWeight: '800',
  },
  itemArrow: {
    fontSize: 16,
    fontWeight: '800',
    paddingHorizontal: 4,
  },
});

