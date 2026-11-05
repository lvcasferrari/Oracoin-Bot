import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { exploreStrategiesAsync, monthlyCost, realizeStrategy, scenarioRows, type ScenarioRows, type Strategy, type StrategyCriterion } from '../../engine';
import { commitScenario } from '../../db/repos';
import { Disclaimer } from '../../components/Disclaimer';
import { Button, Chips, COLORS, FormError, InlineConfirm, trySave, useAnnounce, useBusy } from '../../components/form';
import { BarChart, Card, Money } from '../../components/ui';
import { shortMonth } from '../../lib/dateInput';
import { logError } from '../../lib/log';
import { newId } from '../../lib/id';
import type { PlanoStackParamList } from '../../navigation/types';
import { useReadyData } from '../../state/AppData';
import { describeRows } from '../simulator/mappers';
import { setRoteiroPreview } from './preview';
import { CRITERIA, strategyTitle } from './quitacaoCopy';

export function EstrategiasScreen({ navigation }: NativeStackScreenProps<PlanoStackParamList, 'Estrategias'>) {
  const { db, profile, bridges, today, refresh } = useReadyData();
  const [criterion, setCriterion] = useState<StrategyCriterion>('custo_medio');
  const [list, setList] = useState<Strategy[] | null>(null);
  const [selected, setSelected] = useState(0);
  const [pending, setPending] = useState<{ rows: ScenarioRows; lines: string[] } | null>(null);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [busy, run] = useBusy();
  useAnnounce(message);

  // Up to 96 combinations, computed in slices so the screen (and Back) stay responsive.
  useEffect(() => {
    let alive = true;
    exploreStrategiesAsync(profile, bridges, today, { criterion, cancelled: () => !alive })
      .then((found) => {
        if (!alive || !found) return;
        setList(found);
        setSelected(0);
      })
      .catch((e: unknown) => {
        logError('[Estratégias] explore', e);
        if (alive) setError('Não consegui comparar as estratégias. Confira as dívidas e as premissas.');
      });
    return () => {
      alive = false;
    };
  }, [profile, bridges, today, criterion]);

  const chosen = list?.[selected];
  const months = chosen?.rows.length ?? 0;
  // Rebuilt with real ids only when the user asks to commit (the ranking uses throwaway ids).
  const prepare = () => {
    if (!chosen) return;
    const rows = scenarioRows(profile, realizeStrategy(profile, chosen, today, newId));
    const lines = describeRows(rows, profile.cards);
    if (lines.length === 0) setMessage('Esta estratégia não muda nada no seu controle: não há o que gravar.');
    else setPending({ rows, lines });
  };

  const commit = () =>
    run(async () => {
      if (!pending) return;
      if (await trySave(() => commitScenario(db, pending.rows), setError)) {
        setPending(null);
        await refresh();
        setMessage('Pronto. A estratégia já está no seu controle e nas projeções.');
      }
    });

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Chips
        label="Ordenar por"
        options={CRITERIA}
        value={criterion}
        onChange={(c) => {
          setList(null);
          setPending(null);
          setCriterion(c);
        }}
      />
      {message && <Text style={styles.done}>{message}</Text>}
      {!list && !error && (
        <Card>
          <Text style={styles.body} accessibilityLiveRegion="polite">
            Comparando quitações, crédito ponte e gasto variável…
          </Text>
          <View style={styles.skeleton} />
          <View style={[styles.skeleton, styles.skeletonShort]} />
        </Card>
      )}
      {list && (
        <Card>
          <Text style={styles.label} accessibilityRole="header">
            Custo médio em {months} meses
          </Text>
          <View accessibilityRole="radiogroup">
            {list.map((s, i) => {
              const on = i === selected;
              const title = strategyTitle(s);
              return (
                <Pressable
                  key={title}
                  onPress={() => {
                    setSelected(i);
                    setPending(null);
                  }}
                  style={[styles.option, on && styles.optionOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${i + 1}. ${title}. Custo mensal médio ${Math.round(s.avgMonthlyCost)} reais. Crédito novo ${Math.round(s.newCredit)} reais.${s.covered ? '' : ' O saldo ainda fica abaixo da reserva em algum mês.'}`}
                >
                  <Text style={styles.title}>
                    {i + 1}. {title}
                  </Text>
                  <View style={styles.grid}>
                    <Metric label="Custo mensal" value={s.avgMonthlyCost} />
                    <Metric label="Crédito novo" value={s.newCredit} />
                  </View>
                  {!s.covered && <Text style={styles.warn}>Ainda falta caixa em algum mês.</Text>}
                </Pressable>
              );
            })}
          </View>
          {bridges.length === 0 && list.some((s) => !s.covered) && (
            <Text style={styles.note}>Para comparar formas de cobrir a falta, informe opções em Plano › Crédito ponte.</Text>
          )}
        </Card>
      )}

      {chosen && (
        <Card>
          <View style={styles.grid}>
            <Metric label="Custo no fim" value={chosen.endMonthlyCost} />
            <Metric label="Juros do crédito novo" value={chosen.newInterest} />
          </View>
          <Text style={styles.label} accessibilityRole="header">
            Custo mensal, mês a mês
          </Text>
          <BarChart bars={chosen.rows.map((r) => ({ key: r.month, label: shortMonth(r.month).slice(0, 3), value: monthlyCost(r) }))} />
          <Text style={styles.note}>
            Menor saldo previsto: <Money value={chosen.lowestBalance} />
          </Text>
          <Button
            title="Ver roteiro mês a mês"
            kind="secondary"
            onPress={() => {
              setRoteiroPreview({ title: strategyTitle(chosen), profile: chosen.after });
              navigation.navigate('Roteiro', { preview: true });
            }}
          />
          {pending ? (
            <InlineConfirm
              message={`Gravar ${pending.lines.length} ${pending.lines.length === 1 ? 'item' : 'itens'} no seu controle? ${pending.lines.join('. ')}.`}
              confirmLabel="Gravar"
              disabled={busy}
              onCancel={() => setPending(null)}
              onConfirm={commit}
            />
          ) : (
            <Button title="Seguir com isso" disabled={busy} onPress={prepare} />
          )}
        </Card>
      )}
      <FormError message={error} />
      <Disclaimer />
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Money value={value} style={styles.metricValue} />
    </View>
  );
}

// Secondary text uses COLORS.placeholder, not opacity (contrast holds on the grey cards).
const styles = StyleSheet.create({
  page: { padding: 16, gap: 12 },
  label: { fontSize: 13, color: COLORS.placeholder, marginBottom: 4 },
  body: { fontSize: 15, color: COLORS.text },
  done: { fontSize: 15, color: COLORS.primaryText, fontWeight: '600' },
  note: { fontSize: 13, lineHeight: 18, color: COLORS.placeholder },
  warn: { fontSize: 13, color: COLORS.danger },
  option: { gap: 8, padding: 12, marginTop: 8, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', minHeight: 44 },
  optionOn: { borderColor: COLORS.primary, borderWidth: 2, padding: 11, backgroundColor: 'rgba(95,212,160,0.12)' },
  title: { fontSize: 15, fontWeight: '600', lineHeight: 20, color: COLORS.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 },
  metric: { width: '50%', gap: 2 },
  metricLabel: { fontSize: 12, color: COLORS.placeholder },
  metricValue: { fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'], color: COLORS.text },
  skeleton: { height: 14, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.10)', marginTop: 10 },
  skeletonShort: { width: '60%' },
});
