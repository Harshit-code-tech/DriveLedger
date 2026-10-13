import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';

export interface CngTankIconProps {
  /** Total height/bounding size of the icon in pixels (default: 20) */
  size?: number;
  /** Primary body color of the tank (default: #059669 - CNG Eco Green) */
  color?: string;
  /** Custom container style */
  style?: ViewStyle;
  /** Whether to show the "CNG" text label on the cylinder body (default: true) */
  showLabel?: boolean;
  /** Custom text to display on the tank, defaults to "CNG" */
  label?: string;
  /** Orientation of the cylinder: 'vertical' (standing cylinder) or 'horizontal' (car-boot tank) */
  orientation?: 'vertical' | 'horizontal';
}

/**
 * CngTankIcon
 *
 * A custom vector-rendered automotive CNG high-pressure cylinder tank icon.
 * Replaces generic oil drum emojis (🛢️) with an authentic compressed gas cylinder
 * featuring brass valve, metallic neck, cylindrical dome body, and "CNG" mark.
 */
export const CngTankIcon: React.FC<CngTankIconProps> = ({
  size = 20,
  color = '#059669',
  style,
  showLabel = true,
  label = 'CNG',
  orientation = 'vertical',
}) => {
  if (orientation === 'horizontal') {
    const tankWidth = Math.round(size * 1.3);
    const tankHeight = Math.round(size * 0.7);
    const valveWidth = Math.max(3, Math.round(size * 0.16));
    const valveHeight = Math.max(2, Math.round(tankHeight * 0.45));
    const borderRadius = Math.round(tankHeight * 0.45);

    return (
      <View style={[styles.horizontalContainer, { height: tankHeight + 2 }, style]}>
        {/* Horizontal Body */}
        <View
          style={[
            styles.horizontalBody,
            {
              width: tankWidth,
              height: tankHeight,
              borderRadius,
              backgroundColor: color,
            },
          ]}
        >
          {/* Top gloss highlight */}
          <View
            style={[
              styles.horizontalGloss,
              {
                height: Math.max(1.5, Math.round(tankHeight * 0.22)),
                borderRadius: Math.round(borderRadius * 0.6),
              },
            ]}
          />
          {/* Mounting strap 1 */}
          <View
            style={[
              styles.strapBand,
              {
                left: Math.round(tankWidth * 0.25),
                height: tankHeight,
              },
            ]}
          />
          {/* Mounting strap 2 */}
          <View
            style={[
              styles.strapBand,
              {
                right: Math.round(tankWidth * 0.25),
                height: tankHeight,
              },
            ]}
          />
          {/* Label */}
          {showLabel && size >= 14 ? (
            <Text
              style={[
                styles.cngLabel,
                {
                  fontSize: Math.max(6, Math.round(size * 0.24)),
                  letterSpacing: 0.5,
                },
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          ) : null}
        </View>

        {/* Side Valve / Pressure Nozzle */}
        <View
          style={[
            styles.horizontalValve,
            {
              width: valveWidth,
              height: valveHeight,
              backgroundColor: '#D97706',
              borderTopRightRadius: 2,
              borderBottomRightRadius: 2,
            },
          ]}
        />
      </View>
    );
  }

  // ── Vertical Cylinder (Default) ──
  const tankWidth = Math.round(size * 0.68);
  const tankHeight = Math.round(size * 0.88);
  const valveWidth = Math.max(4, Math.round(tankWidth * 0.48));
  const valveHeight = Math.max(2, Math.round(size * 0.12));
  const neckWidth = Math.max(3, Math.round(tankWidth * 0.28));
  const neckHeight = Math.max(2, Math.round(size * 0.08));
  const borderRadius = Math.round(tankWidth * 0.42);

  return (
    <View
      style={[
        styles.verticalContainer,
        {
          width: Math.max(size, tankWidth + 2),
          height: tankHeight + valveHeight + neckHeight + 1,
        },
        style,
      ]}
    >
      {/* Top Brass Valve Knob */}
      <View
        style={[
          styles.valveHandle,
          {
            width: valveWidth,
            height: valveHeight,
            borderRadius: 1.5,
            backgroundColor: '#D97706', // Brass valve knob
          },
        ]}
      />

      {/* Valve Neck Connector */}
      <View
        style={[
          styles.valveNeck,
          {
            width: neckWidth,
            height: neckHeight,
            backgroundColor: '#475569', // Steel neck
          },
        ]}
      />

      {/* High-Pressure Rounded Cylinder Body */}
      <View
        style={[
          styles.cylinderBody,
          {
            width: tankWidth,
            height: tankHeight,
            borderRadius,
            backgroundColor: color,
          },
        ]}
      >
        {/* Cylindrical 3D Gloss Highlight on left shoulder */}
        <View
          style={[
            styles.glossHighlight,
            {
              width: Math.max(1.5, Math.round(tankWidth * 0.18)),
              borderRadius: Math.round(borderRadius * 0.7),
            },
          ]}
        />

        {/* Neck collar weld line */}
        <View
          style={[
            styles.collarBand,
            {
              top: Math.round(tankHeight * 0.2),
              height: 1,
            },
          ]}
        />

        {/* "CNG" Text Mark inside cylinder */}
        {showLabel && size >= 14 ? (
          <Text
            style={[
              styles.cngLabel,
              {
                fontSize: Math.max(6, Math.round(size * 0.26)),
                lineHeight: Math.max(7, Math.round(size * 0.3)),
              },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  verticalContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  horizontalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  valveHandle: {
    borderWidth: 0.5,
    borderColor: '#B45309',
  },
  valveNeck: {},
  cylinderBody: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  horizontalBody: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  horizontalValve: {
    borderWidth: 0.5,
    borderColor: '#B45309',
  },
  glossHighlight: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  horizontalGloss: {
    position: 'absolute',
    top: 1.5,
    left: 4,
    right: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  collarBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  strapBand: {
    position: 'absolute',
    width: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  cngLabel: {
    color: '#FFFFFF',
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
});

export default CngTankIcon;
