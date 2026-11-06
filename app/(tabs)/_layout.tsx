import { useHomeColors } from "@/components/home/homeTheme";
import {
  TabDocumentsIcon,
  TabHomeIcon,
  TabRecordsIcon,
  TabSettingsIcon,
  TabStatsIcon,
} from "@/components/navigation/TabBarSvgIcons";
import { Sizing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/useThemeColors";
import * as QuickActions from "expo-quick-actions";
import { useQuickActionRouting } from "expo-quick-actions/router";
import { Tabs } from "expo-router";
import { useEffect } from "react";
import { Image, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabLayout() {
  const colors = useThemeColors();
  const homeColors = useHomeColors();
  const insets = useSafeAreaInsets();

  // Handles one-tap routing when launched from an Android App Shortcut / iOS Quick Action
  useQuickActionRouting();

  useEffect(() => {
    if (Platform.OS !== "web") {
      QuickActions.setItems([
        {
          id: "add_fuel",
          title: "Log Fuel",
          subtitle: "Quick refill entry at pump",
          icon:
            Platform.OS === "ios" ? "symbol:fuelpump.fill" : "shortcut_fuel",
          params: { href: "/add-fuel" },
        },
        {
          id: "add_expense",
          title: "Log Expense",
          subtitle: "Tolls, parking & fastag",
          icon:
            Platform.OS === "ios"
              ? "symbol:creditcard.fill"
              : "shortcut_expense",
          params: { href: "/add-expense" },
        },
        {
          id: "add_service",
          title: "Log Service",
          subtitle: "Maintenance & repairs",
          icon:
            Platform.OS === "ios"
              ? "symbol:wrench.and.screwdriver.fill"
              : "shortcut_service",
          params: { href: "/add-service" },
        },
        {
          id: "trip_checklist",
          title: "Trip Checklist",
          subtitle: "Highway readiness inspection",
          icon:
            Platform.OS === "ios" ? "symbol:checklist" : "shortcut_checklist",
          params: { href: "/checklist" },
        },
      ]).catch(() => {
        // Safe ignore on devices without quick actions support
      });
    }
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        headerTitleStyle: {
          fontWeight: "600",
          fontSize: 18,
          color: colors.text,
        },
        tabBarStyle: {
          backgroundColor: homeColors.surface,
          borderTopColor: homeColors.border,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8,
        },
        tabBarActiveTintColor: homeColors.accent,
        tabBarInactiveTintColor: homeColors.textTertiary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          headerTitleAlign: "left",
          headerStyle: {
            backgroundColor: homeColors.background,
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: homeColors.border,
          },
          headerTitle: () => (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <Image
                source={require("../../assets/images/icon.png")}
                style={{ width: 28, height: 28 }}
                resizeMode="contain"
              />

              {/* Two-tone typographic wordmark */}
              <View style={{ flexDirection: "row", alignItems: "baseline" }}>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: "900",
                    color: homeColors.text,
                    letterSpacing: -0.5,
                  }}
                >
                  Drive
                </Text>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: "400",
                    color: homeColors.text,
                    letterSpacing: -0.2,
                    opacity: 0.85,
                  }}
                >
                  Ledger
                </Text>
              </View>
            </View>
          ),
          tabBarIcon: ({ color, size, focused }) => (
            <View style={styles.tabIconContainer}>
              <TabHomeIcon color={color} size={size} focused={focused} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="records"
        options={{
          title: "Records",
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <View style={styles.tabIconContainer}>
              <TabRecordsIcon color={color} size={size} focused={focused} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          title: "Documents",
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <View style={styles.tabIconContainer}>
              <TabDocumentsIcon color={color} size={size} focused={focused} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: "Stats",
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <View style={styles.tabIconContainer}>
              <TabStatsIcon color={color} size={size} focused={focused} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size, focused }) => (
            <View style={styles.tabIconContainer}>
              <TabSettingsIcon color={color} size={size} focused={focused} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIconContainer: {
    width: Sizing.touchTarget,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
  },
});
