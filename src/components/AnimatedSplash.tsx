import { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Image,
    ImageBackground,
    StyleSheet,
    Text,
    View,
} from 'react-native';

type AnimatedSplashProps = {
    ready: boolean;
    onFinish: () => void;
};

export default function AnimatedSplash({
    ready,
    onFinish,
}: AnimatedSplashProps) {
    const logoOpacity = useRef(new Animated.Value(0)).current;
    const logoScale = useRef(new Animated.Value(0.82)).current;
    const brandOpacity = useRef(new Animated.Value(0)).current;
    const screenOpacity = useRef(new Animated.Value(1)).current;
    const progressX = useRef(new Animated.Value(-90)).current;

    const [introDone, setIntroDone] = useState(false);
    const exiting = useRef(false);

    // Animate the logo, then reveal the app name and tagline.
    useEffect(() => {
        const animation = Animated.sequence([
            Animated.parallel([
                Animated.timing(logoOpacity, {
                    toValue: 1,
                    duration: 650,
                    useNativeDriver: true,
                }),
                Animated.spring(logoScale, {
                    toValue: 1,
                    damping: 14,
                    stiffness: 110,
                    mass: 0.8,
                    useNativeDriver: true,
                }),
            ]),
            Animated.timing(brandOpacity, {
                toValue: 1,
                duration: 450,
                useNativeDriver: true,
            }),
        ]);

        animation.start(({ finished }) => {
            if (finished) setIntroDone(true);
        });

        return () => animation.stop();
    }, [logoOpacity, logoScale, brandOpacity]);

    // Indeterminate loading animation; it does not pretend to be a percentage.
    useEffect(() => {
        if (ready) return;

        const loop = Animated.loop(
            Animated.timing(progressX, {
                toValue: 240,
                duration: 1100,
                useNativeDriver: true,
            }),
        );

        loop.start();
        return () => loop.stop();
    }, [ready, progressX]);

    // Leave the splash only when both the intro and app initialization finish.
    useEffect(() => {
        if (!ready || !introDone || exiting.current) return;

        exiting.current = true;

        Animated.timing(screenOpacity, {
            toValue: 0,
            duration: 450,
            useNativeDriver: true,
        }).start(({ finished }) => {
            if (finished) onFinish();
        });
    }, [ready, introDone, screenOpacity, onFinish]);

    return (
        <Animated.View
            pointerEvents="auto"
            style={[StyleSheet.absoluteFillObject, styles.overlay, { opacity: screenOpacity }]}
        >
            <ImageBackground
                source={require('../../assets/images/splash-background.png')}
                resizeMode="cover"
                style={styles.background}
            >
                <View style={styles.tint} />

                <View style={styles.content}>
                    <Animated.View
                        style={[
                            styles.logoContainer,
                            {
                                opacity: logoOpacity,
                                transform: [{ scale: logoScale }],
                            },
                        ]}
                    >
                        <Image
                            source={require('../../assets/images/icon.png')}
                            resizeMode="contain"
                            style={styles.logo}
                            accessibilityLabel="DriveLedger logo"
                        />
                    </Animated.View>

                    <Animated.View style={{ opacity: brandOpacity }}>
                        <Text style={styles.title}>
                            <Text style={styles.titleBold}>Drive</Text>Ledger
                        </Text>

                        <Text style={styles.tagline}>
                            TRACK  ·  MAINTAIN  ·  SAVE
                        </Text>
                    </Animated.View>
                </View>

                <View style={styles.loading}>
                    <View style={styles.progressTrack}>
                        <Animated.View
                            style={[
                                styles.progressSegment,
                                { transform: [{ translateX: progressX }] },
                            ]}
                        />
                    </View>

                    <Text style={styles.loadingText}>
                        {ready ? 'Ready' : 'Preparing your garage…'}
                    </Text>
                </View>
            </ImageBackground>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        zIndex: 1000,
        elevation: 1000,
        backgroundColor: '#084CB4',
    },
    background: {
        flex: 1,
        backgroundColor: '#084CB4',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tint: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(4, 25, 74, 0.18)',
    },
    content: {
        flex: 1,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    logoContainer: {
        marginBottom: 22,
    },
    logo: {
        width: 154,
        height: 154,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 35,
        textAlign: 'center',
        letterSpacing: -0.8,
        fontWeight: '400',
    },
    titleBold: {
        fontWeight: '800',
    },
    tagline: {
        marginTop: 12,
        color: 'rgba(255,255,255,0.88)',
        fontSize: 11,
        textAlign: 'center',
        letterSpacing: 2.2,
    },
    loading: {
        position: 'absolute',
        bottom: 64,
        alignItems: 'center',
        width: '100%',
        paddingHorizontal: 36,
    },
    progressTrack: {
        width: 220,
        height: 4,
        overflow: 'hidden',
        borderRadius: 99,
        backgroundColor: 'rgba(255,255,255,0.25)',
    },
    progressSegment: {
        width: 70,
        height: 4,
        borderRadius: 99,
        backgroundColor: '#FFFFFF',
    },
    loadingText: {
        marginTop: 14,
        color: 'rgba(255,255,255,0.9)',
        fontSize: 12,
        letterSpacing: 0.5,
    },
});