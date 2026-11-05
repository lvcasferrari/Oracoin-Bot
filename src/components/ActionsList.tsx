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
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" style={styles.link}>
        <Text style={styles.linkText}>{open ? 'Ocultar detalhes' : 'Ver detalhes'}</Text>
      </Pressable>
      {open && (
        <>
          <Text style={styles.hint}>
            {action.impact.totalCost > 0 ? (
              <>
                Custo estimado: até <Money value={action.impact.totalCost} /> em encargos
              </>
            ) : (
              'Sem custo'
            )}
            {' · '}menor saldo previsto: <Money value={action.impact.criticalBalanceAfter} />
          </Text>
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
  // Flat inside its Card: no tinted box (cards are never nested).
  item: { gap: 4 },
  title: { fontSize: 16, fontWeight: '600', color: '#1f1f1f' },
  body: { fontSize: 15, lineHeight: 21, color: '#1f1f1f' },
  hint: { fontSize: 13, lineHeight: 18, color: '#595959' },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontSize: 14, color: '#265a40', fontWeight: '500' },
});
