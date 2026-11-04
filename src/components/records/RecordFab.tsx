/**
 * RecordFab
 *
 * Implements Requirement 3:
 * Small floating action button at the bottom right.
 * Only shown when a specific section is chosen (Fuel, Service, Trips, Expenses),
 * hidden when "All" is chosen.
 * Features a + sign alongside the respective section icon.
 */

import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import type { RecordCategory } from './recordTypes';
import type { RecordPalette } from './recordTheme';
import {
  CategoryFuelIcon,
  CategoryElectricIcon,
  CategoryServiceIcon,
  CategoryTripIcon,
  CategoryExpenseIcon,
  PlusIconSvg,
} from './RecordSvgIcons';

interface RecordFabProps {
  category: RecordCategory;
  onAddFuel: () => void;
  onAddService: () => void;
  onAddExpense: () => void;
  onAddTrip: () => void;
  isEV?: boolean;
  colors: RecordPalette;
}

export const RecordFab = React.memo(function RecordFab({
  category,
  onAddFuel,
  onAddService,
  onAddExpense,
  onAddTrip,
  isEV = false,
  colors,
}: RecordFabProps) {
  // Requirement 3: "not in all , but in rest"
  if (category === 'all') {
    return null;
  }

  const handlePress = () => {
    switch (category) {
      case 'fuel':
        onAddFuel();
        break;
      case 'service':
        onAddService();
        break;
      case 'expenses':
        onAddExpense();
        break;
      case 'trips':
        onAddTrip();
        break;
    }
  };

  const renderSectionIcon = () => {
    switch (category) {
      case 'fuel':
        return isEV ? (
          <CategoryElectricIcon size={18} color="#FFFFFF" />
        ) : (
          <CategoryFuelIcon size={18} color="#FFFFFF" />
        );
      case 'service':
        return <CategoryServiceIcon size={18} color="#FFFFFF" />;
      case 'trips':
        return <CategoryTripIcon size={18} color="#FFFFFF" />;
      case 'expenses':
        return <CategoryExpenseIcon size={18} color="#FFFFFF" />;
      default:
        return null;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.fab,
        {
          backgroundColor: colors.accent,
          shadowColor: '#000',
        },
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <PlusIconSvg size={16} color="#FFFFFF" />
      <View style={styles.iconSeparator} />
      {renderSectionIcon()}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 22,
    right: 20,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 23,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    elevation: 6,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  iconSeparator: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
});

