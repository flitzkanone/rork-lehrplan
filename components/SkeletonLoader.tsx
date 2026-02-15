import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import Colors from '@/constants/colors';

interface SkeletonBlockProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: object;
}

function SkeletonBlock({ width, height, borderRadius = 8, style }: SkeletonBlockProps) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.12],
  });

  return (
    <Animated.View
      style={[
        {
          width: width as number,
          height,
          borderRadius,
          backgroundColor: Colors.text,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function LessonScreenSkeleton() {
  return (
    <View style={skeletonStyles.container}>
      <View style={skeletonStyles.padded}>
        <SkeletonBlock width={160} height={30} borderRadius={6} style={{ marginBottom: 28 }} />

        <SkeletonBlock width={80} height={12} borderRadius={4} style={{ marginBottom: 10, marginLeft: 4 }} />
        <View style={skeletonStyles.card}>
          {[0, 1, 2].map((i) => (
            <React.Fragment key={i}>
              {i > 0 && <View style={skeletonStyles.divider} />}
              <View style={skeletonStyles.listRow}>
                <View style={skeletonStyles.rowLeft}>
                  <SkeletonBlock width={34} height={34} borderRadius={10} />
                  <View>
                    <SkeletonBlock width={90} height={14} borderRadius={4} />
                    <SkeletonBlock width={60} height={10} borderRadius={4} style={{ marginTop: 6 }} />
                  </View>
                </View>
                <SkeletonBlock width={20} height={20} borderRadius={10} />
              </View>
            </React.Fragment>
          ))}
        </View>

        <SkeletonBlock width={50} height={12} borderRadius={4} style={{ marginBottom: 10, marginLeft: 4 }} />
        <View style={skeletonStyles.chipRow}>
          {[80, 100, 70, 90].map((w, i) => (
            <SkeletonBlock key={i} width={w} height={38} borderRadius={22} />
          ))}
        </View>

        <SkeletonBlock width="100%" height={52} borderRadius={14} style={{ marginTop: 32 }} />
      </View>
    </View>
  );
}

export function ClassesScreenSkeleton() {
  return (
    <View style={skeletonStyles.container}>
      <View style={skeletonStyles.padded}>
        <SkeletonBlock width={140} height={30} borderRadius={6} style={{ marginBottom: 24 }} />
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[skeletonStyles.classCard, { marginBottom: 8 }]}>
            <View style={skeletonStyles.rowLeft}>
              <SkeletonBlock width={40} height={40} borderRadius={12} />
              <View>
                <SkeletonBlock width={100} height={15} borderRadius={4} />
                <SkeletonBlock width={65} height={11} borderRadius={4} style={{ marginTop: 6 }} />
              </View>
            </View>
            <SkeletonBlock width={17} height={17} borderRadius={4} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function StatisticsScreenSkeleton() {
  return (
    <View style={skeletonStyles.container}>
      <View style={skeletonStyles.padded}>
        <SkeletonBlock width={140} height={30} borderRadius={6} style={{ marginBottom: 16 }} />
        <View style={skeletonStyles.searchRow}>
          <View style={[skeletonStyles.searchBox, { flex: 1 }]}>
            <SkeletonBlock width="100%" height={44} borderRadius={12} />
          </View>
          <SkeletonBlock width={44} height={44} borderRadius={12} />
        </View>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[skeletonStyles.statsCard, { marginBottom: 8 }]}>
            <View style={skeletonStyles.rowLeft}>
              <SkeletonBlock width={36} height={36} borderRadius={11} />
              <View>
                <SkeletonBlock width={120} height={14} borderRadius={4} />
                <SkeletonBlock width={70} height={10} borderRadius={4} style={{ marginTop: 6 }} />
              </View>
            </View>
            <SkeletonBlock width={30} height={30} borderRadius={10} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function SettingsScreenSkeleton() {
  return (
    <View style={skeletonStyles.container}>
      <View style={skeletonStyles.padded}>
        <SkeletonBlock width={100} height={30} borderRadius={6} style={{ marginBottom: 24 }} />

        <View style={skeletonStyles.profileCard}>
          <SkeletonBlock width={64} height={64} borderRadius={32} />
          <SkeletonBlock width={140} height={18} borderRadius={5} style={{ marginTop: 14 }} />
          <SkeletonBlock width={100} height={13} borderRadius={4} style={{ marginTop: 8 }} />
        </View>

        {[0, 1, 2].map((i) => (
          <View key={i} style={[skeletonStyles.sectionCard, { marginBottom: 12 }]}>
            <View style={skeletonStyles.sectionRow}>
              <SkeletonBlock width={38} height={38} borderRadius={12} />
              <View style={{ flex: 1 }}>
                <SkeletonBlock width={160} height={15} borderRadius={4} />
                <SkeletonBlock width={110} height={11} borderRadius={4} style={{ marginTop: 6 }} />
              </View>
              <SkeletonBlock width={18} height={18} borderRadius={4} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  padded: {
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    marginBottom: 28,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  divider: {
    height: 0.5,
    backgroundColor: Colors.divider,
    marginLeft: 62,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  classCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  searchBox: {},
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
  },
  sectionCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
  },
});
