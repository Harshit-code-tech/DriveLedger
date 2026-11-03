/**
 * HomeHeader
 *
 * Section 3: App Header
 * Compact identity bar displaying the DriveLedger logo and app title.
 */

import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Spacing } from '@/constants/theme';
import { type HomePalette } from './homeTheme';

interface HomeHeaderProps {
  colors: HomePalette;
}

export const HomeHeader = React.memo(function HomeHeader({ colors }: HomeHeaderProps) {
  return (
    <View style={[styles.headerContainer, { backgroundColor: colors.background }]}>
      <View style={styles.brandingRow}>
        <Image
          source={require('../../../assets/images/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.titleWrap}>
          <Text style={[styles.title, { color: colors.text }]}>DriveLedger</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Automotive Cockpit</Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  brandingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});

