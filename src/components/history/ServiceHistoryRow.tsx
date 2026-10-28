import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Sizing, Spacing, Typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { ServiceRecord, MaintenanceComponent } from '@/types/service';
import { TyreIcon } from '@/components/TyreIcon';
import { formatDisplayDateLong } from '@/utils/date';
import { formatCurrency } from '@/utils/format';

interface ServiceHistoryRowProps {
  item: ServiceRecord;
  components: MaintenanceComponent[];
  onPress: (record: ServiceRecord) => void;
  onLongPress: (record: ServiceRecord) => void;
}

function renderComponentTagIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('tyre') || lower.includes('tire')) {
    return <TyreIcon size={12} />;
  }
  if (lower.includes('oil filter')) return <Text style={{ fontSize: 10 }}>⚙️</Text>;
  if (lower.includes('oil')) return <Text style={{ fontSize: 10 }}>🛢️</Text>;
  if (lower.includes('brake')) return <Text style={{ fontSize: 10 }}>🛑</Text>;
  if (lower.includes('spark')) return <Text style={{ fontSize: 10 }}>⚡</Text>;
  if (lower.includes('battery')) return <Text style={{ fontSize: 10 }}>🔋</Text>;
  if (lower.includes('air')) return <Text style={{ fontSize: 10 }}>💨</Text>;
  if (lower.includes('coolant')) return <Text style={{ fontSize: 10 }}>🧪</Text>;
  if (lower.includes('belt')) return <Text style={{ fontSize: 10 }}>🔄</Text>;
  return <Text style={{ fontSize: 10 }}>⚙️</Text>;
}

export const ServiceHistoryRow = memo(function ServiceHistoryRow({
  item,
  components,
  onPress,
  onLongPress,
}: ServiceHistoryRowProps) {
  const colors = useThemeColors();

  return (
    <TouchableOpacity
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress(item)}
      activeOpacity={0.7}
      style={[styles.entryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.entryHeader}>
        <Text style={[Typography.body, { color: colors.text, fontWeight: '600' }]}>
          {item.service_type}
        </Text>
        {item.cost != null && (
          <Text style={[Typography.body, { color: colors.primary, fontWeight: '700' }]}>
            {formatCurrency(item.cost)}
          </Text>
        )}
      </View>

      <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
        {formatDisplayDateLong(item.date)}
        {item.odometer != null ? ` · ${Math.round(item.odometer).toLocaleString('en-IN')} km` : ''}
        {item.garage_name ? ` · ${item.garage_name}` : ''}
      </Text>

      {item.work_done ? (
        <Text style={[Typography.bodySmall, { color: colors.textTertiary, marginTop: Spacing.xs }]}>
          {item.work_done}
        </Text>
      ) : null}

      {/* ── Parts & Components Serviced Tags ── */}
      {(components.length > 0 || !!item.receipt_photo_uri) && (
        <View style={styles.compTagsContainer}>
          {components.map((c) => (
            <View
              key={c.id}
              style={[styles.compTagPill, { backgroundColor: colors.borderLight, borderColor: colors.border }]}
            >
              {renderComponentTagIcon(c.component_name)}
              <Text style={[styles.compTagText, { color: colors.text }]}>
                {c.component_name}
                {c.brand ? ` (${c.brand})` : ''}
              </Text>
            </View>
          ))}
          {item.receipt_photo_uri ? (
            <View
              style={[
                styles.compTagPill,
                { backgroundColor: colors.primaryLight, borderColor: colors.primary + '40' },
              ]}
            >
              <Text style={{ fontSize: 10 }}>🧾</Text>
              <Text style={[styles.compTagText, { color: colors.primary, fontWeight: '700' }]}>
                Invoice
              </Text>
            </View>
          ) : null}
        </View>
      )}

      <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: Spacing.xs }]}>
        Tap to edit · Long press to delete
      </Text>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  entryCard: {
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  compTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: Spacing.sm,
  },
  compTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
  },
  compTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
