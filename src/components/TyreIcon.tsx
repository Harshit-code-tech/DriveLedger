import React from 'react';
import { View, ViewStyle } from 'react-native';
import Svg, { Circle, Path, G } from 'react-native-svg';

export interface TyreIconProps {
  /** Size in pixels (default: 22) */
  size?: number;
  /** Primary rubber color (default: '#334155' - dark slate rubber) */
  tyreColor?: string;
  /** Rim alloy color (default: '#94A3B8' - metallic alloy silver) */
  rimColor?: string;
  /** Center hub color (default: '#0F172A') */
  hubColor?: string;
  style?: ViewStyle;
}

/**
 * TyreIcon
 *
 * Vector-rendered automotive wheel & tyre component.
 * Replaces unreliable Unicode 14.0 emoji (🛞) that suffers from severe
 * horizontal font-clipping / cropping bugs across Android OEM font engines.
 */
export const TyreIcon: React.FC<TyreIconProps> = ({
  size = 22,
  tyreColor = '#334155',
  rimColor = '#94A3B8',
  hubColor = '#0F172A',
  style,
}) => {
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        {/* Outer tyre rubber */}
        <Circle cx="12" cy="12" r="10.5" fill={tyreColor} />

        {/* Tread pattern grooves */}
        <Circle cx="12" cy="12" r="9" stroke="#1E293B" strokeWidth="0.8" strokeDasharray="1.8, 1.2" />

        {/* Alloy Rim outer lip */}
        <Circle cx="12" cy="12" r="6.8" fill={rimColor} />

        {/* Rim inner brake drum depth */}
        <Circle cx="12" cy="12" r="5.2" fill="#475569" />

        {/* 5-Spoke Alloy Star */}
        <G stroke={rimColor} strokeWidth="1.6" strokeLinecap="round">
          {/* Top */}
          <Path d="M12 12 L12 5.8" />
          {/* Top-Right */}
          <Path d="M12 12 L17.9 10.1" />
          {/* Bottom-Right */}
          <Path d="M12 12 L15.65 17.0" />
          {/* Bottom-Left */}
          <Path d="M12 12 L8.35 17.0" />
          {/* Top-Left */}
          <Path d="M12 12 L6.1 10.1" />
        </G>

        {/* Center Hubcap & Nut */}
        <Circle cx="12" cy="12" r="2.2" fill={hubColor} />
        <Circle cx="12" cy="12" r="0.9" fill="#F8FAFC" />
      </Svg>
    </View>
  );
};
