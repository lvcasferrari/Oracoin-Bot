import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { criticalMonth, type ScenarioResult, type Verdict } from '../../engine';
import { Disclaimer } from '../../components/Disclaimer';
import { useAnnounce } from '../../components/form';
import { Card, Money, Pill } from '../../components/ui';
import { formatDateBR, shortMonth } from '../../lib/dateInput';
import { formatBRL } from '../../lib/money';
import { displayParam, PARAM_INFO } from '../../lib/paramInfo';

const VERDICT: Record<Verdict, { tone: 'ok' | 'warn' | 'risk'; label: string; line: string }> = {
  confortavel: { tone: 'ok', label: 'Confortável', line: 'Cabe no seu plano.' },
  atencao: { tone: 'warn', label: 'Atenção', line: 'Cabe, mas pede atenção.' },
  aperta: { tone: 'warn', label: 'Aperta o mês', line: 'Aperta o mês.' },
  risco: { tone: 'risk', label: 'Risco', line: 'Risco de faltar dinheiro.' },
};

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Result of an "E se…?" in spec 04 order: verdict, timeline, limit and savings, goals, three exits, assumptions. */
export function ScenarioResultCard({ result, actions }: { result: ScenarioResult; actions?: ReactNode }) {
  const v = VERDICT[result.verdict];
  const { extras } = result;
  // The verdict appears 150 ms after typing; screen readers hear it when it changes.
  useAnnounce(`${v.label}. ${extras.payPartial ? 'Pior caso: ainda muito caro, mas tem teto.' : v.line}`);
  const critical = criticalMonth(result.result.monthly);
  const before = result.baseline.critical;
  const after = result.result.critical;

  return (
    <Card>
      {/* 1. Verdict */}
      <Pill tone={v.tone}>{v.label}</Pill>
      <Text style={styles.headline}>{extras.payPartial ? 'Pior caso: ainda muito caro, mas tem teto.' : v.line}</Text>
      {extras.purchase && (
        <Text style={styles.body}>
          {extras.purchase.installments} parcelas de <Money value={extras.purchase.monthlyInstallment} /> a partir da fatura de {shortMonth(extras.purchase.firstMonth)}.
        </Text>
      )}
      {extras.payPartial && (
        <Text style={styles.body}>
          O restante de <Money value={extras.payPartial.unpaid} /> pode chegar a <Money value={extras.payPartial.totalPaid} /> no total
          {extras.payPartial.capped ? ', já limitado pelo teto legal' : ''}. Parcela de cerca de <Money value={extras.payPartial.monthlyPayment} />.
        </Text>
      )}
      {extras.debt && (
        <Text style={styles.body}>
          Parcela de <Money value={extras.debt.firstPayment} />
          {extras.debt.incomeShare !== null ? ` (${pct(extras.debt.incomeShare)} da renda)` : ''}. Juros até o fim: <Money value={extras.debt.totalInterest} />; total pago:{' '}
          <Money value={extras.debt.totalPaid} />.
        </Text>
      )}
      {extras.subscription && (
        <Text style={styles.body}>
          Liberdade mensal perdida: <Money value={extras.subscription.monthly} />
          {extras.subscription.shareOfMargin !== null ? ` (${pct(extras.subscription.shareOfMargin)} da sobra deste mês)` : ''}.
        </Text>
      )}
      {extras.incomeChange && (
        <Text style={styles.body}>
          {extras.incomeChange.firstNegativeMonth
            ? `O colchão aguenta ${extras.incomeChange.cushionMonths} ${extras.incomeChange.cushionMonths === 1 ? 'mês' : 'meses'}; o saldo fica negativo em ${shortMonth(extras.incomeChange.firstNegativeMonth)}.`
            : 'O saldo não fica negativo nos meses projetados.'}
        </Text>
      )}
      {extras.emergency && (
        <Text style={styles.body}>
          {extras.emergency.reserveMonths === null
            ? 'Sem despesas essenciais cadastradas para comparar.'
            : `Depois do imprevisto, o saldo cobre cerca de ${extras.emergency.reserveMonths.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} meses de despesas essenciais (estimado).`}
        </Text>
      )}

      {/* 2. Cash-flow timeline */}
      {before && after && (
        <Text style={styles.body}>
          Menor saldo previsto: <Money value={before.balance} /> hoje → <Money value={after.balance} style={after.balance < 0 ? styles.negative : undefined} /> com isso ({formatDateBR(after.date)}).
        </Text>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeline}>
        {result.result.monthly.map((m) => {
          const isCritical = critical?.month === m.month;
          return (
            <View
              key={m.month}
              style={[styles.month, isCritical && styles.monthCritical]}
              accessible
              accessibilityLabel={`${shortMonth(m.month)}: saldo no fim ${formatBRL(m.endBalance)}${isCritical ? ', mês mais crítico' : ''}`}
            >
              <Text style={styles.monthLabel}>{shortMonth(m.month)}</Text>
              <Money value={m.endBalance} style={[styles.monthValue, m.endBalance < 0 && styles.negative]} />
              {isCritical && <Text style={styles.criticalText}>mais crítico</Text>}
            </View>
          );
        })}
      </ScrollView>

      {/* 3. Limit and savings */}
      {result.limitImpact.map((l) => (
        <Text key={l.cardId} style={styles.body}>
          Limite disponível no {l.label}: <Money value={l.before.value} /> → <Money value={l.after.value} style={l.after.value < 0 ? styles.negative : undefined} /> (estimativa)
        </Text>
      ))}
      {result.savingsImpact !== 0 && (
        <Text style={styles.body}>
          Sobra para metas nos meses projetados: <Money value={result.savingsImpact} />
        </Text>
      )}

      {/* 4. Goals */}
      {result.goalDelays
        .filter((g) => g.delayMonths !== 0)
        .map((g) => (
          <Text key={g.goalId} style={styles.body}>
            {g.delayMonths === null
              ? `A meta "${g.name}" deixa de ser alcançada nos meses projetados.`
              : `A meta "${g.name}" ${g.delayMonths > 0 ? 'atrasa' : 'adianta'} ${Math.abs(g.delayMonths)} ${Math.abs(g.delayMonths) === 1 ? 'mês' : 'meses'}.`}
          </Text>
        ))}

      {/* 5. Three exits */}
      <Text style={styles.section} accessibilityRole="header">
        Três saídas
      </Text>
      {actions ?? <Text style={styles.hint}>Em breve: saídas com custo calculado.</Text>}

      {/* 6. Assumptions and uncertainty */}
      <Text style={styles.section} accessibilityRole="header">
        Premissas
      </Text>
      <Text style={styles.hint}>
        Menor saldo entre <Money value={result.uncertainty.low} /> e <Money value={result.uncertainty.high} />, conforme o gasto variável do cartão.
      </Text>
      {result.assumptions.map((a) => (
        <Text key={`${a.key}-${a.effectiveFrom}`} style={styles.hint}>
          {PARAM_INFO[a.key].label}: {displayParam(a.key, a.value)} ({a.source})
        </Text>
      ))}
      <Text style={styles.hint}>Dá para mudar as premissas em Plano.</Text>

      {/* 7. Disclaimer */}
      <Disclaimer />
    </Card>
  );
}

const styles = StyleSheet.create({
  headline: { fontSize: 19, fontWeight: '600' },
  body: { fontSize: 15 },
  section: { fontSize: 15, fontWeight: '600', marginTop: 8 },
  hint: { fontSize: 12, opacity: 0.7 },
  negative: { color: '#b3261e', fontWeight: '600' },
  timeline: { gap: 8, paddingVertical: 6 },
  month: { minWidth: 92, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: '#767676' },
  monthCritical: { borderColor: '#b3261e', borderWidth: 2 },
  monthLabel: { fontSize: 12, opacity: 0.7 },
  monthValue: { fontSize: 14, fontWeight: '600' },
  criticalText: { fontSize: 11, fontWeight: '600' },
});
