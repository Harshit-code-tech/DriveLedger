/**
 * RecordSvgIcons
 *
 * Dedicated crisp SVG icons for the Records screen categories, filters,
 * hamburger menu, and search using react-native-svg.
 */

import React from 'react';
import Svg, { Circle, Path, Rect, Line, G } from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
}

/** All Records icon (layered logbook / ledger sheets) */
export const CategoryAllIcon: React.FC<IconProps> = ({ size = 20, color = '#3983C7' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path d="M16 2V6" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Path d="M8 2V6" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Path d="M7 11H17" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Path d="M7 15H14" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Path d="M7 19H11" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);

/** Fuel dispenser pump icon (ICE) */
export const CategoryFuelIcon: React.FC<IconProps> = ({ size = 20, color = '#3983C7' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 21V5C3 3.89543 3.89543 3 5 3H13C14.1046 3 15 3.89543 15 5V21"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path d="M3 21H15" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Path
      d="M6 7H12V11H6V7Z"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M15 8H17.5C18.3284 8 19 8.67157 19 9.5V14C19 14.5523 18.5523 15 18 15H17"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <Path
      d="M17 13V17.5C17 18.3284 17.6716 19 18.5 19C19.3284 19 20 18.3284 20 17.5V12L19 11"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/** Electric Charging lightning icon (EV) */
export const CategoryElectricIcon: React.FC<IconProps> = ({ size = 20, color = '#3983C7' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M13 2L3 14H12L11 22L21 10H12L13 2Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/** Service & Maintenance wrench icon */
export const CategoryServiceIcon: React.FC<IconProps> = ({ size = 20, color = '#3983C7' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M14.7 6.3A5 5 0 0 0 7.3 13.7L2 19L5 22L10.3 16.7A5 5 0 0 0 17.7 9.3L15 12L12 9L14.7 6.3Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/** Trips navigation route icon */
export const CategoryTripIcon: React.FC<IconProps> = ({ size = 20, color = '#3983C7' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="6" cy="19" r="3" stroke={color} strokeWidth="2" />
    <Circle cx="18" cy="5" r="3" stroke={color} strokeWidth="2" />
    <Path
      d="M6 16V11C6 9.34315 7.34315 8 9 8H15C16.6569 8 18 9.34315 18 11V8"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M12 8L15 5L12 2"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/** Expense wallet / card icon */
export const CategoryExpenseIcon: React.FC<IconProps> = ({ size = 20, color = '#3983C7' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect
      x="2"
      y="5"
      width="20"
      height="14"
      rx="3"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path d="M2 10H22" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Circle cx="6" cy="15" r="1.2" fill={color} />
  </Svg>
);

/** Hamburger menu icon (3 horizontal lines) */
export const HamburgerIcon: React.FC<IconProps> = ({ size = 20, color = '#183B63' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M4 6H20" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    <Path d="M4 12H20" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    <Path d="M4 18H20" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
  </Svg>
);

/** Filter sliders / funnel icon */
export const FilterIcon: React.FC<IconProps> = ({ size = 18, color = '#183B63' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M22 3H2L10 12.46V19L14 21V12.46L22 3Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/** Search magnifying glass icon */
export const SearchIconSvg: React.FC<IconProps> = ({ size = 18, color = '#183B63' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth="2.2" />
    <Path d="M20 20L16 16" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
  </Svg>
);

/** Plus icon for FAB */
export const PlusIconSvg: React.FC<IconProps> = ({ size = 18, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 5V19" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    <Path d="M5 12H19" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
  </Svg>
);

