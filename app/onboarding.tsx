/**
 * Onboarding & Walkthrough Screen
 *
 * Provides a modern, 5-slide interactive walkthrough explaining DriveLedger's
 * offline-first architecture, weighted mileage precision, smart maintenance insights,
 * document fine-avoidance reminders, and GPS trip tracking.
 *
 * Supports two modes:
 * - First-launch mode: Walks through the slides, then transitions to Add Vehicle form.
 * - Replay mode (?mode=replay): Launched from Settings. Allows user to revisit the guide
 *   anytime. Finishing or skipping safely navigates back without touching user data.
 */

import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  FUEL_TYPE_LABELS,
  FuelType,
  VEHICLE_TYPE_LABELS,
  VehicleType,
  isElectricFuel,
  isHybridFuel,
} from '@/constants/fuelTypes';
import { Sizing, Spacing, Typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useVehicleStore } from '@/stores/vehicleStore';
import { usePreferencesStore } from '@/stores/preferencesStore';

interface WalkthroughSlide {
  emoji: string;
  badge: string;
  title: string;
  subtitle: string;
  highlights: { icon: string; title: string; desc: string }[];
}

const SLIDES: WalkthroughSlide[] = [
  {
    emoji: '🚗',
    badge: '100% Offline & Private',
    title: 'Welcome to DriveLedger',
    subtitle: 'The intelligent, private vehicle manager.',
    highlights: [
      { icon: '🔒', title: 'Zero Cloud & No Accounts', desc: 'All data stays on your device inside encrypted local SQLite.' },
      { icon: '⚡', title: 'Fast & Instant', desc: 'Works with zero internet connection in basements, highways, and tunnels.' },
      { icon: '📦', title: 'Encrypted Backups', desc: 'AES-256-GCM secure export whenever you need to transfer data.' },
    ],
  },
  {
    emoji: '⛽',
    badge: 'Precision Metrics',
    title: 'Tank-to-Tank Mileage',
    subtitle: 'Mathematically rigorous fuel tracking.',
    highlights: [
      { icon: '📐', title: 'Weighted Running Average', desc: 'Calculates physical total distance over total volume without rate bias.' },
      { icon: '🔄', title: 'Bi-Fuel & Dual-Tank', desc: 'Dedicated tracking for CNG + Petrol, LPG, Hybrid, and Electric EVs.' },
      { icon: '📊', title: 'Estimated Fuel Gauge', desc: 'Real-time estimated tank level and remaining driving range.' },
    ],
  },
  {
    emoji: '🛠️',
    badge: 'Proactive Health',
    title: 'Smart Insights & Targets',
    subtitle: 'Stay ahead of wear, maintenance, and costs.',
    highlights: [
      { icon: '🎯', title: 'Custom Target Intervals', desc: 'Define your own service targets for engine oil, brake pads, and tyres.' },
      { icon: '🔁', title: 'Repeated Repair Detection', desc: 'Flags multiple component replacements within 5,000 km or 180 days.' },
      { icon: '📉', title: 'Sustained Mileage Warnings', desc: 'Alerts you to significant efficiency drops across completed fills.' },
    ],
  },
  {
    emoji: '🔔',
    badge: 'Fine Avoidance',
    title: 'Document & Service Alerts',
    subtitle: 'Never miss a critical renewal deadline.',
    highlights: [
      { icon: '🚨', title: 'PUC Fine Warning', desc: 'Specific high-priority alerts to avoid heavy fines under Sec 190(2).' },
      { icon: '📅', title: 'Daily Expiry Nudges', desc: 'Scheduled notifications at 9 AM when documents enter the expiry window.' },
      { icon: '⚙️', title: 'Granular Preferences', desc: 'Customize lead days and enable/disable individual reminder categories.' },
    ],
  },
  {
    emoji: '🗺️',
    badge: 'Driver Tools',
    title: 'GPS Trips & Quick Tools',
    subtitle: 'Engineered for smooth everyday driving.',
    highlights: [
      { icon: '📍', title: 'Active Trip HUD', desc: 'Large high-contrast display with live distance, elapsed time, and speed.' },
      { icon: '🛡️', title: 'Geodetic Filtering', desc: 'Haversine distance with stationary drift & speed jump anomaly rejection.' },
      { icon: '📱', title: 'Home-Screen Widget', desc: 'Glanceable odometer, fuel stats, and quick actions right on Android.' },
    ],
  },
];

const SINGLE_FUEL_TYPES = [
  FuelType.PETROL,
  FuelType.DIESEL,
  FuelType.CNG,
  FuelType.LPG,
  FuelType.ELECTRIC,
  FuelType.HYBRID,
];
const BI_FUEL_TYPES = [
  FuelType.HYBRID_CNG_PETROL,
  FuelType.HYBRID_LPG_PETROL,
];

export default function OnboardingScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: string }>();
  const isReplay = params.mode === 'replay';

  const addVehicle = useVehicleStore((s) => s.addVehicle);
  const setHasCompletedOnboarding = usePreferencesStore((s) => s.setHasCompletedOnboarding);

  const [step, setStep] = useState<'walkthrough' | 'form'>('walkthrough');
  const [slideIndex, setSlideIndex] = useState(0);

  // Form state
  const [nickname, setNickname] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>(VehicleType.CAR);
  const [fuelType, setFuelType] = useState<FuelType>(FuelType.PETROL);
  const [registration, setRegistration] = useState('');
  const [frontTyrePressure, setFrontTyrePressure] = useState('');
  const [rearTyrePressure, setRearTyrePressure] = useState('');
  const [tankCapacity, setTankCapacity] = useState('');
  const [secondaryTankCapacity, setSecondaryTankCapacity] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState('');

  const isEV = isElectricFuel(fuelType);
  const isHybrid = isHybridFuel(fuelType);

  const currentSlide = SLIDES[slideIndex];

  const handleNextSlide = () => {
    if (slideIndex < SLIDES.length - 1) {
      setSlideIndex((i) => i + 1);
    } else {
      // Reached end of walkthrough
      setHasCompletedOnboarding(true);
      if (isReplay) {
        router.back();
      } else {
        setStep('form');
      }
    }
  };

  const handlePrevSlide = () => {
    if (slideIndex > 0) {
      setSlideIndex((i) => i - 1);
    }
  };

  const handleSkip = () => {
    setHasCompletedOnboarding(true);
    if (isReplay) {
      router.back();
    } else {
      setStep('form');
    }
  };

  const handleFuelTypeChange = (ft: FuelType) => {
    setFuelType(ft);
    setTankCapacity('');
    setSecondaryTankCapacity('');
  };

  const handleSave = () => {
    if (!nickname.trim()) {
      setError('Give your vehicle a name!');
      return;
    }
    if (!registration.trim()) {
      setError('Registration number is required.');
      return;
    }
    const capacity = parseFloat(tankCapacity);
    if (!tankCapacity.trim() || isNaN(capacity) || capacity <= 0) {
      setError(`${isEV ? 'Battery' : 'Tank'} capacity is required (enter a number greater than 0).`);
      return;
    }
    if (isHybrid && secondaryTankCapacity) {
      const secondary = parseFloat(secondaryTankCapacity);
      if (isNaN(secondary) || secondary <= 0) {
        setError('Secondary tank capacity must be a number greater than 0.');
        return;
      }
    }
    setError('');

    addVehicle({
      nickname: nickname.trim(),
      vehicle_type: vehicleType,
      fuel_type: fuelType,
      registration_number: registration.trim().toUpperCase(),
      front_tyre_pressure: frontTyrePressure ? parseFloat(frontTyrePressure) : undefined,
      rear_tyre_pressure: rearTyrePressure ? parseFloat(rearTyrePressure) : undefined,
      tank_capacity: tankCapacity ? parseFloat(tankCapacity) : undefined,
      secondary_tank_capacity: (isHybrid && secondaryTankCapacity)
        ? parseFloat(secondaryTankCapacity)
        : undefined,
    });

    setHasCompletedOnboarding(true);
    router.replace('/(tabs)');
  };

  // ─── Walkthrough Slides View ──────────────────────────────────────────────
  if (step === 'walkthrough') {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top,
            paddingBottom: Math.max(insets.bottom, Spacing.lg),
          },
        ]}
      >
        {/* Top Navigation Bar: Back & Skip */}
        <View style={styles.walkthroughHeader}>
          {slideIndex > 0 ? (
            <TouchableOpacity
              onPress={handlePrevSlide}
              style={styles.headerButton}
              activeOpacity={0.7}
            >
              <Text style={[Typography.bodySmall, { color: colors.textSecondary, fontWeight: '600' }]}>
                ← Back
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 60 }} />
          )}

          <View style={[styles.badgePill, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.badgeText, { color: colors.primary }]}>
              {currentSlide.badge}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleSkip}
            style={styles.headerButton}
            activeOpacity={0.7}
          >
            <Text style={[Typography.bodySmall, { color: colors.textSecondary, fontWeight: '600' }]}>
              {isReplay ? 'Close' : 'Skip'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Slide Content */}
        <ScrollView
          contentContainerStyle={styles.slideScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Emoji with soft background aura */}
          <View style={[styles.emojiCircle, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            <Text style={styles.heroEmoji}>{currentSlide.emoji}</Text>
          </View>

          <Text style={[Typography.h1, { color: colors.text, textAlign: 'center', marginTop: Spacing.md }]}>
            {currentSlide.title}
          </Text>
          <Text
            style={[
              Typography.body,
              { color: colors.textSecondary, textAlign: 'center', marginTop: Spacing.xs, marginBottom: Spacing.xl },
            ]}
          >
            {currentSlide.subtitle}
          </Text>

          {/* Highlights Card */}
          <View style={[styles.highlightsCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            {currentSlide.highlights.map((item, idx) => (
              <View
                key={idx}
                style={[
                  styles.highlightRow,
                  idx < currentSlide.highlights.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.borderLight,
                  },
                ]}
              >
                <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
                  <Text style={{ fontSize: 18 }}>{item.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[Typography.body, { color: colors.text, fontWeight: '700' }]}>
                    {item.title}
                  </Text>
                  <Text style={[Typography.caption, { color: colors.textSecondary, marginTop: 2, lineHeight: 17 }]}>
                    {item.desc}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Bottom Bar: Indicators & Next Action */}
        <View style={styles.walkthroughBottomBar}>
          {/* Dot Progress Indicators */}
          <View style={styles.dotsRow}>
            {SLIDES.map((_, idx) => {
              const isActive = idx === slideIndex;
              return (
                <View
                  key={idx}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: isActive ? colors.primary : colors.border,
                      width: isActive ? 22 : 7,
                    },
                  ]}
                />
              );
            })}
          </View>

          {/* Primary Action Button */}
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={handleNextSlide}
            activeOpacity={0.85}
          >
            <Text style={[Typography.button, { color: colors.textOnPrimary }]}>
              {slideIndex === SLIDES.length - 1
                ? isReplay
                  ? 'Done'
                  : "Let's Add Your Vehicle →"
                : 'Continue →'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Add Vehicle Form View ───────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}
      behavior={Platform.OS === 'android' ? 'height' : 'padding'}
    >
      <ScrollView contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg }}>
          <View>
            <Text style={[Typography.h1, { color: colors.text }]}>Add Your Vehicle</Text>
            <Text style={[Typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
              Step 2 of 2 · Start logging records offline
            </Text>
          </View>
        </View>

        {/* ── Nickname ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Vehicle Name *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder={"e.g., City, Brezza, Baba's Activa"}
          placeholderTextColor={colors.textTertiary}
          value={nickname}
          onChangeText={setNickname}
          autoFocus
        />

        {/* ── Vehicle Type ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Vehicle Type *</Text>
        <View style={styles.chipRow}>
          {Object.values(VehicleType).map((vt) => (
            <Pressable
              key={vt}
              onPress={() => setVehicleType(vt)}
              style={[
                styles.chip,
                {
                  backgroundColor: vehicleType === vt ? colors.primary : colors.surface,
                  borderColor: vehicleType === vt ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: vehicleType === vt ? colors.textOnPrimary : colors.text },
                ]}
              >
                {VEHICLE_TYPE_LABELS[vt]}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Fuel Type ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Fuel Type *</Text>
        <Text style={[styles.subLabel, { color: colors.textTertiary }]}>Standard / Single-Fuel</Text>
        <View style={styles.chipRow}>
          {SINGLE_FUEL_TYPES.map((ft) => (
            <Pressable
              key={ft}
              onPress={() => handleFuelTypeChange(ft)}
              style={[
                styles.chip,
                {
                  backgroundColor: fuelType === ft ? colors.primary : colors.surface,
                  borderColor: fuelType === ft ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: fuelType === ft ? colors.textOnPrimary : colors.text },
                ]}
              >
                {FUEL_TYPE_LABELS[ft]}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.subLabel, { color: colors.textTertiary }]}>Bi-Fuel / Hybrid Systems</Text>
        <View style={styles.chipRow}>
          {BI_FUEL_TYPES.map((ft) => (
            <Pressable
              key={ft}
              onPress={() => handleFuelTypeChange(ft)}
              style={[
                styles.chip,
                {
                  backgroundColor: fuelType === ft ? colors.primary : colors.surface,
                  borderColor: fuelType === ft ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: fuelType === ft ? colors.textOnPrimary : colors.text },
                ]}
              >
                {FUEL_TYPE_LABELS[ft]}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Registration Number ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Registration Number *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="e.g., DL-01-AB-1234"
          placeholderTextColor={colors.textTertiary}
          value={registration}
          onChangeText={setRegistration}
          autoCapitalize="characters"
        />

        {/* ── Primary Tank / Battery Capacity ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {isEV ? 'Battery Capacity (kWh) *' : fuelType === FuelType.CNG ? 'CNG Cylinder Water Capacity (L) *' : 'Fuel Tank Capacity (L) *'}
        </Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder={isEV ? 'e.g., 40.5' : fuelType === FuelType.CNG ? 'e.g., 60' : 'e.g., 45'}
          placeholderTextColor={colors.textTertiary}
          value={tankCapacity}
          onChangeText={setTankCapacity}
          keyboardType="decimal-pad"
        />

        {/* ── Secondary Tank (Bi-Fuel only) ── */}
        {isHybrid && (
          <>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Fallback Petrol Tank Capacity (L) (optional)
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g., 35"
              placeholderTextColor={colors.textTertiary}
              value={secondaryTankCapacity}
              onChangeText={setSecondaryTankCapacity}
              keyboardType="decimal-pad"
            />
          </>
        )}

        {/* ── Advanced Toggle (Tyre Pressures) ── */}
        <TouchableOpacity
          onPress={() => setShowAdvanced(!showAdvanced)}
          style={styles.advancedToggle}
          activeOpacity={0.7}
        >
          <Text style={[Typography.bodySmall, { color: colors.primary, fontWeight: '600' }]}>
            {showAdvanced ? '▲ Hide Tyre Pressure Settings' : '▼ Add Recommended Tyre Pressure (Optional)'}
          </Text>
        </TouchableOpacity>

        {showAdvanced && (
          <View style={styles.pressureRow}>
            <View style={styles.pressureField}>
              <Text style={[styles.pressureFieldLabel, { color: colors.textSecondary }]}>Front (PSI)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                placeholder="e.g., 32"
                placeholderTextColor={colors.textTertiary}
                value={frontTyrePressure}
                onChangeText={setFrontTyrePressure}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.pressureField}>
              <Text style={[styles.pressureFieldLabel, { color: colors.textSecondary }]}>Rear (PSI)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                placeholder="e.g., 30"
                placeholderTextColor={colors.textTertiary}
                value={rearTyrePressure}
                onChangeText={setRearTyrePressure}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        )}

        {/* ── Error message ── */}
        {error ? (
          <Text style={[Typography.bodySmall, { color: colors.danger, marginTop: Spacing.sm }]}>
            {error}
          </Text>
        ) : null}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Save Button ── */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: StyleSheet.hairlineWidth,
            paddingBottom: Math.max(insets.bottom, Spacing.lg),
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={handleSave}
          activeOpacity={0.85}
        >
          <Text style={[Typography.button, { color: colors.textOnPrimary }]}>
            Save & Open Dashboard
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // ── Walkthrough Header ──
  walkthroughHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  headerButton: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    minHeight: 40,
    justifyContent: 'center',
  },
  badgePill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: 16,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  slideScrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    alignItems: 'center',
  },
  emojiCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
    ...Sizing.cardShadow,
  },
  heroEmoji: {
    fontSize: 44,
  },
  highlightsCard: {
    width: '100%',
    borderRadius: Sizing.radiusLg,
    borderWidth: 1,
    overflow: 'hidden',
    ...Sizing.cardShadow,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ── Bottom Bar ──
  walkthroughBottomBar: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.lg,
  },
  dot: {
    height: 7,
    borderRadius: 4,
  },
  primaryButton: {
    height: Sizing.primaryButton,
    borderRadius: Sizing.radiusMd,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ── Form Styles ──
  formContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: Spacing.xs,
    marginTop: Spacing.lg,
  },
  subLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  input: {
    height: Sizing.touchTarget,
    borderWidth: 1,
    borderRadius: Sizing.radiusSm,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Sizing.radiusFull,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  advancedToggle: {
    marginTop: Spacing.xl,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  pressureRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  pressureField: {
    flex: 1,
  },
  pressureFieldLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: Spacing.xs,
  },
  bottomBar: {
    padding: Spacing.lg,
  },
});
