import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { paramRow } from '../../engine';
import { restoreParameterDefault, saveParameter, USER_SOURCE } from '../../db/repos';
import { Button, Chips, FormError, FormScreen, Input, trySave } from '../../components/form';
import { formatDateBR } from '../../lib/dateInput';
import { displayParam, PARAM_INFO, paramInput, parseParamInput } from '../../lib/paramInfo';
import type { PlanoStackParamList } from '../../navigation/types';
import { useReadyData } from '../../state/AppData';

/** Edits a premissa: a new dated row from today; earlier values stay in the history (spec 06 rule 6). */
export function ParameterFormScreen({ route, navigation }: NativeStackScreenProps<PlanoStackParamList, 'ParameterForm'>) {
  const { db, profile, today, refresh } = useReadyData();
  const { key } = route.params;
  const info = PARAM_INFO[key];
  const current = paramRow(profile.parameters, key, today);
  const isBool = info.unit === 'bool';
  const [text, setText] = useState(isBool ? displayParam(key, current.value) : paramInput(key, current.value));
  const [error, setError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const edited = profile.parameters.some((p) => p.key === key && p.source === USER_SOURCE);

  const save = async () => {
    const value = parseParamInput(key, text);
    if (value === null) return setError(`Use um valor entre ${info.min} e ${info.max}.`);
    if (await trySave(() => saveParameter(db, { key, value, effectiveFrom: today, source: USER_SOURCE }).then(() => undefined), setFormError)) {
      await refresh();
      navigation.goBack();
    }
  };

  const restore = async () => {
    if (await trySave(() => restoreParameterDefault(db, key).then(() => undefined), setFormError)) {
      await refresh();
      navigation.goBack();
    }
  };

  return (
    <FormScreen>
      <Text style={styles.title}>{info.label}</Text>
      <Text style={styles.body}>Valor atual: {displayParam(key, current.value)}</Text>
      <Text style={styles.hint}>
        Fonte: {current.source} · desde {formatDateBR(current.effectiveFrom)}
      </Text>
      {isBool ? (
        <Chips label="Novo valor" options={[{ value: 'Sim', label: 'Sim' }, { value: 'Não', label: 'Não' }]} value={text} onChange={setText} />
      ) : (
        <Input
          label={`Novo valor${info.unit === 'pct' || info.unit === 'pctMonth' ? ' (%)' : ''}`}
          keyboardType="decimal-pad"
          value={text}
          onChangeText={(t) => {
            setText(t);
            setError(undefined);
          }}
          error={error}
          hint="Vale a partir de hoje. Os cálculos usam este valor na hora."
        />
      )}
      <FormError message={formError} />
      <Button title="Salvar" onPress={save} />
      {edited && <Button title="Restaurar padrão" kind="secondary" onPress={restore} />}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '600' },
  body: { fontSize: 16 },
  hint: { fontSize: 13, opacity: 0.7 },
});
