import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Modal, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { colors } from '../theme/colors';

// Full-screen "you earned points!" moment: balloons float up, fireworks burst,
// confetti falls. Pure React Native Animated (no extra libraries), so it runs
// on every phone and in the web build.
interface Props {
  visible: boolean;
  points: number;
  valueRand: number;
  balance?: number;
  sellerName?: string;
  onClose: () => void;
}

const BALLOONS = ['🎈', '🎈', '🎈', '🎈', '🎈', '🎈'];
const BURSTS = ['🎆', '🎇', '✨', '🎆', '🎇', '✨'];
const CONFETTI_COLORS = ['#ff7a1a', '#73BF43', '#ffb020', '#38bdf8', '#f472b6', '#a78bfa'];

export default function RewardCelebration({ visible, points, valueRand, balance, sellerName, onClose }: Props) {
  const { width, height } = useWindowDimensions();

  const balloons = useMemo(
    () => BALLOONS.map((emoji, i) => ({ emoji, left: (i + 0.5) * (width / BALLOONS.length) - 18, delay: i * 250, anim: new Animated.Value(0) })),
    [width, visible] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const bursts = useMemo(
    () =>
      BURSTS.map((emoji, i) => ({
        emoji,
        left: 20 + ((i * 53) % Math.max(width - 80, 100)),
        top: 80 + ((i * 97) % Math.max(height / 2, 200)),
        delay: 300 + i * 350,
        anim: new Animated.Value(0)
      })),
    [width, height, visible] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const confetti = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        left: Math.random() * width,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: Math.random() * 1200,
        duration: 2200 + Math.random() * 1800,
        size: 6 + Math.random() * 6,
        anim: new Animated.Value(0)
      })),
    [width, visible] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: true }).start();
    const loops: Animated.CompositeAnimation[] = [];
    balloons.forEach((b) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(b.delay),
          Animated.timing(b.anim, { toValue: 1, duration: 4200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(b.anim, { toValue: 0, duration: 0, useNativeDriver: true })
        ])
      );
      loops.push(loop);
      loop.start();
    });
    bursts.forEach((b) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(b.delay),
          Animated.timing(b.anim, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.delay(900),
          Animated.timing(b.anim, { toValue: 0, duration: 0, useNativeDriver: true })
        ])
      );
      loops.push(loop);
      loop.start();
    });
    confetti.forEach((c) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(c.delay),
          Animated.timing(c.anim, { toValue: 1, duration: c.duration, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(c.anim, { toValue: 0, duration: 0, useNativeDriver: true })
        ])
      );
      loops.push(loop);
      loop.start();
    });
    return () => loops.forEach((l) => l.stop());
  }, [visible, balloons, bursts, confetti, pop]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {confetti.map((c, i) => (
          <Animated.View
            key={`c${i}`}
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -20,
              left: c.left,
              width: c.size,
              height: c.size * 1.6,
              backgroundColor: c.color,
              borderRadius: 2,
              transform: [
                { translateY: c.anim.interpolate({ inputRange: [0, 1], outputRange: [0, height + 40] }) },
                { rotate: c.anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '540deg'] }) }
              ]
            }}
          />
        ))}
        {bursts.map((b, i) => (
          <Animated.Text
            key={`f${i}`}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: b.left,
              top: b.top,
              fontSize: 54,
              opacity: b.anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 0.9] }),
              transform: [{ scale: b.anim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1.6] }) }]
            }}
          >
            {b.emoji}
          </Animated.Text>
        ))}
        {balloons.map((b, i) => (
          <Animated.Text
            key={`b${i}`}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: b.left,
              bottom: -60,
              fontSize: 44,
              transform: [
                { translateY: b.anim.interpolate({ inputRange: [0, 1], outputRange: [0, -(height + 120)] }) },
                { translateX: b.anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, i % 2 ? 18 : -18, 0] }) }
              ]
            }}
          >
            {b.emoji}
          </Animated.Text>
        ))}

        <Animated.View style={[styles.card, { transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }]}>
          <Text style={styles.trophy}>🏆</Text>
          <Text style={styles.headline}>You earned</Text>
          <Text style={styles.points}>+{points}</Text>
          <Text style={styles.pointsLabel}>points</Text>
          <Text style={styles.value}>That's R{valueRand.toFixed(2)} back{sellerName ? ` from ${sellerName}` : ''}!</Text>
          {typeof balance === 'number' && <Text style={styles.balance}>You now have {balance} points</Text>}
          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Awesome!</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(8, 12, 24, 0.88)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 380, backgroundColor: colors.surface, borderRadius: 24, padding: 28, alignItems: 'center', borderWidth: 2, borderColor: colors.accent },
  trophy: { fontSize: 56 },
  headline: { color: colors.textSecondary, fontSize: 16, marginTop: 4 },
  points: { color: colors.accent, fontSize: 64, fontWeight: '900', lineHeight: 72 },
  pointsLabel: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: -6 },
  value: { color: colors.success, fontSize: 16, fontWeight: '700', marginTop: 12, textAlign: 'center' },
  balance: { color: colors.textSecondary, fontSize: 13, marginTop: 6 },
  button: { backgroundColor: colors.accent, paddingVertical: 14, paddingHorizontal: 40, borderRadius: 999, marginTop: 20 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 16 }
});
