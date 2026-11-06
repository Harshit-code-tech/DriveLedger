/**
 * VehicleSvgIcon
 *
 * Dedicated automotive vector SVG icons customized per wheel count & vehicle type:
 * - 2-Wheeler (Motorcycle / Scooter) -> VehicleType.TWO_WHEELER (2 wheels)
 * - 3-Wheeler (Auto Rickshaw / Tuk-Tuk) -> VehicleType.THREE_WHEELER (3 wheels)
 * - 4-Wheeler (Passenger Car / Sedan / SUV) -> VehicleType.CAR (4 wheels)
 * - Multi-wheel / Commercial (Van / Truck) -> VehicleType.OTHER
 */

import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { VehicleType } from '@/constants/fuelTypes';

export interface VehicleIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/** 1. Car (4 Wheels): Passenger car / Sedan / Hatchback profile */
export const CarSvg: React.FC<VehicleIconProps> = ({
  size = 22,
  color = '#3983C7',
  strokeWidth = 1.8,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 13.5L5.5 11L9.5 7.5H14.5L18 11L20.5 12.5C21.2 12.9 21.5 13.5 21.5 14.2V16H19.5"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M3 13.5V16H4.5M9.5 16H14.5"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
    <Circle cx="7" cy="16" r="2.4" stroke={color} strokeWidth={strokeWidth} />
    <Circle cx="7" cy="16" r="0.8" fill={color} />
    <Circle cx="17" cy="16" r="2.4" stroke={color} strokeWidth={strokeWidth} />
    <Circle cx="17" cy="16" r="0.8" fill={color} />
    <Path
      d="M6 11H17.5M10 7.5V11M14 7.5V11"
      stroke={color}
      strokeWidth={strokeWidth * 0.8}
      strokeLinecap="round"
    />
  </Svg>
);

/** 2. Two Wheeler (2 Wheels): Motorcycle / Scooter profile */
export const TwoWheelerSvg: React.FC<VehicleIconProps> = ({
  size = 22,
  color = '#3983C7',
  strokeWidth = 1.8,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="5.5" cy="16" r="2.8" stroke={color} strokeWidth={strokeWidth} />
    <Circle cx="5.5" cy="16" r="0.9" fill={color} />
    <Circle cx="18.5" cy="16" r="2.8" stroke={color} strokeWidth={strokeWidth} />
    <Circle cx="18.5" cy="16" r="0.9" fill={color} />
    <Path
      d="M18.5 16L15.5 7M14 6.5H17"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M5.5 16L9.5 11H13L15.5 7M9.5 11L11.5 16H14.5L16 11.5"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M8 10H12.5"
      stroke={color}
      strokeWidth={strokeWidth + 0.6}
      strokeLinecap="round"
    />
  </Svg>
);

/** 3. Three Wheeler (3 Wheels): Auto Rickshaw / Tuk-Tuk / Trike */
export const ThreeWheelerSvg: React.FC<VehicleIconProps> = ({
  size = 22,
  color = '#3983C7',
  strokeWidth = 1.8,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="6.5" cy="16.5" r="2.4" stroke={color} strokeWidth={strokeWidth} />
    <Circle cx="6.5" cy="16.5" r="0.8" fill={color} />
    <Circle cx="18" cy="16.5" r="2.4" stroke={color} strokeWidth={strokeWidth} />
    <Circle cx="18" cy="16.5" r="0.8" fill={color} />
    <Path
      d="M3.5 15V7.5C3.5 6.7 4.2 6 5 6H13.5L18.5 11.5L19.5 14C19.8 14.6 19.3 15.5 18.5 15.5H18"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M7.5 15.5V10H13V15.5"
      stroke={color}
      strokeWidth={strokeWidth * 0.85}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M13.5 7.5L17.5 11.5"
      stroke={color}
      strokeWidth={strokeWidth * 0.85}
      strokeLinecap="round"
    />
    <Path
      d="M3.5 15.5H4M9 15.5H15.5"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  </Svg>
);

/** 4. Other Vehicle (Multi-wheel / Van / Truck / Commercial) */
export const OtherVehicleSvg: React.FC<VehicleIconProps> = ({
  size = 22,
  color = '#3983C7',
  strokeWidth = 1.8,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="6.5" cy="16" r="2.4" stroke={color} strokeWidth={strokeWidth} />
    <Circle cx="6.5" cy="16" r="0.8" fill={color} />
    <Circle cx="17.5" cy="16" r="2.4" stroke={color} strokeWidth={strokeWidth} />
    <Circle cx="17.5" cy="16" r="0.8" fill={color} />
    <Path
      d="M2.5 15.5V7C2.5 6.4 2.9 6 3.5 6H14V11H18L21.5 13.5V15.5H20M2.5 15.5H4M9 16H15"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M14 7.5H17.5L20 10.5H14V7.5Z"
      stroke={color}
      strokeWidth={strokeWidth * 0.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/**
 * VehicleSvgIcon
 * Dynamic wheel-count aware vehicle icon.
 */
export const VehicleSvgIcon: React.FC<{
  vehicleType?: VehicleType | string | null;
  size?: number;
  color?: string;
  strokeWidth?: number;
}> = ({
  vehicleType,
  size = 22,
  color = '#3983C7',
  strokeWidth = 1.8,
}) => {
  switch (vehicleType) {
    case VehicleType.TWO_WHEELER:
      return <TwoWheelerSvg size={size} color={color} strokeWidth={strokeWidth} />;
    case VehicleType.THREE_WHEELER:
      return <ThreeWheelerSvg size={size} color={color} strokeWidth={strokeWidth} />;
    case VehicleType.OTHER:
      return <OtherVehicleSvg size={size} color={color} strokeWidth={strokeWidth} />;
    case VehicleType.CAR:
    default:
      return <CarSvg size={size} color={color} strokeWidth={strokeWidth} />;
  }
};
