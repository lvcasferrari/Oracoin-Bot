# Last mile: App Store com interações mínimas

## Problem Statement

O app só tem valor se os números estiverem em dia, mas hoje isso depende de o usuário **abrir o app e fazer manutenção**: atualizar saldos, confirmar faturas, registrar pagamentos e lançar gastos. Cada visita obrigatória é uma chance de abandono. Para quem é novo em orçamento (o público principal), "mais um app para alimentar" é o motivo nº 1 para desistir. Se isso não mudar, o app chega à App Store com bom motor e retenção baixa.

## Evidence

- O ciclo de manutenção hoje exige ir até a tela: Hoje → "Confirmar valor" da fatura, Bancos → "Atualizar saldos", Hoje → "Registrar pagamento" (`src/screens/upkeep/`, `src/screens/HojeScreen.tsx`). Nada avisa o usuário de que é hora de fazer isso.
- O onboarding tem 4 passos e uma meta de 3 minutos (`src/screens/onboarding/OnboardingScreen.tsx`); o app grava o tempo (`setOnboarded(..., seconds)`), mas não há dados de usuários reais.
- 5 abas (`src/navigation/RootTabs.tsx`): cada uma é uma decisão de navegação para quem só quer saber "o mês fecha?".
- Assumption: o abandono por excesso de manutenção é o padrão da categoria (apps de orçamento manual). **Precisa de validação** com um beta no TestFlight (ver Fase 6).
- Não há usuários, depoimentos nem benchmarks (PRODUCT.md, "Evidence on Hand").

## Proposed Solution

Inverter a direção: **o app vai até o usuário nos poucos momentos em que um dado muda**, e o resto é assumido e marcado "estimado". Notificações locais (sem servidor, mantendo a promessa "nada sai do aparelho") chegam no fechamento e no vencimento de cada cartão, com botões de resposta direto na notificação ("Veio R$ 1.240? Sim / Ajustar"; "Pagou? Sim"). O que o usuário não responde continua projetado e não bloqueia nada. Em paralelo, o onboarding fica com só o essencial para o primeiro Raio-X, a navegação encolhe e o app ganha o pacote mínimo exigido pela App Store. A alternativa (Open Finance para puxar dados sozinho) fica fora: contraria a promessa local-only e exige ser instituição autorizada.

## Key Hypothesis

We believe que confirmar faturas e pagamentos em 1 toque pela notificação, com o resto assumido como estimado, vai manter os números em dia sem exigir visitas ao app para usuários brasileiros que vivem no cartão.
We'll know we're right when, no beta, a maioria dos ciclos de fatura for confirmada pela notificação e a retenção de 30 dias (App Store Connect) ficar em pelo menos metade da de 7 dias.

## What We're NOT Building

- Open Finance / integração bancária - contraria "dados só no aparelho" e exige regulação BCB.
- Conta, login e sincronização em nuvem - sem conta, a App Store não exige exclusão de conta, e a promessa de privacidade fica simples.
- Telemetria própria (Sentry, SDK de analytics) - quebra a promessa local-only; usar o App Analytics da App Store Connect (opt-in pela Apple, sem SDK).
- Android na primeira publicação - mesma base, mas o last mile é iOS; Android vem depois.
- iPad - `supportsTablet: false` já está assim.
- Monetização no lançamento - TBD (ver Open Questions); lançar grátis evita revisão de compras in-app.

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Interações obrigatórias por mês, por cartão | ≤ 2 toques (confirmar fatura + confirmar pagamento), sem abrir o app | Contagem no fluxo desenhado; verificação manual no TestFlight |
| Onboarding concluído | ≥ 70% de quem começa | Entrevistas do beta (sem telemetria) |
| Tempo do onboarding | mediana ≤ 2 min | Valor que o app já grava localmente, informado pelos testadores (TBD: mostrar em Plano → Privacidade e dados) |
| Retenção D30 / D7 | ≥ 0,5 | App Store Connect → App Analytics (usuários que aceitaram compartilhar) |
| Sessões sem crash | ≥ 99,5% | App Store Connect / TestFlight |
| Aprovação na revisão da Apple | 1ª ou 2ª submissão | App Store Connect |

## Open Questions

- [ ] **Nome na loja:** "Life Strategic Plan" é inglês para um público pt-BR que inclui iniciantes. Manter ou usar um nome em português (até 30 caracteres) com subtítulo?
- [ ] **Conta de desenvolvedor:** individual ou empresa? A diretriz 5.1.1(ix) pede que apps de *serviços financeiros regulados* sejam publicados por pessoa jurídica. O app só simula e não oferece crédito, então provavelmente cabe em conta individual, mas é o principal risco de rejeição.
- [ ] **Preço:** grátis no lançamento? A monetização (spec 08) ainda está em aberto.
- [ ] **URLs de política de privacidade e de suporte:** obrigatórias. Onde hospedar (GitHub Pages, site próprio)?
- [ ] **Beta:** quantos testadores e por quanto tempo (sugestão: 8–15 pessoas, 2 ciclos de fatura ≈ 6 semanas)?
- [x] O motor já assume a fatura paga no vencimento quando o usuário não registra nada? **Sim:** sem linha salva, `invoiceFor` projeta a fatura inteira como saída no vencimento, marcada estimada.

---

## Users & Context

**Primary User**
- **Who**: adulto brasileiro, 25–45 anos, com 1–3 cartões e parcelas que comprometem os próximos meses, novo em orçamento ou cansado de planilha.
- **Current behavior**: olha o app do banco perto do vencimento, se assusta com a fatura, às vezes cai no rotativo.
- **Trigger**: a fatura fecha (o valor fica conhecido) e o vencimento se aproxima.
- **Success state**: sabe, sem abrir o app, se o mês fecha e qual é o dia crítico.

**Job to Be Done**
When a fatura do meu cartão fecha, I want to saber em um toque se o mês ainda fecha, so I can evitar o rotativo sem ter que alimentar um app.

**Non-Users**
Quem quer categorizar compra por compra (o app trabalha com totais de fatura), investidores buscando recomendação (vedado pelas diretrizes CVM/BCB do produto) e empresas/MEI com fluxo de caixa PJ.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Notificações locais no fechamento e no vencimento, com ações "Sim / Ajustar" e "Paguei" | Tira a manutenção de dentro do app; é a hipótese central |
| Must | Padrão assumido: fatura confirmada pelo estimado e paga no vencimento quando não há resposta, sempre marcada "estimado" | Sem resposta, o app continua útil e nunca bloqueia |
| Must | Onboarding mínimo: só renda + dia e cartões com a próxima fatura antes do Raio-X; parcelas e contas fixas viram cartões de "complete depois" em Hoje | Primeiro valor em ~1 minuto; o resto é pedido quando faz sentido |
| Must | Pacote App Store: ícone, splash, nome e subtítulo, screenshots 6,9", política de privacidade, URL de suporte, App Privacy "Data Not Collected", classificação etária, categoria Finanças, notas para a revisão | Bloqueia a publicação |
| Must | Pedido de permissão de notificação no momento certo (fim do Raio-X, com explicação), nunca na abertura | Pedido sem contexto é recusado e derruba a capacidade nº 1 |
| Should | Navegação com 3 abas (Hoje, Contas, Plano); Fluxo e "E se…?" acessados a partir de Hoje | Menos decisões; validar no beta antes de cortar |
| Should | Resumo semanal opcional (1 notificação: "Seu mês segue no azul, sobra R$ X") | Mantém o vínculo sem exigir ação |
| Should | Pedido de avaliação (`expo-store-review`) depois de um ciclo de fatura confirmado | Avaliações ajudam a descoberta; momento positivo |
| Could | Widget de tela inicial (margem do mês + próximo vencimento) | Zero interações; exige alvo nativo (WidgetKit), custo alto |
| Could | Importar extrato OFX/CSV | Reduz digitação inicial; já existe importação de planilha |
| Won't | Open Finance, login, telemetria própria | Ver "What We're NOT Building" |

### MVP Scope

Notificações de fechamento e vencimento com ações + padrão assumido + onboarding de 2 passos + pacote App Store. É o mínimo para testar a hipótese no TestFlight e já é publicável.

### User Flow

1. Instala → boas-vindas → renda e dia → cartões (vencimento + próxima fatura) → **Raio-X** (~1 min).
2. No fim do Raio-X: "Quer que eu te avise quando a fatura fechar? Assim você não precisa abrir o app." → permissão.
3. Dia do fechamento: notificação "Itaú fechou. Veio uns R$ 1.240?" → **Sim** (1 toque, sem abrir) ou **Ajustar** (abre direto no campo do valor).
4. Dia do vencimento: "Fatura Itaú vence hoje. Pagou?" → **Paguei** (1 toque).
5. Semanal (opcional): "Seu mês segue no azul." Nenhuma ação necessária.

---

## Technical Approach

**Feasibility**: HIGH para notificações, onboarding e pacote da loja; MEDIUM para o widget.

**Architecture Notes**
- `expo-notifications` com notificações **locais** agendadas a partir das datas do motor (`dueDate`, ciclo de fechamento em `src/engine/cycle.ts`) e reagendadas a cada `refresh()` do `AppData`. Categorias com ações (`setNotificationCategoryAsync`) permitem responder sem abrir o app; a resposta grava no SQLite pelos mesmos repositórios de `ConfirmInvoiceScreen`/`PayInvoiceScreen`.
- O padrão assumido fica no motor (uma regra, testada), não nas telas.
- Onboarding: `IncomeStep` e `CardsStep` ficam; `InstallmentsStep` e `FixedStep` viram cartões de "complete depois" em Hoje, reaproveitando os componentes atuais.
- Pacote da loja: `app.json` (`icon`, `splash`, `ios.infoPlist`), `eas build -p ios --profile production` e `eas submit` (`eas.json` já tem `production` com `autoIncrement` e versão remota). `PrivacyInfo.xcprivacy` já existe; `usesNonExemptEncryption: false` já está configurado.
- Novas dependências nativas (`expo-notifications`, `expo-store-review`) exigem um novo build, como aconteceu com `expo-blur`.

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Rejeição pela 5.1.1(ix) (serviço financeiro publicado por pessoa física) | M | Notas para a revisão: simulador, sem crédito, sem dados enviados; disclaimer visível; se rejeitar, publicar por PJ |
| Usuário nega a permissão de notificação | M | Pedir só depois do Raio-X, com o porquê; sem permissão, o app continua com os cartões de pendência em Hoje |
| Ação na notificação não grava com o app encerrado | M | Testar com o app encerrado; fallback: a ação abre o app direto na confirmação |
| Desfoque (`expo-blur`) pesado em iPhones antigos | L | Testar num aparelho antigo no TestFlight; fallback translúcido sem desfoque |
| Notificações demais viram ruído | M | No máximo 2 por cartão por mês + 1 semanal opcional; desligáveis em Plano |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Padrão assumido | Fatura confirmada pelo estimado e paga no vencimento quando não há resposta; pendências visíveis em Hoje | complete | with 4 | - | - |
| 2 | Notificações com ação | Fechamento e vencimento, ações Sim/Ajustar/Paguei, permissão após o Raio-X, ajustes em Plano | complete (falta teste em iPhone real) | with 3, 4 | 1 | - |
| 3 | Onboarding de 2 passos | Renda e cartões antes do Raio-X; parcelas e contas fixas como "complete depois" | complete | with 2, 4 | 1 | - |
| 4 | Pacote App Store | Ícone, splash, nome, screenshots, política de privacidade, suporte, App Privacy, notas para a revisão | pending | with 1, 2, 3 | - | - |
| 5 | Revisão final | `/code-review ultra`, auditoria de acessibilidade e estados de erro, teste em aparelho antigo | pending | - | 2, 3 | - |
| 6 | Beta TestFlight | 8–15 testadores por 2 ciclos de fatura; medir as métricas; decidir as 3 abas | pending | - | 4, 5 | - |
| 7 | Submissão | `eas build` de produção, `eas submit`, resposta à revisão | pending | - | 6 | - |

### Phase Details

**Phase 1: Padrão assumido**
- **Goal**: o app nunca precisa de uma visita para continuar certo o bastante.
- **Scope**: regra no motor + testes; marcador "estimado"; lista de pendências em Hoje.
- **Success signal**: um perfil sem nenhuma interação por 60 dias projeta sem erro e mostra tudo como estimado.

**Phase 2: Notificações com ação**
- **Goal**: manutenção em ≤ 2 toques por cartão por mês, fora do app.
- **Scope**: `expo-notifications`, agendamento a partir do motor, categorias com ações, ajustes em Plano, pedido de permissão contextual.
- **Success signal**: num iPhone real, "Sim" e "Paguei" gravam com o app encerrado e o Raio-X muda.

**Phase 3: Onboarding de 2 passos**
- **Goal**: primeiro Raio-X em ~1 minuto.
- **Scope**: reordenar os passos atuais; cartões de "complete depois" em Hoje.
- **Success signal**: percurso completo em ≤ 10 toques além da digitação dos valores.

**Phase 4: Pacote App Store**
- **Goal**: nada da loja bloqueia a submissão.
- **Scope**: assets, textos da ficha em pt-BR, política de privacidade e suporte publicados, App Privacy preenchido, notas para a revisão, versão `1.0.0`.
- **Success signal**: a App Store Connect não mostra pendências na versão.

**Phase 5: Revisão final**
- **Goal**: nenhum bug alto antes de testadores reais.
- **Scope**: `/code-review ultra` (disparado pelo usuário), `/impeccable audit` nativo, estados vazios e de erro, Dynamic Type.
- **Success signal**: zero achados CRITICAL/HIGH abertos.

**Phase 6: Beta TestFlight**
- **Goal**: validar a hipótese antes do público.
- **Scope**: convites, roteiro curto de feedback, 2 ciclos de fatura.
- **Success signal**: metas atingidas ou um ajuste decidido.

**Phase 7: Submissão**
- **Goal**: app publicado.
- **Scope**: build de produção, envio, resposta à revisão.
- **Success signal**: "Ready for Sale".

### Parallelism Notes

A Fase 4 é só assets, textos e configuração, então corre em paralelo com tudo desde já. As Fases 2 e 3 dependem da regra da Fase 1, mas não uma da outra. O beta só começa depois da revisão final, para não gastar testadores com bugs conhecidos.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Como reduzir a manutenção | Notificações locais com ação + padrão assumido | Open Finance; lembrete genérico diário | Mantém a promessa local-only; lembrete genérico vira ruído |
| Métricas sem telemetria | App Store Connect + entrevistas do beta | SDK de analytics | Telemetria própria quebraria "nada sai do aparelho" |
| Plataforma da 1ª publicação | Só iOS | iOS + Android juntos | Last mile menor; Android reaproveita quase tudo depois |
| Quando pedir notificação | Fim do Raio-X | Na abertura | Pedido com contexto e valor visível é mais aceito |

---

## Research Summary

**Market Context**
TBD - needs research: não houve pesquisa de concorrentes nesta rodada (Mobills, Organizze e similares no Brasil). A verificar: como lidam com manutenção manual versus Open Finance, e do que as avaliações na loja reclamam.

**Technical Context**
- Já pronto para a loja: `bundleIdentifier`, `usesNonExemptEncryption: false`, `PrivacyInfo.xcprivacy`, `eas.json` com `production`/`autoIncrement`, `projectId` do EAS, dados de exemplo só em desenvolvimento (`src/components/EmptyState.tsx`).
- Faltando: ícone, splash, URLs de privacidade e suporte, screenshots, ficha da loja, `expo-notifications`, `expo-store-review`.
- Versão atual `0.1.0`; a loja pede uma versão de lançamento (sugestão: `1.0.0`).

---

*Generated: 2026-11-05*
*Status: DRAFT - needs validation*
