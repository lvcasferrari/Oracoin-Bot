import type { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View } from 'react-native';

import { formatBRL } from '../lib/money';

export { formatBRL };

/** Money text in BRL. */
export function Money({ value, style }: { value: number; style?: StyleProp<TextStyle> }) {
  return <Text style={style}>{formatBRL(value)}</Text>;
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

/** Semáforo pill: colour plus text, never colour alone (accessibility). */
export function Pill({ tone, children }: { tone: 'ok' | 'warn' | 'risk'; children: ReactNode }) {
  return (
    <View style={[styles.pill, tone === 'ok' ? styles.ok : tone === 'warn' ? styles.warn : styles.risk]}>
      <Text style={styles.pillText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 16, backgroundColor: 'rgba(127,127,127,0.12)', gap: 6 },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginTop: 6 },
  ok: { backgroundColor: '#d7f3df' },
  warn: { backgroundColor: '#fff0c2' },
  risk: { backgroundColor: '#ffd6d6' },
  pillText: { fontSize: 13, color: '#222' },
});
