import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Chips, FormError, FormScreen, trySave, useAnnounce, useBusy } from '../../components/form';
import { Card } from '../../components/ui';
import { commitImport, type DuplicateMode } from '../../import/commit';
import { countDuplicates, countNew, mapWorkbook, type ImportPreview, type Row } from '../../import/mapWorkbook';
import { ImportFileError, pickWorkbook } from '../../import/pickWorkbook';
import { newId } from '../../lib/id';
import { logError } from '../../lib/log';
import type { PlanoStackParamList } from '../../navigation/types';
import { useReadyData } from '../../state/AppData';

const MODES = [
  { value: 'skip' as const, label: 'Manter o que já está no app' },
  { value: 'replace' as const, label: 'Substituir pelo da planilha' },
];

function summary<T>(label: string, rows: Row<T>[], name: (v: T) => string): string | null {
  if (rows.length === 0) return null;
  const dup = rows.filter((r) => r.duplicate).length;
  const names = rows.slice(0, 4).map((r) => name(r.value)).join(', ');
  return `${label}: ${rows.length}${dup ? ` (${dup} já ${dup === 1 ? 'existe' : 'existem'})` : ''}. ${names}${rows.length > 4 ? '…' : ''}`;
}

/** "Importar planilha" (spec 07): local only, preview first, all or nothing. */
export function ImportScreen({ navigation }: NativeStackScreenProps<PlanoStackParamList, 'Import'>) {
  const { db, profile, today, refresh } = useReadyData();
  const [file, setFile] = useState<string>();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mode, setMode] = useState<DuplicateMode>('skip');
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();
  const [busy, run] = useBusy();
  useAnnounce(done);

  const choose = () =>
    run(async () => {
      setError(undefined);
      try {
        const picked = await pickWorkbook();
        if (!picked) return;
        setFile(picked.name);
        setPreview(mapWorkbook(picked.sheets, { today, makeId: newId, existing: profile }));
      } catch (e) {
        logError('[Import] pick', e);
        setError(e instanceof ImportFileError ? e.message : 'Não consegui abrir o arquivo. Tente de novo.');
      }
    });

  const confirm = () =>
    run(async () => {
      if (!preview) return;
      let count = 0;
      const ok = await trySave(async () => {
        count = await commitImport(db, preview, mode, today);
        await refresh();
      }, setError);
      if (ok) {
        setPreview(null);
        setDone(`Pronto: ${count} ${count === 1 ? 'item importado' : 'itens importados'}. Já estão nas projeções.`);
      }
    });

  if (done) {
    return (
      <FormScreen>
        <Text style={styles.title}>{done}</Text>
        <Button title="Voltar ao Plano" onPress={() => navigation.goBack()} />
      </FormScreen>
    );
  }

  const lines = preview
    ? [
        summary('Contas', preview.accounts, (a) => a.bank),
        summary('Cartões', preview.cards, (c) => `${c.bank} ${c.name}`),
        summary('Entradas e saídas', preview.entries, (e) => e.name),
        summary('Meses de parcelas', preview.installments, (i) => `${i.dueMonth.slice(5)}/${i.dueMonth.slice(0, 4)}`),
        summary('Dívidas', preview.debts, (d) => d.name),
        summary('Cenários', preview.scenarios, (s) => s.name),
      ].filter((l): l is string => l !== null)
    : [];
  const duplicates = preview ? countDuplicates(preview) : 0;
  const toWrite = preview ? countNew(preview) + (mode === 'replace' ? duplicates : 0) : 0;

  return (
    <FormScreen>
      <Text style={styles.body}>
        Traga sua planilha .xlsx com as abas Painel, Contas, Cartões, Parcelas, Hipoteca, Empréstimo, Financiamento e Cenários. O arquivo de exemplo
        (life-strategic-plan-exemplo.xlsx, com dados fictícios) mostra as colunas. O arquivo é lido só neste aparelho.
      </Text>
      {!preview && <Button title="Escolher planilha" onPress={choose} disabled={busy} />}

      {preview && (
        <Card>
          <Text style={styles.label} accessibilityRole="header">
            {file}: o que vai entrar
          </Text>
          {lines.length === 0 && <Text style={styles.body}>Nada para importar nesta planilha.</Text>}
          {lines.map((l) => (
            <Text key={l} style={styles.body}>
              • {l}
            </Text>
          ))}
          {preview.warnings.length > 0 && (
            <>
              <Text style={styles.label} accessibilityRole="header">
                Avisos
              </Text>
              {preview.warnings.map((w) => (
                <Text key={w} style={styles.hint}>
                  • {w}
                </Text>
              ))}
            </>
          )}
          {duplicates > 0 && (
            <Chips label={`${duplicates} ${duplicates === 1 ? 'item já existe' : 'itens já existem'}. O que fazer?`} options={MODES} value={mode} onChange={setMode} />
          )}
          <Button title={`Importar ${toWrite} ${toWrite === 1 ? 'item' : 'itens'}`} onPress={confirm} disabled={busy || toWrite === 0} />
          <Button title="Cancelar" kind="secondary" onPress={() => setPreview(null)} disabled={busy} />
        </Card>
      )}
      <FormError message={error} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '600' },
  label: { fontSize: 13, opacity: 0.75, marginTop: 6 },
  body: { fontSize: 15 },
  hint: { fontSize: 13, opacity: 0.8 },
});
