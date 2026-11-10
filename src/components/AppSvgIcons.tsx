/**
 * AppSvgIcons
 *
 * Dedicated crisp, automotive-grade vector SVG icons for:
 * - ExportReportIcon: Standard executive export glyph (output tray with upward transmission vector).
 *   Replaces generic text document / folded paper emojis with an action-oriented export symbol.
 * - RemindersAlertIcon: Symmetrical architectural bell with top suspension crown,
 *   flush clapper lip, and balanced alert chime indicators.
 * - ShareIcon: 3-node connected distribution graph for native sharing actions.
 */

import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export interface AppIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/**
 * ExportReportIcon
 *
 * Universal executive export icon: Action-oriented output tray with upward export vector.
 * Visually communicates exporting/saving data out of the system.
 */
export const ExportReportIcon: React.FC<AppIconProps> = ({
  size = 20,
  color = '#3983C7',
  strokeWidth = 1.8,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* Base export tray / container with rounded foundation */}
    <Path
      d="M21 15V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V15"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Dynamic upward export arrowhead */}
    <Path
      d="M7 9L12 4L17 9"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Upward transmission / output shaft */}
    <Path
      d="M12 4V16"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/**
 * RemindersAlertIcon
 *
 * Upgraded geometric notification & alert icon:
 * - Symmetrical crown suspension loop
 * - Harmonious, balanced bell body with smooth waist and flared rim
 * - Flush clapper sitting directly at the base lip
 * - Precision bilateral alert chime waves representing active notifications
 */
export const RemindersAlertIcon: React.FC<AppIconProps> = ({
  size = 22,
  color = '#3983C7',
  strokeWidth = 1.8,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* Top crown suspension loop */}
    <Path
      d="M10.5 3.5C10.5 2.67 11.17 2 12 2C12.83 2 13.5 2.67 13.5 3.5"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
    {/* Symmetrical bell body */}
    <Path
      d="M6 9C6 5.686 8.686 3.5 12 3.5C15.314 3.5 18 5.686 18 9C18 13.5 20.5 15.5 20.5 16.5H3.5C3.5 15.5 6 13.5 6 9Z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Flush resonant clapper */}
    <Path
      d="M9.5 16.5C9.5 17.88 10.62 19.5 12 19.5C13.38 19.5 14.5 17.88 14.5 16.5"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Left alert chime wave */}
    <Path
      d="M2.5 7.5C1.6 8.8 1.2 10.4 1.2 12"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
    {/* Right alert chime wave */}
    <Path
      d="M21.5 7.5C22.4 8.8 22.8 10.4 22.8 12"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  </Svg>
);

/**
 * ShareIcon
 *
 * Automotive-grade vector share glyph: 3 distribution nodes with clean connecting lines.
 */
export const ShareIcon: React.FC<AppIconProps> = ({
  size = 18,
  color = '#3983C7',
  strokeWidth = 1.8,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="18" cy="5" r="3" stroke={color} strokeWidth={strokeWidth} />
    <Circle cx="6" cy="12" r="3" stroke={color} strokeWidth={strokeWidth} />
    <Circle cx="18" cy="19" r="3" stroke={color} strokeWidth={strokeWidth} />
    <Path
      d="M8.59 13.51L15.42 17.49"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
    <Path
      d="M15.41 6.51L8.59 10.49"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  </Svg>
);
