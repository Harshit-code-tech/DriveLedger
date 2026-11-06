/**
 * HomeHeader
 *
 * Section 3: App Header (Option 2: Human / Temporal Greeting)
 * Dynamic time-of-day greeting ("Good morning ☀️", "Good afternoon 🌤️", "Good evening 🌙", "Good night 🌙")
 * paired with a clean, localized date pill ("Friday, 6 Nov").
 * Zero duplication with vehicle data, GPS, or stats cards below.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { type HomePalette } from './homeTheme';

interface HomeHeaderProps {
  colors: HomePalette;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getGreeting(hour: number): { text: string; emoji: string } {
  if (hour >= 5 && hour < 12) {
    return { text: 'Good morning', emoji: '☀️' };
  }
  if (hour >= 12 && hour < 17) {
    return { text: 'Good afternoon', emoji: '🌤️' };
  }
  if (hour >= 17 && hour < 22) {
    return { text: 'Good evening', emoji: '🌙' };
  }
  return { text: 'Good night', emoji: '🌙' };
}

export const HomeHeader = React.memo(function HomeHeader({ colors }: HomeHeaderProps) {
  const { greeting, formattedDate } = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    const greet = getGreeting(hour);
    const day = DAYS[now.getDay()];
    const dateNum = now.getDate();
    const month = MONTHS[now.getMonth()];
    return {
      greeting: greet,
      formattedDate: `${day}, ${dateNum} ${month}`,
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.contentRow}>
        <View style={styles.greetingCol}>
          <Text style={[styles.greetingText, { color: colors.text }]} numberOfLines={1}>
            {greeting.text} {greeting.emoji}
          </Text>
          <Text style={[styles.subText, { color: colors.textSecondary }]} numberOfLines={1}>
            Ready to roll
          </Text>
        </View>

        <View
          style={[
            styles.dateBadge,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderLight,
            },
          ]}
        >
          <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
            <Path
              d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z"
              stroke={colors.accent}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="M16 2V6M8 2V6M3 10H21"
              stroke={colors.accent}
              strokeWidth={1.8}
              strokeLinecap="round"
            />
          </Svg>
          <Text style={[styles.dateText, { color: colors.textSecondary }]}>
            {formattedDate}
          </Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greetingCol: {
    flex: 1,
  },
  greetingText: {
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
});
