import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../components/Text';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  commitmentRatio,
  contributions,
  goalTimeline,
  healthScore,
  monthOf,
  onTrack,
  param,
  scoreTrend,
  type Parameter,
  type ScorePart,
} from '../engine';
import { listScoreHistory, saveScoreSnapshot, setReminders, type ScoreSnapshot } from '../db/repos';
import { askReminderPermission } from '../notifications/Reminders';
import { resetAll } from '../db/reset';
import { Disclaimer } from '../components/Disclaimer';
import { Button, COLORS, FormError, trySave, useBusy } from '../components/form';
import { Card, ListRow } from '../components/ui';
import { shortMonth } from '../lib/dateInput';
import { logError } from '../lib/log';
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
  const { db, profile, bridges, today } = useReadyData();
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
  const partText = (k: ScorePart) => (k === 'metas' && score.noGoals ? 'sem metas ainda' : `${score.parts[k]} de 100`);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      {!empty && (
        <Card>
          <Text style={styles.label} accessibilityRole="header">
            Saúde financeira
          </Text>
          <Text style={styles.headline}>{score.total} de 100</Text>
          {trend && <Text style={styles.detail}>{trend}</Text>}
          <Text style={styles.body}>{score.topImprovement}</Text>
          {why &&
            (Object.keys(PART_LABELS) as ScorePart[]).map((k) => (
              <View key={k} style={styles.bar} accessible accessibilityLabel={`${PART_LABELS[k]}: ${partText(k)}`}>
                <View style={styles.barHead}>
                  <Text style={styles.body}>{PART_LABELS[k]}</Text>
                  <Text style={styles.body}>{k === 'metas' && score.noGoals ? '—' : score.parts[k]}</Text>
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${score.parts[k]}%` }]} />
                </View>
              </View>
            ))}
          {why && <Text style={styles.detail}>Comprometimento: {Number.isFinite(ratio) ? `${Math.round(ratio * 100)}% da renda` : 'sem renda no mês'} · {current.label}</Text>}
          <Pressable onPress={() => setWhy((w) => !w)} accessibilityRole="button" style={styles.link}>
            <Text style={styles.linkText}>{why ? 'Ocultar detalhes' : 'Ver detalhes'}</Text>
          </Pressable>
        </Card>
      )}

      <Card>
        <Text style={styles.label} accessibilityRole="header">
          Metas
        </Text>
        {timeline.length === 0 && <Text style={styles.detail}>Nenhuma meta ainda.</Text>}
        {timeline.map((t) => {
          const progress = Math.min(100, Math.round((t.goal.saved / t.goal.target) * 100));
          return (
            <Pressable key={t.goal.id} onPress={() => navigation.navigate('GoalForm', { id: t.goal.id })} accessibilityRole="button" accessibilityHint="Editar meta" style={styles.goal}>
              <View style={styles.barHead}>
                <Text style={styles.strong}>{t.goal.name}</Text>
                <Text style={styles.body}>{progress}%</Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.detail}>
                {t.reachedMonth ? `chega em ${shortMonth(t.reachedMonth)}` : 'sem previsão com a sobra atual'}
                {t.goal.deadline && !onTrack(t) ? ' · depois do prazo' : ''}
              </Text>
            </Pressable>
          );
        })}
        <Button title="+ Meta" accessibilityLabel="Adicionar meta" kind="secondary" onPress={() => navigation.navigate('GoalForm')} />
      </Card>

      <Card>
        <ListRow icon="trending-down-outline" label="Quitação de dívidas" value={profile.debts.length ? String(profile.debts.length) : undefined} onPress={() => navigation.navigate('Quitacao')} />
        <ListRow icon="checkmark-done-outline" label="Histórico de pagamentos" onPress={() => navigation.navigate('Historico')} />
        <ListRow icon="swap-horizontal-outline" label="Crédito ponte" value={bridges.length ? String(bridges.length) : undefined} onPress={() => navigation.navigate('Pontes')} />
      </Card>

      <Card>
        <ListRow icon="options-outline" label="Premissas" onPress={() => navigation.navigate('Premissas')} />
        <ListRow
          icon="repeat-outline"
          label="Entradas e saídas"
          // initial: false keeps FluxoHome under Lançamentos even if the Fluxo tab was never opened.
          onPress={() => navigation.getParent<BottomTabNavigationProp<TabParamList>>()?.navigate('Fluxo', { screen: 'Lancamentos', initial: false })}
        />
        <ListRow icon="document-attach-outline" label="Importar planilha" onPress={() => navigation.navigate('Import')} />
        <RemindersRow />
        <ListRow icon="lock-closed-outline" label="Privacidade e dados" onPress={() => navigation.navigate('Dados')} />
      </Card>
      <Disclaimer />
    </ScrollView>
  );
}

/** "Apagar todos os meus dados" (LGPD). Its own component so typing does not recompute the score. */
export function DeleteAllData({ navigation }: { navigation: NavigationProp<ParamListBase> }) {
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
            placeholderTextColor={COLORS.placeholder}
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
  label: { fontSize: 13, color: COLORS.placeholder },
  headline: { fontSize: 22, fontWeight: '600' },
  body: { fontSize: 15 },
  strong: { fontSize: 15, fontWeight: '600' },
  detail: { fontSize: 13, color: COLORS.placeholder },
  hint: { fontSize: 12, opacity: 0.75 },
  bar: { gap: 4 },
  barHead: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 8, borderRadius: 4, backgroundColor: '#8883', overflow: 'hidden' },
  fill: { height: 8, backgroundColor: '#5fd4a0' },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontSize: 15, color: '#7ee2b4', fontWeight: '500' },
  goal: { gap: 4, paddingVertical: 6 },
  group: { gap: 2, marginTop: 6 },
  paramRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  paramLabel: { flex: 1, fontSize: 14 },
  paramValue: { fontSize: 14, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', borderRadius: 10, paddingHorizontal: 12, minHeight: 44, fontSize: 16, color: '#eef3f1' },
});

/** One tap turns invoice reminders on or off; when the system blocks them, the tap opens the iPhone Settings. */
function RemindersRow() {
  const { db, meta, refresh } = useReadyData();
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, run] = useBusy();
  const toggle = () =>
    run(async () => {
      if (blocked) return void Linking.openSettings();
      const on = !meta.reminders && (await askReminderPermission().catch(() => false));
      if (!meta.reminders && !on) setBlocked(true);
      if (await trySave(() => setReminders(db, on).then(() => undefined), setError)) await refresh();
    });
  return (
    <>
      <ListRow
        icon="notifications-outline"
        label="Avisos de fatura"
        detail={blocked ? 'Bloqueados nos Ajustes do iPhone. Toque para abrir.' : 'Quando a fatura fecha e quando vence.'}
        value={meta.reminders ? 'Ligados' : 'Desligados'}
        onPress={busy ? undefined : toggle}
        hint={meta.reminders ? 'Desliga os avisos' : 'Liga os avisos'}
      />
      <FormError message={error} />
    </>
  );
}
