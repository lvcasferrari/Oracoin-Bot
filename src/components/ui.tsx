import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, TextStyle, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Text } from './Text';
import { GLASS } from './theme';

import { formatBRL } from '../lib/money';

export { formatBRL };

/** Money text in BRL. */
export function Money({ value, style }: { value: number; style?: StyleProp<TextStyle> }) {
  return <Text numeric style={style}>{formatBRL(value)}</Text>;
}

export function Card({ children }: { children: ReactNode }) {
  return (
    // The shadow lives on an outer view: the inner one clips the blur to the rounded corners.
    <View style={styles.cardShadow}>
      <View style={styles.card}>
        <BlurView intensity={GLASS.blur} tint="light" style={StyleSheet.absoluteFill} />
        {children}
      </View>
    </View>
  );
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
export type IconName = ComponentProps<typeof Ionicons>['name'];

export function ListRow({ label, value, detail, onPress, hint, icon }: { label: string; value?: ReactNode; detail?: string; onPress?: () => void; hint?: string; icon?: IconName }) {
  const body = (
    <>
      {icon && <Ionicons name={icon} size={22} color="#0052FF" accessibilityElementsHidden importantForAccessibility="no" />}
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      </View>
      {typeof value === 'string' ? <Text style={styles.rowValue}>{value}</Text> : value}
      {onPress && <Ionicons name="chevron-forward" size={18} color="#4F576B" accessibilityElementsHidden importantForAccessibility="no" />}
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

export interface Part {
  key: string;
  label: string;
  value: number;
  color: string;
}

/**
 * One horizontal bar split into parts, with a legend of label and value under it, so colour is never
 * the only cue (WCAG 1.4.1). Screen readers get one summary line.
 */
export function StackBar({ parts, total }: { parts: Part[]; total?: number }) {
  const shown = parts.filter((p) => p.value > 0);
  const sum = total ?? shown.reduce((s, p) => s + p.value, 0);
  if (sum <= 0) return null;
  return (
    <View accessible accessibilityLabel={shown.map((p) => `${p.label}: ${formatBRL(p.value)}`).join('; ')} style={styles.stackBox}>
      <View style={styles.stack}>
        {shown.map((p) => (
          <View key={p.key} style={{ flex: p.value / sum, backgroundColor: p.color }} />
        ))}
      </View>
      <View style={styles.legend}>
        {shown.map((p) => (
          <View key={p.key} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: p.color }]} />
            <Text style={styles.legendText}>{p.label}</Text>
            <Text style={styles.legendValue}>{formatBRL(p.value)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Horizontal bars for comparing a few named values, with optional reference lines (e.g. a rate to beat).
 * `format` turns a value into its label; values below zero are drawn as zero.
 */
export function HBars({ rows, markers = [], format }: {
  rows: { key: string; label: string; value: number; tone?: 'warn' | 'ok' }[];
  markers?: { label: string; value: number }[];
  format: (v: number) => string;
}) {
  const max = Math.max(...rows.map((r) => r.value), ...markers.map((m) => m.value), 0) || 1;
  const summary = [...rows.map((r) => `${r.label}: ${format(r.value)}`), ...markers.map((m) => `${m.label}: ${format(m.value)}`)].join('; ');
  return (
    <View accessible accessibilityLabel={summary} style={styles.hbars}>
      {rows.map((r) => (
        <View key={r.key} style={styles.hrow}>
          <View style={styles.hhead}>
            <Text style={styles.hlabel} numberOfLines={1}>
              {r.label}
            </Text>
            <Text style={styles.hvalue}>{format(r.value)}</Text>
          </View>
          <View style={styles.htrack}>
            <View style={[styles.hfill, r.tone === 'warn' && styles.hfillWarn, { width: `${(Math.max(0, r.value) / max) * 100}%` }]} />
            {markers.map((m) => (
              <View key={m.label} style={[styles.hmarker, { left: `${(m.value / max) * 100}%` }]} />
            ))}
          </View>
        </View>
      ))}
      {markers.length > 0 && (
        <View style={styles.legend}>
          {markers.map((m) => (
            <View key={m.label} style={styles.legendItem}>
              <View style={styles.markerSwatch} />
              <Text style={styles.legendText}>{m.label}</Text>
              <Text style={styles.legendValue}>{format(m.value)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
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
  const color = ratio >= 0.9 ? '#B4532A' : ratio >= 0.7 ? '#E88D5D' : '#0052FF';
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
  barUp: { backgroundColor: '#0052FF' },
  barDown: { backgroundColor: '#D2693A' },
  barMark: { borderWidth: 2, borderColor: '#E88D5D' },
  zero: { height: 1, backgroundColor: 'rgba(10,15,29,0.14)' },
  barLabel: { fontSize: 11, textAlign: 'center', opacity: 0.75, marginTop: 4 },
  // Sparse axis labels may overflow their narrow bar column.
  axisLabel: { width: 40, alignSelf: 'center' },
  meterBox: { gap: 4 },
  meterHead: { flexDirection: 'row', justifyContent: 'space-between' },
  meterLabel: { fontSize: 13, opacity: 0.75 },
  meterTrack: { height: 10, borderRadius: 5, backgroundColor: 'rgba(127,127,127,0.25)', overflow: 'hidden' },
  meterFill: { height: 10, borderRadius: 5 },
  cardShadow: { borderRadius: 24, shadowColor: '#0A0F1D', shadowOpacity: 0.07, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 2 },
  card: {
    padding: 18, borderRadius: 24, gap: 6, overflow: 'hidden', backgroundColor: GLASS.tint,
    borderWidth: 1, borderColor: GLASS.edge,
  },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, marginTop: 6 },
  ok: { backgroundColor: 'rgba(16,185,129,0.16)' },
  warn: { backgroundColor: 'rgba(255,165,123,0.24)' },
  risk: { backgroundColor: 'rgba(232,141,93,0.30)' },
  pillText: { fontSize: 13, fontWeight: '500', color: '#0A0F1D' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingVertical: 6 },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 16, color: '#0A0F1D' },
  rowDetail: { fontSize: 13, color: '#4F576B' },
  stackBox: { gap: 10, marginTop: 4 },
  stack: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: 'rgba(127,127,127,0.18)' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: 13, color: '#4F576B' },
  legendValue: { fontSize: 13, fontWeight: '600', color: '#0A0F1D', fontVariant: ['tabular-nums'] },
  hbars: { gap: 10, marginTop: 4 },
  hrow: { gap: 4 },
  hhead: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  hlabel: { flex: 1, fontSize: 14, color: '#0A0F1D' },
  hvalue: { fontSize: 14, fontWeight: '600', color: '#0A0F1D', fontVariant: ['tabular-nums'] },
  htrack: { height: 10, borderRadius: 5, backgroundColor: 'rgba(127,127,127,0.18)' },
  hfill: { height: 10, borderRadius: 5, backgroundColor: '#0052FF' },
  hfillWarn: { backgroundColor: '#E88D5D' },
  hmarker: { position: 'absolute', top: -3, width: 2, height: 16, marginLeft: -1, backgroundColor: '#0A0F1D' },
  markerSwatch: { width: 2, height: 12, backgroundColor: '#0A0F1D' },
  rowValue: { fontSize: 16, fontWeight: '600', color: '#0A0F1D', fontVariant: ['tabular-nums'] },
});
