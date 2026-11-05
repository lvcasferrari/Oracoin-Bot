import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { availableLimit, cents, debtPayment, invoiceFor, monthDiff, monthOf, type Debt } from '../engine';
import { Button } from '../components/form';
import { Card, formatBRL, Meter, Money } from '../components/ui';
import { formatDateBR, shortMonth } from '../lib/dateInput';
import type { BancosStackParamList } from '../navigation/types';
import { useReadyData } from '../state/AppData';

const KIND_LABEL = { corrente: 'Conta corrente', poupanca: 'Poupança', carteira: 'Carteira' } as const;

function debtStatus(debt: Debt, month: string): { next: number; left: number } | null {
  const k = Math.max(1, monthDiff(debt.startMonth, month) + 1);
  if (k > debt.months) return null;
  return { next: debtPayment(debt, k), left: debt.months - k + 1 };
}

export function BancosScreen({ navigation }: NativeStackScreenProps<BancosStackParamList, 'BancosHome'>) {
  const { profile, meta, today } = useReadyData();
  const month = monthOf(today);
  const banks = [...new Set([...profile.accounts.map((a) => a.bank), ...profile.cards.map((c) => c.bank)])].sort();

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.actions}>
        <Button title="Atualizar saldos" onPress={() => navigation.navigate('Balances')} />
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button title="+ Conta" accessibilityLabel="Adicionar conta" kind="secondary" onPress={() => navigation.navigate('AccountForm')} />
          </View>
          <View style={styles.flex}>
            <Button title="+ Cartão" accessibilityLabel="Adicionar cartão" kind="secondary" onPress={() => navigation.navigate('CardForm')} />
          </View>
          <View style={styles.flex}>
            <Button title="+ Dívida" accessibilityLabel="Adicionar dívida" kind="secondary" onPress={() => navigation.navigate('DebtForm')} />
          </View>
        </View>
        {profile.accounts.length > 0 && <Text style={styles.hint}>Saldos informados em {formatDateBR(meta.balanceDate)}.</Text>}
      </View>

      {banks.map((bank) => {
        const cards = profile.cards.filter((c) => c.bank === bank);
        const accounts = profile.accounts.filter((a) => a.bank === bank);
        const dueThisMonth = cents(cards.reduce((s, c) => s + invoiceFor(profile, c, month, today).cashOut, 0));
        return (
          <Card key={bank}>
            <Text style={styles.bank} accessibilityRole="header">
              {bank}
            </Text>
            {cards.length > 1 && (
              <Text style={styles.body}>
                Vence em {shortMonth(month)}: <Money value={dueThisMonth} />
              </Text>
            )}
            {accounts.map((a) => (
              <Pressable key={a.id} style={styles.item} onPress={() => navigation.navigate('AccountForm', { id: a.id })} accessibilityRole="button" accessibilityHint="Editar conta">
                <Text style={styles.flex}>{KIND_LABEL[a.kind]}</Text>
                <Money value={a.balance} style={styles.strong} />
              </Pressable>
            ))}
            {cards.map((c) => {
              const invoice = invoiceFor(profile, c, month, today);
              const limit = availableLimit(profile, c, today);
              const future = cents(profile.installments.filter((i) => i.cardId === c.id && i.dueMonth > month).reduce((s, i) => s + i.amount, 0));
              return (
                <View key={c.id} style={styles.cardBox}>
                  <Pressable onPress={() => navigation.navigate('CardForm', { id: c.id })} accessibilityRole="button" accessibilityHint="Editar cartão">
                    <View style={styles.item}>
                      <Text style={[styles.strong, styles.flex]}>{c.name}</Text>
                      <Money value={invoice.total} style={styles.strong} />
                    </View>
                    <Text style={styles.meta}>
                      Fatura {shortMonth(month)} {invoice.estimated ? 'estimada' : 'confirmada'} · vence dia {c.dueDay}
                    </Text>
                    <Meter used={cents(c.limit - limit.value)} total={c.limit} label={`Limite usado · livre ${formatBRL(limit.value)}${limit.estimated ? ' (estimado)' : ''}`} />
                  </Pressable>
                  <View style={styles.links}>
                    <Pressable style={styles.linkBox} onPress={() => navigation.navigate('InstallmentsForm', { cardId: c.id })} accessibilityRole="button">
                      <Text style={styles.link}>Parcelas{future > 0 ? ` · ${formatBRL(future)}` : ''}</Text>
                    </Pressable>
                    {invoice.row?.status !== 'paga' && (
                      <Pressable style={styles.linkBox} onPress={() => navigation.navigate('PayInvoice', { cardId: c.id, dueMonth: month })} accessibilityRole="button">
                        <Text style={styles.link}>Registrar pagamento</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </Card>
        );
      })}

      {profile.debts.length > 0 && (
        <Card>
          <Text style={styles.bank} accessibilityRole="header">
            Dívidas e financiamentos
          </Text>
          {profile.debts.map((d) => {
            const status = debtStatus(d, month);
            return (
              <Pressable key={d.id} style={styles.item} onPress={() => navigation.navigate('DebtForm', { id: d.id })} accessibilityRole="button" accessibilityHint="Editar dívida">
                <View style={styles.flex}>
                  <Text style={styles.strong}>{d.name}</Text>
                  <Text style={styles.meta}>{status ? `faltam ${status.left} parcelas · vence dia ${d.dueDay}` : 'quitada'}</Text>
                </View>
                {status && <Money value={status.next} style={styles.strong} />}
              </Pressable>
            );
          })}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12 },
  actions: { gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  hint: { fontSize: 13, color: '#a3b1ac' },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20 },
  linkBox: { minHeight: 44, justifyContent: 'center' },
  link: { fontSize: 15, fontWeight: '600', color: '#7ee2b4' },
  bank: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 15 },
  meta: { fontSize: 13, color: '#a3b1ac' },
  strong: { fontSize: 16, fontWeight: '600' },
  item: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 8 },
  cardBox: { gap: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#8884' },
});
