// Screens split out of Plano so the hub stays short: Premissas, Crédito ponte, Privacidade e dados.
import { ScrollView, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { forecastError, paramRow, PARAM_KEYS } from '../../engine';
import { Button, COLORS } from '../../components/form';
import { Card, ListRow } from '../../components/ui';
import { formatBRL } from '../../lib/money';
import { displayParam, PARAM_INFO } from '../../lib/paramInfo';
import type { PlanoStackParamList } from '../../navigation/types';
import { useReadyData } from '../../state/AppData';
import { DeleteAllData } from '../PlanoScreen';
import { bridgeLabel } from './quitacaoCopy';

export function PremissasScreen({ navigation }: NativeStackScreenProps<PlanoStackParamList, 'Premissas'>) {
  const { profile, today } = useReadyData();
  const groups = [...new Set(PARAM_KEYS.map((k) => PARAM_INFO[k].group))];
  const quality = forecastError(profile.invoices);
  return (
    <ScrollView contentContainerStyle={styles.page}>
      {groups.map((g) => (
        <Card key={g}>
          <Text style={styles.label} accessibilityRole="header">
            {g}
          </Text>
          {PARAM_KEYS.filter((k) => PARAM_INFO[k].group === g).map((k) => (
            <ListRow
              key={k}
              label={PARAM_INFO[k].label}
              value={displayParam(k, paramRow(profile.parameters, k, today).value)}
              onPress={() => navigation.navigate('ParameterForm', { key: k })}
              hint="Editar premissa"
            />
          ))}
        </Card>
      ))}
      {quality && (
        <Text style={styles.note}>
          Previsão: as faturas vieram {formatBRL(quality.meanAbs)} ({Math.round(quality.meanPct * 100)}%) diferentes do estimado, em média.
        </Text>
      )}
    </ScrollView>
  );
}

export function PontesScreen({ navigation }: NativeStackScreenProps<PlanoStackParamList, 'Pontes'>) {
  const { bridges } = useReadyData();
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.note}>Formas de cobrir uma falta de caixa, para comparar nas estratégias. Nada aqui é oferta de crédito.</Text>
      {bridges.length > 0 && (
        <Card>
          {bridges.map((b) => (
            <ListRow key={b.id} label={b.name} detail={bridgeLabel(b)} onPress={() => navigation.navigate('BridgeForm', { id: b.id })} hint="Editar opção" />
          ))}
        </Card>
      )}
      <Button title="+ Opção" accessibilityLabel="Adicionar opção de crédito ponte" kind="secondary" onPress={() => navigation.navigate('BridgeForm')} />
    </ScrollView>
  );
}

export function DadosScreen({ navigation }: NativeStackScreenProps<PlanoStackParamList, 'Dados'>) {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.body}>Seus dados ficam só neste aparelho. Nada é enviado para servidores.</Text>
      <Text style={styles.note}>O backup do sistema (iCloud ou Google), se estiver ligado, pode guardar uma cópia protegida pela sua conta.</Text>
      <DeleteAllData navigation={navigation} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12 },
  label: { fontSize: 13, color: COLORS.placeholder },
  body: { fontSize: 16, lineHeight: 22, color: COLORS.text },
  note: { fontSize: 13, lineHeight: 18, color: COLORS.placeholder },
});
