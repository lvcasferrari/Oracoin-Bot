import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from './Text';
import { BACKDROP, COLORS } from './theme';

// The symbol: two overlapping glass lenses, cut out of the approved logo (assets/brand/mark@2x.png is 801×576).
const MARK = require('../../assets/brand/mark.png');
const RATIO = 801 / 576;
// The same lenses pre-blurred on a padded canvas (640×528), so the glow fades out instead of ending at the image edge.
const GLOW = require('../../assets/brand/glow.png');

export function Mark({ height = 40 }: { height?: number }) {
  return <Image source={MARK} style={{ height, width: height * RATIO }} accessibilityIgnoresInvertColors accessible={false} />;
}

/** Symbol + "alivy" + the tagline, for the welcome and empty screens. */
export function Wordmark({ tagline = 'Inteligência & alívio financeiro' }: { tagline?: string }) {
  return (
    <View style={styles.wordmark} accessible accessibilityRole="header" accessibilityLabel={`Alivy. ${tagline}`}>
      <Mark height={56} />
      <Text style={styles.name}>alivy</Text>
      <Text style={styles.tagline}>{tagline.toUpperCase()}</Text>
    </View>
  );
}

/**
 * The air behind every screen: an off-white wash with the two lenses glowing out of focus at the top,
 * so the frosted cards have light to refract. Purely decorative.
 */
export function Backdrop() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <LinearGradient colors={BACKDROP} style={StyleSheet.absoluteFill} />
      <Image source={GLOW} style={styles.glow} />
    </View>
  );
}

const styles = StyleSheet.create({
  wordmark: { alignItems: 'flex-start', gap: 6 },
  name: { fontSize: 40, fontWeight: '700', letterSpacing: -1, color: COLORS.text, marginTop: 10 },
  tagline: { fontSize: 12, fontWeight: '600', letterSpacing: 2.4, color: COLORS.placeholder },
  glow: { position: 'absolute', top: 40, right: -200, width: 640, height: 528, opacity: 0.35 },
});
