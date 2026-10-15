/**
 * AnimatedSplash.tsx
 *
 * 5-stage animated splash sequence:
 *
 *  Stage 1 – Native launch  : expo-splash-screen shows static blue screen while JS loads.
 *  Stage 2 – Logo animation : Background + logo fade in and scale up from 0.6 → 1.
 *  Stage 3 – Branding       : "DriveLedger" wordmark + tagline fade in smoothly.
 *  Stage 4 – Loading        : Progress bar animates; waits for `ready` prop to be true.
 *  Stage 5 – Exit           : Entire overlay fades to transparent, then onFinish() fires.
 *
 * Props
 *   ready    – Set to true by _layout.tsx once DB, prefs and vehicles have loaded.
 *   onFinish – Called when exit fade is complete; parent unmounts this overlay.
 */

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

// ─── constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get('window');

/** Minimum time (ms) the animated splash is visible before it can exit. */
const MIN_SPLASH_MS = 2800;

/** Duration of the final fade-out. */
const EXIT_FADE_MS = 500;

// ─── component ────────────────────────────────────────────────────────────────

interface Props {
  /** True once the app's async initialisation (DB, prefs, vehicles) is complete. */
  ready: boolean;
  /** Called after the exit animation finishes so the parent can unmount this overlay. */
  onFinish: () => void;
}

export default function AnimatedSplash({ ready, onFinish }: Props) {
  // ── shared values ──────────────────────────────────────────────────────────

  /** Overall overlay opacity – drives the exit fade. */
  const overlayOpacity = useSharedValue(1);

  /** Background image opacity + scale. */
  const bgOpacity = useSharedValue(0);
  const bgScale = useSharedValue(1.08);

  /** Logo opacity + scale. */
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.6);

  /** Glow ring behind the logo. */
  const glowOpacity = useSharedValue(0);

  /** Branding text (wordmark + tagline). */
  const brandOpacity = useSharedValue(0);
  const brandTranslateY = useSharedValue(12);

  /**
   * Progress bar fill fraction (0 → 1).
   * We drive the bar via flex rather than a percentage string to avoid
   * the string-interpolation warning in Reanimated 4's style worklets.
   */
  const progressFill = useSharedValue(0);

  /** Subtitle text under the progress bar. */
  const subtitleOpacity = useSharedValue(0);

  /** Shimmer pulse on the progress fill. */
  const shimmerOpacity = useSharedValue(0.4);

  // ── start-time ref for min-display guard ──────────────────────────────────

  const startTime = useRef(Date.now());

  // ── worklet-safe exit helper ───────────────────────────────────────────────

  // Keep a stable ref so the worklet callback can always call the latest version
  // without needing `onFinish` in the dependency array (avoids the useCallback
  // dependency warning while keeping correctness).
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  function triggerExit() {
    'worklet';
    overlayOpacity.value = withTiming(0, { duration: EXIT_FADE_MS }, (finished) => {
      if (finished) {
        runOnJS(onFinishRef.current)();
      }
    });
  }

  // ── entrance animation chain ───────────────────────────────────────────────

  useEffect(() => {
    startTime.current = Date.now();

    // Stage 2: background fades + very slight Ken-Burns zoom-out
    bgOpacity.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) });
    bgScale.value = withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) });

    // Stage 2: glow ring
    glowOpacity.value = withDelay(300, withTiming(0.9, { duration: 600 }));

    // Stage 2: logo springs into place
    logoOpacity.value = withDelay(350, withTiming(1, { duration: 500 }));
    logoScale.value = withDelay(
      350,
      withSpring(1, { damping: 14, stiffness: 100, mass: 0.8 }),
    );

    // Stage 3: branding slides up + fades in
    brandOpacity.value = withDelay(900, withTiming(1, { duration: 500 }));
    brandTranslateY.value = withDelay(
      900,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );

    // Stage 4: subtitle
    subtitleOpacity.value = withDelay(1200, withTiming(1, { duration: 400 }));

    // Stage 4: progress bar to 80 %
    progressFill.value = withDelay(
      1300,
      withTiming(0.8, { duration: 1400, easing: Easing.out(Easing.cubic) }),
    );

    // Shimmer pulse on the progress bar (3 pulses)
    shimmerOpacity.value = withDelay(
      1400,
      withSequence(
        withTiming(1,   { duration: 600 }),
        withTiming(0.4, { duration: 600 }),
        withTiming(1,   { duration: 600 }),
        withTiming(0.4, { duration: 600 }),
        withTiming(1,   { duration: 600 }),
      ),
    );
  // Run entrance animations once on mount only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── react to `ready` ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!ready) return;

    const elapsed = Date.now() - startTime.current;
    const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);

    const t = setTimeout(() => {
      progressFill.value = withTiming(
        1,
        { duration: 400, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) {
            triggerExit();
          }
        },
      );
    }, remaining);

    return () => clearTimeout(t);
  // `triggerExit` is a worklet defined inline above – stable reference.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // ── animated styles ────────────────────────────────────────────────────────

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const bgStyle = useAnimatedStyle(() => ({
    opacity: bgOpacity.value,
    transform: [{ scale: bgScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const brandStyle = useAnimatedStyle(() => ({
    opacity: brandOpacity.value,
    transform: [{ translateY: brandTranslateY.value }],
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  /**
   * Drive bar width via `flex` instead of a percentage string so Reanimated 4
   * doesn't have to serialize a template-literal value across the UI thread.
   * The track uses `flexDirection: 'row'`; the fill takes `flex: progressFill.value`
   * and an invisible spacer takes `flex: 1 - progressFill.value`.
   */
  const progressFillStyle = useAnimatedStyle(() => ({
    flex: progressFill.value,
  }));

  const progressSpacerStyle = useAnimatedStyle(() => ({
    flex: 1 - progressFill.value,
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: shimmerOpacity.value,
  }));

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, overlayStyle]}>
      {/* Base colour – matches native splash so there's no colour flash */}
      <View style={[StyleSheet.absoluteFill, styles.baseColor]} />

      {/* Road / city background */}
      <Animated.View style={[StyleSheet.absoluteFill, bgStyle]}>
        <Image
          source={require('@/assets/images/splash-background.png')}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={0}
        />
      </Animated.View>

      {/* Gradient overlay – darkens sky + bottom for text contrast */}
      <LinearGradient
        colors={['rgba(4,28,80,0.55)', 'transparent', 'rgba(4,20,60,0.65)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* ── Main content ── */}
      <View style={styles.content}>

        {/* Glow ring + Logo */}
        <View style={styles.logoArea}>
          <Animated.View style={[styles.glowRing, glowStyle]}>
            <Image
              source={require('@/assets/images/logo-glow.png')}
              style={styles.glowImage}
              contentFit="contain"
            />
          </Animated.View>

          <Animated.View style={[styles.logoWrapper, logoStyle]}>
            <Image
              source={require('@/assets/images/splash-icon.png')}
              style={styles.logoImage}
              contentFit="contain"
            />
          </Animated.View>
        </View>

        {/* Wordmark + tagline
            Use plain <Text> for the inner colour spans to avoid the
            nested <Animated.Text> layout warning in RN new architecture. */}
        <Animated.View style={[styles.brandingBlock, brandStyle]}>
          <Text style={styles.wordmark}>
            <Text style={styles.wordmarkDrive}>Drive</Text>
            <Text style={styles.wordmarkLedger}>Ledger</Text>
          </Text>
          <Text style={styles.tagline}>TRACK  ·  MAINTAIN  ·  SAVE</Text>
        </Animated.View>

        {/* Progress bar + subtitle */}
        <Animated.View style={[styles.progressSection, subtitleStyle]}>
          {/* Track – flex row so fill + spacer share 100 % of the track */}
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, progressFillStyle]}>
              <Animated.View
                style={[StyleSheet.absoluteFill, styles.progressShimmer, shimmerStyle]}
              />
            </Animated.View>
            {/* Invisible spacer – keeps fill from stretching beyond the track */}
            <Animated.View style={progressSpacerStyle} />
          </View>
          <Text style={styles.progressLabel}>Preparing your garage…</Text>
        </Animated.View>

      </View>
    </Animated.View>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const LOGO_SIZE = Math.min(SCREEN_W * 0.52, 220);
const GLOW_SIZE = LOGO_SIZE * 1.55;

const styles = StyleSheet.create({
  overlay: {
    zIndex: 9999,
    elevation: 9999,
  },
  baseColor: {
    backgroundColor: '#084CB4',
  },

  // ── content layout ────────────────────────────────────────────────────────
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 48,
  },

  // ── logo area ─────────────────────────────────────────────────────────────
  logoArea: {
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  glowRing: {
    position: 'absolute',
    width: GLOW_SIZE,
    height: GLOW_SIZE,
  },
  glowImage: {
    width: '100%',
    height: '100%',
  },
  logoWrapper: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },

  // ── branding ──────────────────────────────────────────────────────────────
  brandingBlock: {
    alignItems: 'center',
    marginBottom: 52,
  },
  wordmark: {
    fontSize: 42,
    lineHeight: 52,
  },
  wordmarkDrive: {
    color: '#FFFFFF',
    fontWeight: '300',
  },
  wordmarkLedger: {
    color: '#5BB8FF',
    fontWeight: '800',
  },
  tagline: {
    color: 'rgba(180,210,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 3.5,
    marginTop: 6,
  },

  // ── progress ──────────────────────────────────────────────────────────────
  progressSection: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  progressTrack: {
    width: '72%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'row',   // fill + spacer share this row
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#5BB8FF',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressShimmer: {
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderRadius: 4,
  },
  progressLabel: {
    color: 'rgba(180,215,255,0.75)',
    fontSize: 13,
    letterSpacing: 0.3,
  },
});
