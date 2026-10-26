import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  commitmentRatio,
  contributions,
  forecastError,
  goalTimeline,
  healthScore,
  monthOf,
  onTrack,
  param,
  paramRow,
  PARAM_KEYS,
  scoreTrend,
  type Parameter,
  type ScorePart,
} from '../engine';
import { listScoreHistory, saveScoreSnapshot, type ScoreSnapshot } from '../db/repos';
import { resetAll } from '../db/reset';
import { Disclaimer } from '../components/Disclaimer';
import { Button, FormError, trySave, useBusy } from '../components/form';
import { Card, Money, Pill } from '../components/ui';
import { shortMonth } from '../lib/dateInput';
import { logError } from '../lib/log';
import { displayParam, PARAM_INFO } from '../lib/paramInfo';
import type { PlanoStackParamList, RootStackParamList, TabParamList } from '../navigation/types';
import { isEmptyProfile, useReadyData } from '../state/AppData';

const PART_LABELS: Record<ScorePart, string> = {
  controle: 'Controle do dia a dia',
  colchao: 'Colchão para imprevistos',
  metas: 'Metas no caminho',
  liberdade: 'Liberdade de escolha',
};

// Referência do app (não padrão de mercado): comprometimento por faixa.
function band(ratio: number, params: Parameter[], today: string): { label: string; tone: 'ok' | 'warn' | 'risk' } {
  if (!Number.isFinite(ratio)) return { label: 'Sem renda no mês', tone: 'risk' };
  if (ratio < param(params, 'commitment_band_yellow', today)) return { label: 'Verde: comprometimento baixo', tone: 'ok' };
  if (ratio < param(params, 'commitment_band_orange', today)) return { label: 'Amarelo: atenção', tone: 'warn' };
  if (ratio < param(params, 'commitment_band_red', today)) return { label: 'Laranja: aperta', tone: 'warn' };
  return { label: 'Vermelho: sinal de alerta', tone: 'risk' };
}

export function PlanoScreen({ navigation }: NativeStackScreenProps<PlanoStackParamList, 'PlanoHome'>) {
  const { db, profile, today } = useReadyData();
  const month = monthOf(today);
  const empty = isEmptyProfile(profile);
  const score = healthScore(profile, today);
  const [history, setHistory] = useState<ScoreSnapshot[]>([]);
  const [why, setWhy] = useState(false);

  // One snapshot per month (the latest value of the month) feeds the trend. Never for an empty
  // profile: that would write a row right after "apagar todos os meus dados".
  const { controle, colchao, metas, liberdade } = score.parts;
  useEffect(() => {
    if (empty) return;
    saveScoreSnapshot(db, { month, total: score.total, controle, colchao, metas, liberdade })
      .then(() => listScoreHistory(db))
      .then(setHistory)
      .catch((e: unknown) => logError('[Plano] score history', e));
  }, [db, empty, month, score.total, controle, colchao, metas, liberdade]);

  const trend = scoreTrend(history, month, score.total);
  const timeline = goalTimeline(profile.goals, contributions(profile, today));
  const ratio = commitmentRatio(profile, month, today);
  const current = band(ratio, profile.parameters, today);
  const quality = forecastError(profile.invoices);
  const groups = [...new Set(PARAM_KEYS.map((k) => PARAM_INFO[k].group))];
  const partText = (k: ScorePart) => (k === 'metas' && score.noGoals ? 'sem metas ainda' : `${score.parts[k]} de 100`);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      {!empty && (
        <Card>
          <Text style={styles.label} accessibilityRole="header">
            Saúde financeira
          </Text>
          <Text style={styles.headline}>{trend ?? `Primeira medição: ${score.total} de 100.`}</Text>
          {trend && <Text style={styles.hint}>Hoje: {score.total} de 100.</Text>}
          {(Object.keys(PART_LABELS) as ScorePart[]).map((k) => (
            <View key={k} style={styles.bar} accessible accessibilityLabel={`${PART_LABELS[k]}: ${partText(k)}`}>
              <View style={styles.barHead}>
                <Text style={styles.body}>{PART_LABELS[k]}</Text>
                <Text style={styles.body}>{k === 'metas' && score.noGoals ? 'sem metas ainda' : score.parts[k]}</Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${score.parts[k]}%` }]} />
              </View>
            </View>
          ))}
          <Text style={styles.body}>{score.topImprovement}</Text>
          <Pressable onPress={() => setWhy((w) => !w)} accessibilityRole="button" style={styles.link}>
            <Text style={styles.linkText}>{why ? 'Esconder explicação' : 'Por que você está vendo isto'}</Text>
          </Pressable>
          {why && (
            <Text style={styles.hint}>
              Referência do app, baseada nos quatro elementos de bem-estar financeiro do CFPB. Controle: sobra do mês sobre a renda. Colchão: meses de
              despesas essenciais que o saldo cobre. Metas: quantas estão no ritmo do prazo. Liberdade: quanto faturas e dívidas levam da renda, e se
              houve pagamento parcial de fatura recentemente. Pesos e faixas podem ser mudados em Premissas.
            </Text>
          )}
        </Card>
      )}

      <Card>
        <Text style={styles.label} accessibilityRole="header">
          Metas
        </Text>
        {timeline.length === 0 && <Text style={styles.body}>Nenhuma meta ainda. A sobra de cada mês vai para a meta de prioridade 1 primeiro.</Text>}
        {timeline.map((t) => {
          const progress = Math.min(100, Math.round((t.goal.saved / t.goal.target) * 100));
          return (
            <Pressable key={t.goal.id} onPress={() => navigation.navigate('GoalForm', { id: t.goal.id })} accessibilityRole="button" accessibilityHint="Editar meta" style={styles.goal}>
              <View style={styles.barHead}>
                <Text style={styles.strong}>
                  {t.goal.priority}. {t.goal.name}
                </Text>
                <Money value={t.goal.target} />
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.hint}>
                {progress}% guardado · {t.reachedMonth ? `chega em ${shortMonth(t.reachedMonth)} (estimado)` : 'não alcança nos próximos meses com a sobra atual'}
                {t.goal.deadline ? (onTrack(t) ? ' · no prazo' : ' · depois do prazo') : ''}
              </Text>
            </Pressable>
          );
        })}
        <Button title="+ Meta" accessibilityLabel="Adicionar meta" kind="secondary" onPress={() => navigation.navigate('GoalForm')} />
      </Card>

      {!empty && (
        <Card>
          <Text style={styles.label} accessibilityRole="header">
            Comprometimento do mês
          </Text>
          <Text style={styles.headline}>{Number.isFinite(ratio) ? `${Math.round(ratio * 100)}% da renda` : 'Sem renda no mês'}</Text>
          <Pill tone={current.tone}>{current.label}</Pill>
          <Text style={styles.hint}>Faturas e dívidas sobre a renda líquida. Faixas são referência do app, não padrão oficial.</Text>
          {quality && (
            <Text style={styles.hint}>
              Qualidade da previsão: as faturas vieram, em média, <Money value={quality.meanAbs} /> ({Math.round(quality.meanPct * 100)}%) diferentes do estimado (
              {quality.count} {quality.count === 1 ? 'fatura' : 'faturas'}).
            </Text>
          )}
        </Card>
      )}

      <Card>
        <Text style={styles.label} accessibilityRole="header">
          Premissas (editáveis)
        </Text>
        {groups.map((g) => (
          <View key={g} style={styles.group}>
            <Text style={styles.strong}>{g}</Text>
            {PARAM_KEYS.filter((k) => PARAM_INFO[k].group === g).map((k) => {
              const row = paramRow(profile.parameters, k, today);
              return (
                <Pressable key={k} style={styles.paramRow} onPress={() => navigation.navigate('ParameterForm', { key: k })} accessibilityRole="button" accessibilityHint="Editar premissa">
                  <Text style={styles.paramLabel}>{PARAM_INFO[k].label}</Text>
                  <Text style={styles.paramValue}>{displayParam(k, row.value)}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </Card>

      <Card>
        <Text style={styles.label} accessibilityRole="header">
          Recorrências
        </Text>
        <Button
          title="Ver entradas e saídas"
          kind="secondary"
          // initial: false keeps FluxoHome under Lançamentos even if the Fluxo tab was never opened.
          onPress={() => navigation.getParent<BottomTabNavigationProp<TabParamList>>()?.navigate('Fluxo', { screen: 'Lancamentos', initial: false })}
        />
      </Card>

      <Card>
        <Text style={styles.label} accessibilityRole="header">
          Privacidade
        </Text>
        <Text style={styles.body}>
          Seus dados ficam só neste aparelho: nada é enviado para servidores. O backup do sistema (iCloud ou Google), se estiver ligado, pode guardar uma
          cópia protegida pela sua conta. Você pode apagar tudo abaixo quando quiser.
        </Text>
      </Card>

      <DeleteAllData navigation={navigation} />

      <Disclaimer />
    </ScrollView>
  );
}

/** "Apagar todos os meus dados" (LGPD). Its own component so typing does not recompute the score. */
function DeleteAllData({ navigation }: { navigation: NavigationProp<ParamListBase> }) {
  const { db, today, refresh } = useReadyData();
  const [deleting, setDeleting] = useState(false);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string>();
  const [busy, run] = useBusy();

  const deleteAll = () =>
    run(async () => {
      if (!(await trySave(() => resetAll(db, today), setError))) return;
      await refresh();
      navigation
        .getParent<BottomTabNavigationProp<TabParamList>>()
        ?.getParent<NativeStackNavigationProp<RootStackParamList>>()
        ?.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
    });

  return (
    <Card>
      <Text style={styles.label} accessibilityRole="header">
        Seus dados
      </Text>
      {deleting ? (
        <>
          <Text style={styles.body}>
            Isso apaga contas, cartões, lançamentos, faturas, dívidas, metas, cenários e premissas editadas deste aparelho. Não dá para desfazer. Cópias
            de backup do sistema (iCloud ou Google), se existirem, são geridas pelo sistema.
          </Text>
          <TextInput
            style={styles.input}
            value={typed}
            onChangeText={setTyped}
            placeholder="Digite APAGAR"
            placeholderTextColor="#6b6b6b"
            autoCapitalize="characters"
            accessibilityLabel="Digite APAGAR para confirmar"
          />
          <Button title="Apagar todos os meus dados" kind="danger" disabled={busy || typed.trim() !== 'APAGAR'} onPress={deleteAll} />
          <Button
            title="Cancelar"
            kind="secondary"
            onPress={() => {
              setDeleting(false);
              setTyped('');
            }}
          />
        </>
      ) : (
        <Button title="Apagar todos os meus dados" kind="secondary" onPress={() => setDeleting(true)} />
      )}
      <FormError message={error} />
    </Card>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12 },
  label: { fontSize: 13, opacity: 0.75 },
  headline: { fontSize: 22, fontWeight: '600' },
  body: { fontSize: 15 },
  strong: { fontSize: 15, fontWeight: '600' },
  hint: { fontSize: 12, opacity: 0.75 },
  bar: { gap: 4 },
  barHead: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 8, borderRadius: 4, backgroundColor: '#8883', overflow: 'hidden' },
  fill: { height: 8, backgroundColor: '#2f6f4f' },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontSize: 15, color: '#265a40', fontWeight: '500' },
  goal: { gap: 4, paddingVertical: 6 },
  group: { gap: 2, marginTop: 6 },
  paramRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  paramLabel: { flex: 1, fontSize: 14 },
  paramValue: { fontSize: 14, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#767676', borderRadius: 10, paddingHorizontal: 12, minHeight: 44, fontSize: 16, color: '#1f1f1f' },
});
