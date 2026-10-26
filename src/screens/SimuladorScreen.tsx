import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  applyChanges,
  evaluate,
  monthOf,
  param,
  scenarioRows,
  suggestActions,
  type Action,
  type Scenario,
  type ScenarioChange,
  type ScenarioResult,
  type ScenarioRows,
} from '../engine';
import { commitScenario, listScenarios, removeScenario, saveScenario } from '../db/repos';
import { ActionsList } from '../components/ActionsList';
import { EmptyState } from '../components/EmptyState';
import { Button, FormError, FormScreen, Input, trySave } from '../components/form';
import { Card } from '../components/ui';
import { newId } from '../lib/id';
import { isEmptyProfile, useReadyData } from '../state/AppData';
import { nextDueMonth } from './onboarding/logic';
import { changeFromDraft, defaultDraft, describeRows, SIM_TYPES, type SimDraft, type SimType } from './simulator/mappers';
import { ScenarioResultCard } from './simulator/ResultCard';
import { needsCard, NoCardHint, SimForm } from './simulator/SimForm';

export function SimuladorScreen() {
  const { db, profile, today, refresh } = useReadyData();
  const [type, setType] = useState<SimType | null>(null);
  const [draft, setDraft] = useState<SimDraft>({});
  const [loaded, setLoaded] = useState<Scenario | null>(null);
  const [saved, setSaved] = useState<Scenario[]>([]);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [pending, setPending] = useState<{ rows: ScenarioRows; lines: string[] } | null>(null);
  const [naming, setNaming] = useState<string | null>(null);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    listScenarios(db).then(setSaved).catch((e: unknown) => console.warn('[Simulador] list', e));
  }, [db]);

  const parsed = useMemo(() => {
    if (!type) return null;
    const dueMonthFor = (cardId: string) => {
      const card = profile.cards.find((c) => c.id === cardId);
      return card ? nextDueMonth(card, today) : monthOf(today);
    };
    return changeFromDraft(type, draft, { dueMonthFor });
  }, [type, draft, profile, today]);
  const changes: ScenarioChange[] | null = loaded ? loaded.changes : parsed?.ok ? [parsed.value] : null;
  const changesKey = JSON.stringify(changes);
  // Show errors only for fields the user already typed in; empty required fields just wait.
  const errors = parsed && !parsed.ok ? Object.fromEntries(Object.entries(parsed.errors).filter(([f]) => (draft[f] ?? '').trim() !== '')) : {};

  // Re-evaluate shortly after typing stops (target: under 1 s on a phone).
  useEffect(() => {
    const current: ScenarioChange[] | null = changesKey === 'null' ? null : JSON.parse(changesKey);
    if (!current) {
      setResult(null);
      return;
    }
    const timer = setTimeout(() => {
      try {
        const preview = { id: 'preview', name: 'preview', changes: current };
        setResult(evaluate(profile, preview, today));
        setActions(suggestActions(profile, preview, today));
      } catch (e) {
        console.warn('[Simulador] evaluate', e);
        setResult(null);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [changesKey, profile, today]);

  if (isEmptyProfile(profile)) return <EmptyState />;

  const reset = () => {
    setType(null);
    setLoaded(null);
    setPending(null);
    setNaming(null);
  };

  const pick = (t: SimType) => {
    reset();
    setMessage(undefined);
    setType(t);
    setDraft(defaultDraft(t, { today, cardId: profile.cards[0]?.id, partialMonths: param(profile.parameters, 'partial_plan_default_months', today) }));
  };

  const prepareCommit = () => {
    if (!changes) return;
    const after = applyChanges(profile, changes, today, (prefix) => newId(prefix));
    const rows = scenarioRows(profile, after);
    setPending({ rows, lines: describeRows(rows, profile.cards) });
  };

  const commit = async () => {
    if (!pending) return;
    if (await trySave(() => commitScenario(db, pending.rows), setError)) {
      await refresh();
      reset();
      setMessage('Pronto. Já está no seu controle e nas projeções.');
    }
  };

  const saveAs = async () => {
    if (!changes || !naming?.trim()) return;
    const scenario: Scenario = { id: newId('scn'), name: naming.trim(), changes };
    if (await trySave(() => saveScenario(db, scenario).then(() => undefined), setError)) {
      setSaved(await listScenarios(db));
      setNaming(null);
      setMessage(`Cenário "${scenario.name}" salvo.`);
    }
  };

  const title = loaded ? loaded.name : SIM_TYPES.find((s) => s.type === type)?.title;

  return (
    <FormScreen>
      {message && (
        <Text style={styles.message} accessibilityLiveRegion="polite">
          {message}
        </Text>
      )}

      {saved.length > 0 && !type && !loaded && (
        <Card>
          <Text style={styles.label}>Cenários salvos</Text>
          {saved.map((s) => (
            <View key={s.id} style={styles.savedRow}>
              <Pressable
                style={styles.flex}
                onPress={() => {
                  reset();
                  setLoaded(s);
                  setMessage(undefined);
                }}
                accessibilityRole="button"
              >
                <Text style={styles.body}>{s.name}</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  if (await trySave(() => removeScenario(db, s.id).then(() => undefined), setError)) setSaved(await listScenarios(db));
                }}
                accessibilityRole="button"
                accessibilityLabel={`Apagar cenário ${s.name}`}
                style={styles.remove}
              >
                <Text style={styles.removeText}>Apagar</Text>
              </Pressable>
            </View>
          ))}
        </Card>
      )}

      {!type && !loaded ? (
        <View style={styles.grid}>
          {SIM_TYPES.map((s) => (
            <Pressable key={s.type} style={styles.tile} onPress={() => pick(s.type)} accessibilityRole="button" accessibilityHint={s.hint}>
              <Text style={styles.tileTitle}>{s.title}</Text>
              <Text style={styles.tileHint}>{s.hint}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={reset} accessibilityRole="button" style={styles.remove}>
              <Text style={styles.link}>Trocar</Text>
            </Pressable>
          </View>

          {type &&
            (needsCard(type) && profile.cards.length === 0 ? (
              <NoCardHint />
            ) : (
              <SimForm type={type} draft={draft} onChange={(f, v) => setDraft((d) => ({ ...d, [f]: v }))} errors={errors} cards={profile.cards} />
            ))}

          {result && <ScenarioResultCard result={result} actions={<ActionsList actions={actions} />} />}

          {result && !pending && (
            <>
              <Button title="Seguir com isso" onPress={prepareCommit} />
              {!loaded &&
                (naming === null ? (
                  <Button title="Salvar cenário" kind="secondary" onPress={() => setNaming(title ?? 'Cenário')} />
                ) : (
                  <>
                    <Input label="Nome do cenário" value={naming} onChangeText={setNaming} autoFocus />
                    <Button title="Salvar" kind="secondary" onPress={saveAs} />
                  </>
                ))}
            </>
          )}

          {pending && (
            <Card>
              <Text style={styles.label}>Isto vai entrar no seu controle:</Text>
              {pending.lines.length === 0 && <Text style={styles.body}>Nada muda nos seus lançamentos.</Text>}
              {pending.lines.map((line) => (
                <Text key={line} style={styles.body}>
                  • {line}
                </Text>
              ))}
              <Button title="Confirmar" onPress={commit} disabled={pending.lines.length === 0} />
              <Button title="Voltar" kind="secondary" onPress={() => setPending(null)} />
            </Card>
          )}
          <FormError message={error} />
        </>
      )}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  message: { fontSize: 15, fontWeight: '500', color: '#2f6f4f' },
  label: { fontSize: 13, opacity: 0.6 },
  body: { fontSize: 15 },
  flex: { flex: 1, minHeight: 44, justifyContent: 'center' },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  remove: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' },
  removeText: { fontSize: 14, opacity: 0.7 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '47%', minHeight: 96, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#8885', gap: 4 },
  tileTitle: { fontSize: 15, fontWeight: '600' },
  tileHint: { fontSize: 12, opacity: 0.65 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: '600', flex: 1 },
  link: { fontSize: 15, color: '#2f6f4f', fontWeight: '500' },
});
