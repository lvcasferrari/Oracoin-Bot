import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Action } from '../engine';
import { displayParam, PARAM_INFO } from '../lib/paramInfo';
import { Money } from './ui';

/** Concrete actions with their calculated cost and the "por que você está vendo isto" (spec 04). */
export function ActionsList({ actions, empty }: { actions: Action[]; empty?: string }) {
  if (actions.length === 0) return <Text style={styles.hint}>{empty ?? 'Nenhuma saída extra necessária agora.'}</Text>;
  return (
    <View style={styles.list}>
      {actions.map((a) => (
        <ActionItem key={`${a.id}-${a.cardId ?? ''}`} action={a} />
      ))}
    </View>
  );
}

function ActionItem({ action }: { action: Action }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.item}>
      <Text style={styles.title}>{action.title}</Text>
      <Text style={styles.body}>{action.message}</Text>
      <Text style={styles.cost}>
        {action.impact.totalCost > 0 ? (
          <>
            Custo estimado: até <Money value={action.impact.totalCost} /> em encargos
          </>
        ) : (
          'Sem custo'
        )}
        {' · '}menor saldo previsto: <Money value={action.impact.criticalBalanceAfter} />
      </Text>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" style={styles.link}>
        <Text style={styles.linkText}>{open ? 'Esconder' : 'Por que você está vendo isto'}</Text>
      </Pressable>
      {open && (
        <>
          <Text style={styles.hint}>{action.why}</Text>
          {action.assumptions.map((p) => (
            <Text key={`${p.key}-${p.effectiveFrom}`} style={styles.hint}>
              {PARAM_INFO[p.key].label}: {displayParam(p.key, p.value)} ({p.source})
            </Text>
          ))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  item: { gap: 4, padding: 10, borderRadius: 12, backgroundColor: 'rgba(47,111,79,0.08)' },
  title: { fontSize: 15, fontWeight: '600' },
  body: { fontSize: 15 },
  cost: { fontSize: 13, opacity: 0.8 },
  hint: { fontSize: 12, opacity: 0.7 },
  link: { minHeight: 44, justifyContent: 'center' },
  // Darker green on the tinted item keeps 4.5:1 contrast.
  linkText: { fontSize: 14, color: '#265a40', fontWeight: '500' },
});
