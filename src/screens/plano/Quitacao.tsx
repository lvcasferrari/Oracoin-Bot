import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { debtViews, monthlyCost, monthlySummary, param, strategyReserve } from '../../engine';
import { Disclaimer } from '../../components/Disclaimer';
import { Button, COLORS } from '../../components/form';
import { Card, Money, Pill } from '../../components/ui';
import { formatBRL } from '../../lib/money';
import type { PlanoStackParamList, TabParamList } from '../../navigation/types';
import { useReadyData } from '../../state/AppData';
import { debtWhy, pct, READING } from './quitacaoCopy';

export function QuitacaoScreen({ navigation }: NativeStackScreenProps<PlanoStackParamList, 'Quitacao'>) {
  const { profile, bridges, today } = useReadyData();
  const views = debtViews(profile, bridges, today);
  const rows = monthlySummary(profile, today);
  const costs = rows.map(monthlyCost);
  const next6 = costs.slice(0, 6);
  const informed = bridges.filter((b) => b.kind !== 'meta').map((b) => b.monthlyRate);
  const ctx = { bridgeRate: informed.length ? Math.min(...informed) : undefined, cashYield: param(profile.parameters, 'rendimento_caixa_mensal', today) };
  const reserve = strategyReserve(profile, today);
  const editDebt = (id?: string) =>
    navigation.getParent<BottomTabNavigationProp<TabParamList>>()?.navigate('Bancos', { screen: 'DebtForm', params: id ? { id } : undefined, initial: false });

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Card>
        <Text style={styles.label} accessibilityRole="header">
          Custo mensal
        </Text>
        <View style={styles.figures}>
          <View style={styles.figure}>
            <Text style={styles.meta}>Média de 6 meses</Text>
            <Money value={next6.reduce((s, c) => s + c, 0) / Math.max(1, next6.length)} style={styles.figureValue} />
          </View>
          <View style={styles.figure}>
            <Text style={styles.meta}>Fim da projeção</Text>
            <Money value={costs.at(-1) ?? 0} style={styles.figureValue} />
          </View>
        </View>
        <Text style={styles.meta}>Parcelas de dívidas e faturas, sem o gasto variável do cartão.</Text>
      </Card>

      <Card>
        <Text style={styles.label} accessibilityRole="header">
          Suas dívidas
        </Text>
        {views.length === 0 && <Text style={styles.body}>Nenhuma dívida em aberto. Cadastre financiamentos e empréstimos para ver quanto custa quitar cada um.</Text>}
        {views.map((v) => {
          const reading = v.reading ? READING[v.reading] : null;
          const amount = v.payoffAmount === null ? 'não permite quitar antes' : `quitar agora: ${formatBRL(v.payoffAmount)}${v.quoted ? ' (cotado)' : ' (estimado)'}`;
          return (
            <Pressable
              key={v.debt.id}
              onPress={() => editDebt(v.debt.id)}
              style={styles.debt}
              accessibilityRole="button"
              accessibilityLabel={`${v.debt.name}, ${amount}. ${reading ? `${reading.label}. ` : ''}${debtWhy(v, ctx)}`}
              accessibilityHint="Abre a dívida para informar ou mudar a cotação de quitação"
            >
              <View style={styles.head}>
                <Text style={styles.name}>{v.debt.name}</Text>
                {v.payoffAmount !== null && <Money value={v.payoffAmount} style={styles.strong} />}
              </View>
              <Text style={styles.meta}>
                {v.payoffAmount === null ? 'Não permite quitar antes' : v.quoted ? 'Valor cotado com o credor' : 'Estimado pelo saldo do contrato; toque para informar a cotação'}
              </Text>
              {reading && <Pill tone={reading.tone}>{reading.label}</Pill>}
              <Text style={styles.why}>{debtWhy(v, ctx)}</Text>
            </Pressable>
          );
        })}
        {views.length === 0 && <Button title="Cadastrar dívida" kind="secondary" onPress={() => editDebt()} />}
      </Card>

      <Text style={styles.note}>
        Reserva mínima: {formatBRL(reserve)}. Rendimento do caixa: {pct(ctx.cashYield)} ao mês. As duas são premissas editáveis em Plano.
        {ctx.bridgeRate === undefined ? ' Sem crédito ponte informado, a leitura compara só com o rendimento do caixa.' : ''}
      </Text>
      <Button title="Comparar estratégias" onPress={() => navigation.navigate('Estrategias')} />
      <Disclaimer />
    </ScrollView>
  );
}

// Secondary text uses COLORS.placeholder, not opacity (contrast holds on the grey cards).
const styles = StyleSheet.create({
  page: { padding: 16, gap: 12 },
  label: { fontSize: 13, color: COLORS.placeholder },
  body: { fontSize: 15, lineHeight: 21, color: COLORS.text },
  strong: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  figures: { flexDirection: 'row', gap: 16, marginVertical: 4 },
  figure: { flex: 1, gap: 2 },
  figureValue: { fontSize: 20, fontWeight: '600', fontVariant: ['tabular-nums'], color: COLORS.text },
  debt: { gap: 6, paddingVertical: 12, minHeight: 44, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  name: { flex: 1, fontSize: 16, fontWeight: '600', color: COLORS.text },
  meta: { fontSize: 13, color: COLORS.placeholder },
  why: { fontSize: 14, lineHeight: 20, color: COLORS.text },
  note: { fontSize: 13, lineHeight: 18, color: COLORS.placeholder },
});
