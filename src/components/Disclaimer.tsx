import { StyleSheet, Text } from 'react-native';
import { DISCLAIMER } from '../lib/copy';

export function Disclaimer() {
  return <Text style={styles.text}>{DISCLAIMER}</Text>;
}

const styles = StyleSheet.create({
  text: { fontSize: 11, opacity: 0.6, marginTop: 8 },
});
