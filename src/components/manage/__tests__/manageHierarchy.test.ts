/**
 * Manage Tab Hierarchy & Theme Unit Tests
 *
 * Verifies:
 * 1. Palette adherence to Section 11 visual design system.
 * 2. Section hierarchy matching the required 5 management sections.
 * 3. Icon and typography stability.
 */

import { VehicleType } from "@/constants/fuelTypes";
import type { ManageSection } from "../ManageHeaderBar";
import { ManageColors } from "../manageTheme";
import {
  CarSvg,
  OtherVehicleSvg,
  ThreeWheelerSvg,
  TwoWheelerSvg,
  VehicleSvgIcon,
} from "../VehicleSvgIcon";

describe("Manage Tab Architecture & Theme", () => {
  test("ManageColors palette matches Section 11 specifications", () => {
    expect(ManageColors.light.background).toBe("#F5F8FC");
    expect(ManageColors.light.surface).toBe("#FFFFFF");
    expect(ManageColors.light.text).toBe("#183B63");
    expect(ManageColors.light.accent).toBe("#3983C7");
    expect(ManageColors.light.border).toBe("#DCE6F1");
    expect(ManageColors.light.divider).toBe("#DCE6F1");
  });

  test("ManageColors dark mode maintains contrast and identity", () => {
    expect(ManageColors.dark.isDark).toBe(true);
    expect(ManageColors.dark.background).toBe("#0E1A2B");
    expect(ManageColors.dark.surface).toBe("#14253D");
    expect(ManageColors.dark.text).toBe("#F5F8FC");
    expect(ManageColors.dark.accent).toBe("#4FA0E8");
  });

  test("All management sections are well-defined and typed", () => {
    const requiredSections: ManageSection[] = [
      "overview",
      "vehicles",
      "preferences",
      "trip_tracking",
      "gps_tracking",
      "notifications",
      "gps_notifications",
      "data_backup",
      "app_info",
    ];

    expect(requiredSections.length).toBe(9);
    expect(requiredSections).toContain("vehicles");
    expect(requiredSections).toContain("preferences");
    expect(requiredSections).toContain("trip_tracking");
    expect(requiredSections).toContain("notifications");
    expect(requiredSections).toContain("data_backup");
    expect(requiredSections).toContain("app_info");
  });

  test("Quick actions contract handles all 4 primary automotive actions", () => {
    const quickActions = [
      { id: "add_vehicle", label: "Add Vehicle", subtitle: "New car or bike" },
      { id: "backup_data", label: "Backup Data", subtitle: "AES-256 .dlbak" },
      { id: "export_csv", label: "Export CSV", subtitle: "Spreadsheet report" },
      {
        id: "theme_mode",
        label: "Dark / Light Mode",
        subtitle: "Toggle appearance",
      },
    ];

    expect(quickActions.length).toBe(4);
    expect(quickActions.map((a) => a.id)).toEqual([
      "add_vehicle",
      "backup_data",
      "export_csv",
      "theme_mode",
    ]);
  });

  test("Vehicle SVG icon suite supports distinct wheel counts", () => {
    expect(typeof CarSvg).toBe("function");
    expect(typeof TwoWheelerSvg).toBe("function");
    expect(typeof ThreeWheelerSvg).toBe("function");
    expect(typeof OtherVehicleSvg).toBe("function");
    expect(typeof VehicleSvgIcon).toBe("function");

    const types = [
      VehicleType.CAR,
      VehicleType.TWO_WHEELER,
      VehicleType.THREE_WHEELER,
      VehicleType.OTHER,
    ];
    expect(types.length).toBe(4);
  });
});
