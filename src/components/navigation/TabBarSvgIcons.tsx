/**
 * TabBarSvgIcons
 *
 * Dedicated, crisp, automotive-grade vector SVG icons for the bottom footer navigation tabs:
 * - Home: Cockpit / Modern Vehicle Garage
 * - Records: Vehicle Logbook / Ledger Sheets
 * - Documents: Official Vehicle Document Sheet
 * - Stats: Telemetry Performance & Trend Analytics
 * - Settings: Mechanical Gear / Vehicle Configuration
 *
 * Fully supports dynamic tinting for active (Refined Blue #3983C7) and inactive states.
 */

import React from 'react';
import Svg, { Circle, Path, Rect, G } from 'react-native-svg';

export interface TabBarIconProps {
  color?: string | any;
  size?: number;
  focused?: boolean;
}

/** 1. Home Tab Icon: Modern Automotive Garage / Cockpit */
export const TabHomeIcon: React.FC<TabBarIconProps> = ({ color, size = 22, focused = false }) => {
  const strokeW = focused ? 2.3 : 1.8;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 10.5L12 3L21 10.5V20C21 20.5523 20.5523 21 20 21H15V14H9V21H4C3.44772 21 3 20.5523 3 20V10.5Z"
        stroke={color}
        strokeWidth={strokeW}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={focused ? 'rgba(57, 131, 199, 0.12)' : 'none'}
      />
    </Svg>
  );
};

/** 2. Records Tab Icon: Layered Logbook / Vehicle Ledger Sheets */
export const TabRecordsIcon: React.FC<TabBarIconProps> = ({ color, size = 22, focused = false }) => {
  const strokeW = focused ? 2.3 : 1.8;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z"
        stroke={color}
        strokeWidth={strokeW}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={focused ? 'rgba(57, 131, 199, 0.12)' : 'none'}
      />
      <Path d="M16 2V6" stroke={color} strokeWidth={strokeW} strokeLinecap="round" />
      <Path d="M8 2V6" stroke={color} strokeWidth={strokeW} strokeLinecap="round" />
      <Path d="M7 11H17" stroke={color} strokeWidth={strokeW} strokeLinecap="round" />
      <Path d="M7 15H14" stroke={color} strokeWidth={strokeW} strokeLinecap="round" />
      <Path d="M7 19H11" stroke={color} strokeWidth={strokeW} strokeLinecap="round" />
    </Svg>
  );
};

/** 3. Documents Tab Icon: Official Folded Document Sheet */
export const TabDocumentsIcon: React.FC<TabBarIconProps> = ({ color, size = 22, focused = false }) => {
  const strokeW = focused ? 2.3 : 1.8;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z"
        stroke={color}
        strokeWidth={strokeW}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={focused ? 'rgba(57, 131, 199, 0.12)' : 'none'}
      />
      <Path d="M14 2V8H20" stroke={color} strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8 13H16" stroke={color} strokeWidth={strokeW} strokeLinecap="round" />
      <Path d="M8 17H13" stroke={color} strokeWidth={strokeW} strokeLinecap="round" />
    </Svg>
  );
};

/** 4. Stats Tab Icon: Analytics Trend & Upward Performance Curve */
export const TabStatsIcon: React.FC<TabBarIconProps> = ({ color, size = 22, focused = false }) => {
  const strokeW = focused ? 2.3 : 1.8;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 3V21H21" stroke={color} strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round" />
      <Path
        d="M7 14L12 9L15 12L20 6"
        stroke={color}
        strokeWidth={strokeW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M16 6H20V10" stroke={color} strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
};

/** 5. Settings Tab Icon: Mechanical Gear / Vehicle Configuration */
export const TabSettingsIcon: React.FC<TabBarIconProps> = ({ color, size = 22, focused = false }) => {
  const strokeW = focused ? 2.3 : 1.8;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle
        cx="12"
        cy="12"
        r="3"
        stroke={color}
        strokeWidth={strokeW}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={focused ? 'rgba(57, 131, 199, 0.12)' : 'none'}
      />
      <Path
        d="M19.4 15A1.65 1.65 0 0 0 19.73 16.82L20.08 17.17A2 2 0 0 1 17.17 20.08L16.82 19.73A1.65 1.65 0 0 0 15 19.4A1.65 1.65 0 0 0 13.35 20.5V21A2 2 0 0 1 9.35 21V20.5A1.65 1.65 0 0 0 7.7 19.4A1.65 1.65 0 0 0 5.88 19.73L5.53 20.08A2 2 0 0 1 2.62 17.17L2.97 16.82A1.65 1.65 0 0 0 2.64 15A1.65 1.65 0 0 0 1.54 13.35H1A2 2 0 0 1 1 9.35H1.54A1.65 1.65 0 0 0 2.64 7.7A1.65 1.65 0 0 0 2.31 5.88L1.96 5.53A2 2 0 0 1 4.87 2.62L5.22 2.97A1.65 1.65 0 0 0 7.04 2.64A1.65 1.65 0 0 0 8.69 1.54V1A2 2 0 0 1 12.69 1V1.54A1.65 1.65 0 0 0 14.34 2.64A1.65 1.65 0 0 0 16.16 2.31L16.51 1.96A2 2 0 0 1 19.42 4.87L19.07 5.22A1.65 1.65 0 0 0 19.4 7.04A1.65 1.65 0 0 0 20.5 8.69H21A2 2 0 0 1 21 12.69H20.5A1.65 1.65 0 0 0 19.4 15Z"
        stroke={color}
        strokeWidth={strokeW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};
