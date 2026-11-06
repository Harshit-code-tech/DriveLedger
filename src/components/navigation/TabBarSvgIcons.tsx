/**
 * TabBarSvgIcons
 *
 * Dedicated, crisp, automotive-grade vector SVG icons for the bottom footer navigation tabs:
 * - Home: Cockpit / Modern Vehicle Garage
 * - Records: Vehicle Logbook / Ledger Sheets
 * - Documents: Official Vehicle Document Sheet
 * - Stats: Telemetry Performance & Trend Analytics
 * - Manage: Automotive Management Hub / Sliders & Configuration
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

/** 4. Insights Tab Icon: Analytics Trend & Upward Performance Curve */
export const TabInsightsIcon: React.FC<TabBarIconProps> = ({ color, size = 22, focused = false }) => {
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

export const TabStatsIcon = TabInsightsIcon;

/** 5. Manage Tab Icon: Automotive Management Hub / Sliders & Configuration */
export const TabManageIcon: React.FC<TabBarIconProps> = ({ color, size = 22, focused = false }) => {
  const strokeW = focused ? 2.3 : 1.8;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 6H13" stroke={color} strokeWidth={strokeW} strokeLinecap="round" />
      <Path d="M17 6H20" stroke={color} strokeWidth={strokeW} strokeLinecap="round" />
      <Circle cx="15" cy="6" r="2.2" stroke={color} strokeWidth={strokeW} fill={focused ? 'rgba(57, 131, 199, 0.25)' : 'none'} />
      <Path d="M4 12H7" stroke={color} strokeWidth={strokeW} strokeLinecap="round" />
      <Path d="M11 12H20" stroke={color} strokeWidth={strokeW} strokeLinecap="round" />
      <Circle cx="9" cy="12" r="2.2" stroke={color} strokeWidth={strokeW} fill={focused ? 'rgba(57, 131, 199, 0.25)' : 'none'} />
      <Path d="M4 18H13" stroke={color} strokeWidth={strokeW} strokeLinecap="round" />
      <Path d="M17 18H20" stroke={color} strokeWidth={strokeW} strokeLinecap="round" />
      <Circle cx="15" cy="18" r="2.2" stroke={color} strokeWidth={strokeW} fill={focused ? 'rgba(57, 131, 199, 0.25)' : 'none'} />
    </Svg>
  );
};

export const TabSettingsIcon = TabManageIcon;
