/**
 * VehicleTypeIcon
 *
 * Displays the dedicated vehicle type icon for DriveLedger's 4 vehicle types:
 * 🚗 Car (VehicleType.CAR)
 * 🏍️ Two Wheeler (VehicleType.TWO_WHEELER)
 * 🛺 Three Wheeler (VehicleType.THREE_WHEELER)
 * 🚘 Other / Commercial (VehicleType.OTHER)
 */

import React from 'react';
import { Text, StyleSheet, TextStyle } from 'react-native';
import { VehicleType } from '@/constants/fuelTypes';

interface VehicleTypeIconProps {
  type: VehicleType | string;
  size?: number;
  style?: TextStyle;
}

export const VEHICLE_TYPE_ICONS: Record<VehicleType, string> = {
  [VehicleType.CAR]: '🚗',
  [VehicleType.TWO_WHEELER]: '🏍️',
  [VehicleType.THREE_WHEELER]: '🛺',
  [VehicleType.OTHER]: '🚘',
};

export function VehicleTypeIcon({ type, size = 20, style }: VehicleTypeIconProps) {
  const emoji = VEHICLE_TYPE_ICONS[type as VehicleType] || '🚗';

  return (
    <Text
      style={[
        styles.icon,
        {
          fontSize: size,
          lineHeight: Math.round(size * 1.2),
        },
        style,
      ]}
    >
      {emoji}
    </Text>
  );
}

const styles = StyleSheet.create({
  icon: {
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
});
