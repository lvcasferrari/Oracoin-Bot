import { StyleSheet, Text } from 'react-native';
import { DISCLAIMER } from '../lib/copy';

export function Disclaimer() {
  return <Text style={styles.text}>{DISCLAIMER}</Text>;
}

// Legible enough to count as a clear notice (spec 06 rule 3).
const styles = StyleSheet.create({
  text: { fontSize: 12, opacity: 0.85, marginTop: 8 },
});
