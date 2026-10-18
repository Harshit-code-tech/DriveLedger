import React from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import { TyreIcon } from '@/components/TyreIcon';

const TYRE_EMOJI = '🛞';

interface CategoryIconProps {
  /** Emoji string from a constants table (e.g. service template / expense category) */
  icon: string;
  /** Font size for emoji / pixel size for vector icons */
  size?: number;
  style?: StyleProp<TextStyle>;
}

/**
 * Renders a category emoji, swapping the tyre emoji (which gets cropped on many
 * Android OEM fonts) for the custom vector TyreIcon.
 */
export function CategoryIcon({ icon, size = 18, style }: CategoryIconProps) {
  if (icon === TYRE_EMOJI) {
    return <TyreIcon size={size + 2} />;
  }
  return <Text style={[{ fontSize: size }, style]}>{icon}</Text>;
}
