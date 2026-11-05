import type { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, TextStyle, View } from 'react-native';

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

/**
 * One line of a grouped list: label left, value right, an optional short detail under the label.
 * Tappable when `onPress` is given (44 pt minimum, WCAG 2.5.8).
 */
export function ListRow({ label, value, detail, onPress, hint }: { label: string; value?: ReactNode; detail?: string; onPress?: () => void; hint?: string }) {
  const body = (
    <>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      </View>
      {typeof value === 'string' ? <Text style={styles.rowValue}>{value}</Text> : value}
    </>
  );
  return onPress ? (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button" accessibilityHint={hint}>
      {body}
    </Pressable>
  ) : (
    <View style={styles.row}>{body}</View>
  );
}

export interface Bar {
  key: string;
  label: string;
  /** Text under the bar when it differs from `label` (which screen readers always get); '' hides it. */
  axis?: string;
  value: number;
  /** Marks one bar (e.g. the critical month) with an outline. */
  highlight?: boolean;
}

/**
 * Bar chart from plain Views: positive bars grow up from the zero line, negative bars down, in red.
 * One accessibility label carries the numbers, since screen readers cannot read the bars.
 */
export function BarChart({ bars, height = 120, onPress }: { bars: Bar[]; height?: number; onPress?: (bar: Bar) => void }) {
  const max = Math.max(1, ...bars.map((b) => Math.max(0, b.value)));
  const min = Math.min(0, ...bars.map((b) => b.value));
  const scale = height / (max - min);
  const summary = bars.map((b) => `${b.label}: ${formatBRL(b.value)}`).join('; ');
  return (
    <View accessible={!onPress} accessibilityLabel={summary} style={styles.chart}>
      {bars.map((b) => {
        const bar = (
          <>
            <View style={{ height: max * scale, justifyContent: 'flex-end' }}>
              {b.value > 0 && <View style={[styles.bar, styles.barUp, b.highlight && styles.barMark, { height: Math.max(2, b.value * scale) }]} />}
            </View>
            <View style={styles.zero} />
            <View style={{ height: -min * scale }}>
              {b.value < 0 && <View style={[styles.bar, styles.barDown, b.highlight && styles.barMark, { height: Math.max(2, -b.value * scale) }]} />}
            </View>
            <Text style={[styles.barLabel, b.axis !== undefined && styles.axisLabel]} numberOfLines={1}>
              {b.axis ?? b.label}
            </Text>
          </>
        );
        return onPress ? (
          <Pressable key={b.key} style={styles.barCol} onPress={() => onPress(b)} accessibilityRole="button" accessibilityLabel={`${b.label}: ${formatBRL(b.value)}`}>
            {bar}
          </Pressable>
        ) : (
          <View key={b.key} style={styles.barCol}>
            {bar}
          </View>
        );
      })}
    </View>
  );
}

/** Horizontal usage meter (e.g. card limit used); turns amber at 70% and red at 90%. */
export function Meter({ used, total, label }: { used: number; total: number; label: string }) {
  const ratio = total > 0 ? Math.min(1, Math.max(0, used / total)) : 0;
  const color = ratio >= 0.9 ? '#b3261e' : ratio >= 0.7 ? '#b26a00' : '#2f6f4f';
  return (
    <View accessible accessibilityLabel={`${label}: ${Math.round(ratio * 100)}%`} style={styles.meterBox}>
      <View style={styles.meterHead}>
        <Text style={styles.meterLabel}>{label}</Text>
        <Text style={styles.meterLabel}>{Math.round(ratio * 100)}%</Text>
      </View>
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: 8 },
  barCol: { flex: 1, alignItems: 'stretch' },
  bar: { borderRadius: 3 },
  barUp: { backgroundColor: '#2f6f4f' },
  barDown: { backgroundColor: '#b3261e' },
  barMark: { borderWidth: 2, borderColor: '#b26a00' },
  zero: { height: 1, backgroundColor: '#767676' },
  barLabel: { fontSize: 11, textAlign: 'center', opacity: 0.75, marginTop: 4 },
  // Sparse axis labels may overflow their narrow bar column.
  axisLabel: { width: 40, alignSelf: 'center' },
  meterBox: { gap: 4 },
  meterHead: { flexDirection: 'row', justifyContent: 'space-between' },
  meterLabel: { fontSize: 13, opacity: 0.75 },
  meterTrack: { height: 10, borderRadius: 5, backgroundColor: 'rgba(127,127,127,0.25)', overflow: 'hidden' },
  meterFill: { height: 10, borderRadius: 5 },
  card: { padding: 16, borderRadius: 16, backgroundColor: 'rgba(127,127,127,0.12)', gap: 6 },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, marginTop: 6 },
  ok: { backgroundColor: '#d7f3df' },
  warn: { backgroundColor: '#fff0c2' },
  risk: { backgroundColor: '#ffd6d6' },
  pillText: { fontSize: 13, color: '#222' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingVertical: 6 },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 16, color: '#1f1f1f' },
  rowDetail: { fontSize: 13, color: '#595959' },
  rowValue: { fontSize: 16, fontWeight: '600', color: '#1f1f1f', fontVariant: ['tabular-nums'] },
});
