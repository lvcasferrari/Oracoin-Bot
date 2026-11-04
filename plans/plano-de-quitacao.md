---
title: Plano de quitação (módulo genérico)
date: 2026-11-04
tags: [quitacao, dividas, cenarios, refatoracao]
---

# Plano de quitação: do dashboard pessoal para um módulo do app

Up: [índice](INDEX.md)

Origem: o dashboard "Plano de Quitação & Replanejamento" (artefato privado, modelo v6) resolve um problema real com dados de uma pessoa, via planilha + script Python + dashboard. Esta nota transforma essa estrutura em um módulo do app que **qualquer usuário** pode usar com os próprios dados, sem script e sem planilha específica.

## 1. A pergunta que o módulo responde

"Qual dívida vale quitar, quando e com que dinheiro, considerando o custo de oportunidade e o risco de faltar caixa?"

**Métrica principal: custo mensal** (parcelas + faturas + parcelas de crédito novo), não "quitar tudo". Investimentos ficam de fora (guardrail CVM, [06](06-guardrails-legais-e-eticos.md)).

## 2. Lições do dashboard pessoal (o que generalizar)

| Lição | Consequência no app |
|---|---|
| A taxa do crédito que cobre o buraco pesa mais que a escolha de qual dívida quitar | Toda simulação mostra a **ponte** (como cobrir a falta de caixa) como alavanca de primeira classe |
| Falta de caixa vira crédito novo, com parcela, não juros acumulando | Motor modela **crédito ponte amortizado** (Price, prazo configurável) quando o saldo cai abaixo da **reserva mínima** |
| Desconto de quitação só faz sentido comparado a duas taxas | Cada dívida recebe o **retorno mensal de quitar** e é comparada ao **rendimento do caixa** e ao **custo do crédito** |
| O custo real de um empréstimo é a TIR das parcelas, não a taxa anunciada | Formulário calcula a **taxa efetiva a partir das parcelas** (com carência) |
| Cartões que a pessoa vai parar de usar mudam a previsão | Cartão ganha o campo **"continuo usando"** (sem gasto variável futuro; parcelas seguem) |
| Entradas extras (13º, PLR, FGTS, reembolsos) decidem meses críticos | Já cobertas por lançamentos "Uma vez"; ganham atalhos no onboarding |
| A planilha original tinha erros de soma | O app calcula tudo no motor; a importação **avisa** linhas ignoradas e nunca soma silenciosamente |
| Muitos cenários (288) confundem | O app mostra **3 a 5 estratégias ranqueadas**, não a grade completa |

## 3. Conceitos e fórmulas

Todas as taxas e limites são **parâmetros datados e editáveis, com fonte** (regra do app).

1. **Custo mensal (mês m)** = parcelas de dívidas + faturas **sem o gasto variável** (`MonthRow.debts + invoices − variable`).
   - KPIs: média dos próximos 6 meses e valor no fim do horizonte.
   - O consumo fica de fora do ranking, senão "gastar menos" vence sempre. A ponte entra como dívida, então já está em `debts`.
2. **Quitação no motor**:
   - `Debt.paidOffMonth` faz `monthEvents` parar as parcelas a partir desse mês.
   - A mudança `{type:'payoff', debtId, month, amount}` grava o `paidOffMonth` e uma saída única "Quitação: X" na primeira data livre. O commit grava as duas.
3. **Parcelas evitadas**: linhas `k ≥ monthDiff(startMonth, mês da quitação)+1` de `debtSchedule`, sem a parcela do mês se o vencimento já passou.
4. **Retorno mensal de quitar**:
   - **Com valor de quitação informado**: `r` tal que `valor = Σ parcela_k/(1+r)^k`. Calcular com `irr(fluxos)`, que devolve `null` se não houver troca de sinal.
   - **Com desconto anual informado**: `r = annualToMonthly(a)` (já existe), sem TIR; o valor de quitação é derivado.
   - Guardar só um dos dois, com `payoff_quoted_on`, porque as cotações vencem.
   - "Sem desconto, r = taxa" só vale quando o valor é igual ao saldo do cronograma.
5. **Leitura de cada dívida (rótulos neutros, sem mandar pegar crédito)**:
   - `r >` taxa da ponte mais barata **informada** (nunca a meta) → **"Custa mais que o crédito que você informou"**.
   - `r ≤` rendimento do caixa informado → **"Custa menos que o rendimento do seu caixa: deixar correr"**.
   - Entre os dois → **"Alívio, se sobrar caixa"**, só quando `menor saldo do horizonte − reserva ≥ valor de quitação`.
   - Sem ponte informada, só as duas últimas faixas.
6. **Reserva mínima** (`reserva_minima_months`, em meses de despesas essenciais). "Falta" = `reserva − menor saldo do mês`.
7. **Ponte**: `applyBridge(profile, bridge, reserva, today, makeId)` roda no fim de `applyChanges`.
   - Em loop: encontra o primeiro mês com falta, adiciona uma entrada única "Crédito ponte" e uma `Debt` Price com a taxa e o prazo da ponte.
   - No máximo uma retirada por mês, e até `projection_months` iterações.
   - Vira linhas comuns, então resumo, dia crítico e commit funcionam sem mudança.
8. **Tipos de ponte**:
   - **Empréstimo informado**: taxa efetiva pela TIR de `[−valor líquido liberado (após IOF/TAC), 0 × carência, parcela × n]`.
   - **Meta**: rotulada "Se você conseguir X% a.m. (meta, não oferta)". Nunca fica em 1º no ranking e nunca alimenta a leitura do item 5.
   - **Parcelar fatura**: **não** é empréstimo Price. Gera a mudança `payPartial` já existente na fatura do mês da falta (rotativo + teto 2x) e cobre no máximo o valor dessa fatura.

## 4. Estratégias (no lugar dos 288 cenários)

- **Alavancas**: "quitar dívida X" para cada dívida marcada como quitável (máx. 4 alavancas, 16 combinações), mais a ponte (3 opções) e o gasto variável (base ou reduzido).
- **Avaliação**: `exploreStrategies` usa `applyChanges` + `monthlySummary` uma vez por combinação, e o `evaluate` completo só nas 3 a 5 melhores. Sem falta de caixa, as pontes viram uma só. Memoizar `debtSchedule` por dívida. Teste: 96 combinações em menos de 1 s no cenário de 30 lançamentos.
- **Saída**: as 3 a 5 melhores pelo critério escolhido:
  - menor custo mensal médio;
  - menor custo no fim do horizonte;
  - menos crédito novo.
  Cada uma vem com o "porquê" e o roteiro mês a mês (o que pagar, quando, com que dinheiro).
- **Guardrail**: o aviso fixo diz "não é recomendação de investimento nem de crédito"; o app nunca indica instituição nem oferta crédito. Só compara opções que a própria pessoa informou, com taxas editáveis e fonte visível ([06](06-guardrails-legais-e-eticos.md) regra 2).

## 5. Telas

1. **Plano › Quitação**:
   - tabela de dívidas com retorno de quitar, classificação (Quitar, Alívio, Deixar correr) e o "porquê";
   - botão "Comparar estratégias".
2. **Estratégias**:
   - 3 a 5 cards com custo mensal médio, custo no fim, crédito novo e juros;
   - gráfico de custo mensal por estratégia;
   - "Seguir com isso" grava quitações e ponte como lançamentos (mecanismo `commitScenario` já existe).
3. **Roteiro**: calendário do que pagar/quitar por mês (reaproveita `DueCalendar`).
4. **Histórico (realizado)**: meses passados com o que foi pago (status "pago" de faturas e lançamentos) contra o previsto. É o equivalente do "verde = pago" da planilha.

## 6. Dados novos (migração v3, aditiva)

| Tabela/campo | Para quê |
|---|---|
| `debts.paid_off_month TEXT` | Parcelas param a partir da quitação |
| `debts.payoff_amount_cents`, `debts.payoff_discount_annual` (`CHECK`: no máximo um), `debts.payoff_quoted_on` | Cotação de quitação |
| `debts.payoffable INTEGER NOT NULL DEFAULT 1` | Se entra como alavanca |
| `bridges` (`id`, `name`, `kind CHECK IN ('emprestimo','meta','parcelar_fatura')`, `monthly_rate`, `months`, `effective_from`, `source`) | Opções de ponte, datadas e com fonte |
| parâmetros `reserva_minima_months`, `rendimento_caixa_mensal` | Em `PARAM_KEYS`, seeds v3, `DEFAULT_PARAMETERS` e `paramInfo` |
| `payments` (`ref_type`, `ref_id`, `month`, `paid_on`, `amount_cents`) | Histórico pago × previsto de lançamentos e parcelas (Q6) |

"Continuo usando" um cartão = gasto variável 0. Não precisa de coluna nova.

Importação: a planilha-modelo ganha as colunas "Valor para quitar", "Desconto (% a.a.)" e "Cotado em" nas abas de dívida, e a aba "Pontes" (Nome, Tipo, Juros a.m., Prazo, Fonte).

## 7. Refatorar ou refazer?

**Refatorar.** O motor, o banco, a importação e as telas já cobrem cerca de 80% do necessário:
- dívidas Price/SAC;
- pior caso da fatura com teto;
- cenários atômicos com commit;
- parâmetros datados;
- metas;
- importação de planilha com avisos.

Refazer descartaria 230 testes e as correções de revisão. O que muda é localizado:
- motor: `irr`, `payoffReturn`, `classifyDebt`, ponte com reserva mínima e `exploreStrategies`;
- dados: migração v3;
- telas: Quitação, Estratégias e Histórico.

## 8. Passos (cada um um PR)

| # | Passo | Depende |
|---|---|---|
| Q1 | Motor: `irr`, `effectiveLoanRate`, `paidOffMonth` + mudança `payoff`, `payoffReturn`, leitura por faixas (quitacao.ts) | — |
| Q2 | Motor: tipo `Bridge`, parâmetros, `applyBridge`, `MonthRow.variable` e custo mensal | — |
| Q3a | Migração v3 + mapeadores + tipos | Q1, Q2 |
| Q3b | Formulários: cotação de quitação, pontes | Q3a |
| Q4 | Motor: `exploreStrategies` + memo + teste de desempenho | Q1, Q2 |
| Q5 | Telas Quitação, Estratégias e Roteiro + commit | Q3b, Q4 |
| Q6 | Histórico pago × previsto (tabela `payments`) | Q3a |
| Q7 | Importação: colunas de quitação e aba Pontes; planilha-exemplo regenerada | Q3a |

Maior risco: entregar a quitação sem `paidOffMonth` e sem a saída única faria quitações gravadas continuarem projetando parcelas.

## 9. Fora de escopo

Investimentos como fonte de quitação (CVM), indicação de bancos ou ofertas, leitura automática de cor de célula ("verde = pago"; a pessoa marca "pago" no app ou numa coluna Status), dashboard web.

Related: [05 Motor financeiro](05-motor-financeiro.md), [04 Simulador](04-simulador-e-catalogo-de-acoes.md), [06 Guardrails](06-guardrails-legais-e-eticos.md), [10 Em aberto](10-em-aberto-e-proximos-passos.md)
