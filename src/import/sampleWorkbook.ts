// The import template, filled with dummy data (no real person's finances). The example .xlsx is
// generated from this (npm run sample:xlsx) and the import tests use it, so they cannot drift.

export type Cell = string | number | Date | null | undefined;
export type Sheets = Record<string, Cell[][]>;

export const SAMPLE_SHEETS: Sheets = {
  'Leia-me': [
    ['Modelo de planilha do Life Strategic Plan (dados fictícios)'],
    ['Preencha uma cópia com os seus valores. Valores em reais (1.234,56 ou 1234.56); meses como mm/aaaa; dias de 1 a 31.'],
    ['Abas lidas pelo app: Painel, Contas, Cartões, Parcelas, Hipoteca, Empréstimo, Financiamento, Cenários. Esta aba é ignorada.'],
    ['Na aba Painel, "Repete" aceita Mensal, Anual ou Única (para Única, o dia e o mês de Início formam a data).'],
    ['Na coluna "Cartão", escreva o banco e o apelido como na aba Cartões (ex.: Nubank Roxinho). Vazio = sai da conta.'],
  ],
  Painel: [
    ['Tipo', 'Nome', 'Valor', 'Dia', 'Repete', 'Início', 'Fim', 'Categoria', 'Cartão'],
    ['Entrada', 'Salário', 7500, 5, 'Mensal', '01/2026', '', '', ''],
    ['Entrada', 'Freela de design', 1200, 15, 'Mensal', '01/2026', '06/2027', '', ''],
    ['Entrada', '13º salário', 7500, 20, 'Anual', '12/2026', '', '', ''],
    ['Saída', 'Aluguel', 2300, 10, 'Mensal', '01/2026', '', 'Moradia', ''],
    ['Saída', 'Condomínio', 650, 10, 'Mensal', '01/2026', '', 'Moradia', ''],
    ['Saída', 'Escola', 1400, 8, 'Mensal', '02/2026', '12/2026', 'Outros', ''],
    ['Saída', 'Mercado', 1500, 20, 'Mensal', '01/2026', '', 'Alimentação', ''],
    ['Saída', 'Streaming', '55,90', 12, 'Mensal', '01/2026', '', 'Lazer', 'Nubank Roxinho'],
    ['Saída', 'IPVA', 1800, 15, 'Anual', '03/2027', '', 'Transporte', ''],
    ['Saída', 'Seguro do carro', 2400, 25, 'Única', '01/2027', '', 'Transporte', ''],
  ],
  Contas: [
    ['Banco', 'Tipo', 'Saldo'],
    ['Nubank', 'Conta corrente', 4200],
    ['Inter', 'Poupança', 8000],
  ],
  Cartões: [
    ['Banco', 'Apelido', 'Limite', 'Fechamento', 'Vencimento', 'Gasto médio'],
    ['Nubank', 'Roxinho', 9000, 5, 12, 900],
    ['Itaú', 'Platinum', 6000, 28, 7, 600],
  ],
  Parcelas: [
    ['Cartão', 'Mês', 'Valor'],
    ['Nubank Roxinho', '11/2026', 850],
    ['Nubank Roxinho', '12/2026', 850],
    ['Nubank Roxinho', '01/2027', 400],
    ['Itaú Platinum', '11/2026', 320],
    ['Itaú Platinum', '12/2026', 320],
  ],
  Hipoteca: [
    ['Nome', 'Saldo devedor', 'Juros a.m. (%)', 'Parcelas restantes', 'Sistema', 'Próxima parcela', 'Vencimento'],
    ['Apartamento', 280000, '0,85', 300, 'SAC', '12/2026', 10],
  ],
  Empréstimo: [
    ['Nome', 'Saldo devedor', 'Juros a.m. (%)', 'Parcelas restantes', 'Sistema', 'Próxima parcela', 'Vencimento'],
    ['Empréstimo pessoal', 6000, '2,9', 14, 'Price', '12/2026', 20],
  ],
  Financiamento: [
    ['Nome', 'Saldo devedor', 'Juros a.m. (%)', 'Parcelas restantes', 'Sistema', 'Próxima parcela', 'Vencimento'],
    ['Carro', 32000, '1,49', 36, 'Price', '12/2026', 15],
  ],
  Cenários: [
    ['Nome', 'Tipo', 'Valor', 'Parcelas', 'Cartão', 'Dia', 'Meses', 'Início'],
    ['Notebook novo', 'Compra parcelada', 4800, 10, 'Nubank Roxinho', '', '', ''],
    ['Academia', 'Assinatura', '129,90', '', '', 10, '', ''],
    ['Renda cai 20%', 'Renda cair', 20, '', '', '', 3, '01/2027'],
    ['Mercado mais caro', 'Custo de vida', 300, '', '', '', '', '01/2027'],
    ['Imprevisto com o carro', 'Imprevisto', 2500, '', '', 15, '', '02/2027'],
  ],
};
