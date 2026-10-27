# Blueprint: Life Strategic Plan, MVP completion

Objective: take the working Expo SDK 58 shell (engine + five tabs on sample data) to the MVP defined in the spec:
- real local data;
- a 3-minute onboarding;
- a repository the user maintains in seconds;
- the cash-flow views (monthly, daily, due-date calendar);
- the full "E se…?" simulator set;
- the "fatura maior que a renda" worst case with the 2x cap;
- goals with calculated delay;
- the health score and editable parameters;
- the action catalog;
- spreadsheet import.

Spec (source of truth for product rules): `~/Library/CloudStorage/OneDrive-Personal/Obsidian/Life Strategic Plan/` (`INDEX.md` → notes 01 to 10). "Spec 05" means note 05.

Created 2026-10-26. Revision 2, after the adversarial review (see the mutation log). Status: waiting on your approval.

## Current state (verified 2026-10-26)

- Branch `feat/life-strategic-plan-app`, commit `49d3e45`. Expo 58, React Native 0.88, React 19.3, React Navigation 7, TypeScript 6, Vitest 2.1.4 on Node 26. `expo-doctor` passes 20/20. Runs in Expo Go.
- `src/engine/` is pure TypeScript:
  - `engine.ts`: dates, `invoiceAmount`, `buildEvents`, `cashProjection`, `criticalDay`, `freeMargin`, `commitmentRatio`;
  - `simulator.ts`: `simulatePurchase`, `verdictFor`;
  - 15 Vitest tests.
- `src/screens/*` read `sampleProfile` (`src/data/sample.ts`) and hard-code dates: `TODAY` in Hoje, Fluxo, Bancos and Plano; `FIRST_MONTH` and `'2026-11-01'` in `SimuladorScreen.tsx:7,25`; `MONTH` in `PlanoScreen.tsx:6`.
- There is no persistence, no forms and no navigation beyond the tabs. The `gh` CLI is not installed: use local branches, and you push.

Verified tooling facts (smoke-tested 2026-10-26):
- `expo-sqlite@58.0.14` exports `openDatabaseAsync`, `execAsync`, `runAsync`, `getAllAsync`, `getFirstAsync`, `withTransactionAsync` and `withExclusiveTransactionAsync`.
- `@react-navigation/native-stack@7.21.0` peers on `@react-navigation/native ^7.5.1`.
- Under Vitest 2.1.4, `import 'node:sqlite'` fails ("Failed to load url sqlite"). `createRequire(import.meta.url)('node:sqlite')` works, including FK cascade, manual `BEGIN/COMMIT/ROLLBACK` and `PRAGMA user_version`.

## How to run this plan

**Default: one step at a time, in order 01 → 14, in the main checkout.** That is the safe choice for a single agent or a non-programmer operator.

Per step:

```bash
cd /Users/lvcasferrari/Projects/Oracoin-Bot
git checkout feat/life-strategic-plan-app
git checkout -b step/NN-slug
# implement, then:
npm test && npm run typecheck && npx expo-doctor
git add -A && git commit -m "Step NN: <title>"
git checkout feat/life-strategic-plan-app && git merge --no-ff step/NN-slug
```

**Optional parallel run** (only for the sets in the parallel table below; never for steps that share files). Each parallel step gets its own worktree, install and Metro port:

```bash
git worktree add ../lsp-NN -b step/NN-slug feat/life-strategic-plan-app
cd ../lsp-NN && npm ci
# bundle check uses port $((8081 + NN)) instead of 8081
# after merge: git worktree remove ../lsp-NN
```

Merge parallel steps one at a time. After each merge, rerun `npm test && npm run typecheck` on `feat/life-strategic-plan-app` before merging the next. A migration added by a step takes version `max(existing) + 1` **at merge time**, not when the branch was cut (see invariant 10).

Bundle check (after every UI step; `PORT` is 8081 in the main checkout):

```bash
PORT=8081
lsof -ti tcp:$PORT | xargs kill -9 2>/dev/null
(npx expo start --offline --port $PORT > /tmp/expo-$PORT.log 2>&1 &); sleep 45
for p in ios android; do curl -s "http://localhost:$PORT/node_modules/expo/AppEntry.bundle?platform=$p&dev=true&minify=false" -o /dev/null -w "$p %{http_code}\n"; done
lsof -ti tcp:$PORT | xargs kill -9 2>/dev/null
```

Both lines must print `200`. You do the final check by eye in Expo Go; no agent can.

Rollback for any step: `git revert -m 1 <merge-commit>` on `feat/life-strategic-plan-app`. Migrations are append-only and additive, so reverted code still reads the DB. If a dev device ends up with a DB that is newer than the reverted code, clear Expo Go's data for the app.

## Invariants (checked after every step; a step that breaks one is not done)

1. `npm test`, `npm run typecheck` and `npx expo-doctor` all pass.
2. Engine purity: `grep -rE "from '(react|react-native|expo|\.\./db)" src/engine` prints nothing.
3. No rate, cap, threshold or deadline is a literal in engine logic. It comes from `param(params, key, today)` (spec 06 rule 6). Contract rates the user types (a debt's `monthlyRate`) are data, not parameters. Test fixtures may use literals.
4. Every screen showing a simulation or projection renders `<Disclaimer />`. Its text is the constant `DISCLAIMER` in `src/lib/copy.ts`, and a test asserts it equals spec 06 rule 3: "Simulação ilustrativa baseada nos dados que você informou. Não é recomendação de investimento nem de crédito."
5. Risk is never shown by colour alone: `Pill` always has text (spec 07).
6. Money is INTEGER cents in SQLite, converted only in `src/db/mappers.ts`. The engine works in reais rounded with `cents()`.
7. "Today" is `todayLocal()`, never `toISOString()`. From step 05 on, `grep -rnE "TODAY|FIRST_MONTH|sampleProfile|'20[0-9]{2}-[0-9]{2}" src/screens src/components src/navigation` prints nothing.
8. Every number the user did not confirm is labelled "estimado" (spec 01 principle 7).
9. Copy guardrail: `grep -rniE "gastou demais|irrespons|culpa|contrate|pré-aprovado|pre-aprovado|invista|aplique|CDB|empréstimo na hora" src --include=*.ts --include=*.tsx --exclude=*.test.ts` prints nothing. The list lives in `src/lib/copy.test.ts`.
10. Migrations are append-only. Versions are exactly `1..N`, with no gaps or duplicates (a test asserts this). A shipped migration is never edited. A new parameter key, or a changed default, ships as a migration that inserts a dated row.

## Steps at a glance

| # | Step | Depends on | Tier |
|---|---|---|---|
| 01 | Engine model v2, parameters, card cycle | none | strongest |
| 02 | Debt engine (Price, SAC) | 01 | default |
| 03 | Rotativo worst case with the 2x cap | 01, 02 | strongest |
| 04 | SQLite layer: driver, schema v1, repositories | 01 | strongest |
| 05 | App data provider, screens on real data, empty states | 04 | default |
| 06 | Navigation stacks and repository forms (incl. debts) | 05 | default |
| 07 | Fluxo views: monthly, daily, due-date calendar | 06 | default |
| 08 | Monthly upkeep: confirm invoice, mark paid | 03, 06 | default |
| 09 | Onboarding and the Raio-X | 06, 07 | default |
| 10 | Plano: goals, health score, parameters, delete my data | 03, 06 | default |
| 11 | Scenario engine and commit | 03, 07, 10 | strongest |
| 12 | Simulator UI (8 types) | 06, 11 | default |
| 13 | Action catalog (5 actions) | 08, 12 | strongest |
| 14 | Spreadsheet import (**blocked: sample .xlsx needed**) | 06 | default |

Running them in numeric order satisfies every dependency.

Parallel sets (optional, with worktrees). Each set starts only after all its dependencies are merged:

| Set | Steps | Files each step owns (no overlap except appended lines in `src/engine/index.ts`) |
|---|---|---|
| A | 02 ∥ 04 | 02: `src/engine/debt.ts`, debt part of `src/engine/events.ts`. 04: `src/db/**`, `package.json` (expo-sqlite) |
| B | 03 ∥ 05 | 03: `src/engine/rotativo.ts`, the partial-invoice rule in `events.ts`. 05: `src/state/**`, `src/lib/copy.ts`, `src/components/Disclaimer.tsx`, `App.tsx`, `src/screens/*` |
| C | 07 ∥ 08 ∥ 10 | 07: `FluxoScreen`, `FluxoStack`, `src/components/DueCalendar.tsx`, `src/engine/summary.ts`. 08: `HojeScreen`, `HojeStack`, `src/engine/upkeep.ts`, `src/db/repos/invoices.ts`. 10: `PlanoScreen`, `PlanoStack`, `src/engine/goals.ts`, `src/engine/score.ts`, `src/db/repos/{goals,parameters,scoreHistory}.ts` |

The rule that makes set C safe is set by step 06: one navigation file per tab, and one repository file per entity. A step outside its set is serial.

---

## Step 01: Engine model v2, parameters, card cycle

Tier: strongest. Depends on: none. Branch: `step/01-engine-model`.

**Context brief.** The engine (`src/engine/`) is the only place numbers are calculated (spec 01 principle 4). This step:
- defines every type that later steps use, so no later step edits `types.ts` except to append;
- adds dated parameters;
- fixes three money semantics: when invoices hit cash, how paid and partial invoices behave, and which invoice a charge lands in.

It touches no UI and no DB.

**Tasks**

1. Split `engine.ts` into `dates.ts`, `params.ts`, `cycle.ts`, `events.ts` and `metrics.ts`. Keep `simulator.ts`. Add `index.ts` re-exporting the public API. Delete the stray `export { monthOf }` from `simulator.ts`.

2. Types (`types.ts`). Field names are fixed; later steps rely on them. Money is in reais. Dates are `YYYY-MM-DD`, months are `YYYY-MM`, and `endMonth` is inclusive.

   ```ts
   type ParamKey = /* every key in task 3 */;
   interface Parameter { key: ParamKey; value: number; effectiveFrom: string; source: string; note?: string }
   type Category = 'moradia' | 'alimentacao' | 'transporte' | 'lazer' | 'dividas' | 'outros';
   interface Account { id: string; bank: string; kind: 'corrente' | 'poupanca' | 'carteira'; balance: number }
   interface Card { id: string; bank: string; name: string; closingDay: number; dueDay: number; limit: number;
     variableEstimate: number; availableInformed?: number }
   interface Entry { id: string; kind: 'in' | 'out'; name: string; amount: number; day: number;
     recurrence: 'once' | 'monthly' | 'yearly'; startMonth: string; endMonth?: string; date?: string /* once */;
     accountId?: string; cardId?: string /* only for kind 'out': charged on the card, paid via its invoice */;
     category?: Category }
   interface Installment { id: string; cardId: string; dueMonth: string; amount: number }
   interface Invoice { id: string; cardId: string; dueMonth: string; amount: number;
     origin: 'estimada' | 'confirmada'; // 'estimada' = a value the user typed before closing (e.g. onboarding)
     status: 'fechada' | 'paga' | 'parcial'; paidAmount?: number; partialPlanMonths?: number;
     estimatedAtConfirm?: number }
   interface Debt { id: string; name: string; kind: 'financiamento' | 'emprestimo' | 'hipoteca' | 'pix_credito';
     principal: number /* current outstanding balance */; monthlyRate: number; months: number /* remaining */;
     system: 'price' | 'sac'; startMonth: string /* next payment month */; dueDay: number }
   interface Goal { id: string; name: string; target: number; saved: number; deadline?: string; priority: number }
   type ScenarioChange =
     | { type: 'purchase'; cardId: string; total: number; installments: number; date?: string; interestMonthly?: number }
     | { type: 'debt'; debt: Omit<Debt, 'id'>; downPayment: number; incomeStressPct?: number }
     | { type: 'subscription'; amount: number; day: number; cardId?: string }
     | { type: 'incomeChange'; deltaPct?: number; deltaAmount?: number; months: number; startMonth: string }
     | { type: 'costChange'; amount: number; category?: Category; startMonth: string }
     | { type: 'emergency'; amount: number; date: string }
     | { type: 'payPartial'; cardId: string; dueMonth: string; payNow: number; months: number };
   interface Scenario { id: string; name: string; changes: ScenarioChange[] }
   interface Profile { accounts: Account[]; balanceDate: string; entries: Entry[]; cards: Card[];
     installments: Installment[]; invoices: Invoice[]; debts: Debt[]; goals: Goal[]; parameters: Parameter[] }
   interface CashEvent { date: string; amount: number; label: string; source: 'entry' | 'invoice' | 'debt';
     refId: string; estimated: boolean }
   ```

   `balanceDate` is one date shared by all accounts. Mark it in code: `// shortcut: one balance date for all accounts; per-account dates when accounts are updated separately (V1)`. The step 06 "Atualizar saldos" screen updates all balances together.

3. Parameters (`params.ts`):
   - `param(params, key, onDate)` returns the value of the row with the latest `effectiveFrom <= onDate`. It throws `MissingParameterError(key)` when there is none, and never defaults silently. Callers pass `today`, not event dates.
   - `annualToMonthly(a) = (1 + a) ** (1 / 12) - 1`.
   - `DEFAULT_PARAMETERS: Parameter[]` (all with `effectiveFrom` `2026-10-26` unless stated otherwise):

   | key | value | source |
   |---|---|---|
   | `rotativo_monthly_rate` | 0.1518 | BCB ago/2026: 444,9% a.a. convertido para a.m. (effectiveFrom 2026-08-01) |
   | `parcelado_fatura_monthly_rate` | 0.0934 | BCB ago/2026: 192,1% a.a. convertido para a.m. (effectiveFrom 2026-08-01) |
   | `encargos_cap_ratio` | 1.0 | Lei 14.690/2023, Res. CMN 5.112; texto a confirmar (effectiveFrom 2024-01-03) |
   | `partial_plan_default_months` | 12 | suposição do app |
   | `projection_months` | 18 | spec 05 |
   | `commitment_band_yellow` / `_orange` / `_red` | 0.2 / 0.3 / 0.5 | referência do app (spec 05) |
   | `verdict_tight_income_share` / `verdict_attention_income_share` | 0.1 / 0.25 | referência do app |
   | `verdict_limit_tight` / `verdict_limit_attention` | 0.7 / 0.4 | referência do app |
   | `reserve_target_months` | 6 | referência do app |
   | `score_weight_controle` / `_colchao` / `_metas` / `_liberdade` | 0.25 each | referência do app |
   | `controle_full_margin_share` | 0.2 | referência do app |
   | `rotativo_lookback_months` | 3 | referência do app |
   | `variable_estimate_uncertainty` | 0.2 | suposição do app |
   | `purchase_on_closing_day_next_invoice` | 1 | sem fonte citável; editável (0 or 1) |

4. Card cycle (`cycle.ts`):
   - `dueDate(card, dueMonth) = dateInMonth(dueMonth, card.dueDay)`.
   - `closingDate(card, dueMonth)`: when `closingDay < dueDay`, it is `dateInMonth(dueMonth, closingDay)`. Otherwise it is `dateInMonth(addMonths(dueMonth, -1), closingDay)`. Days are clamped to the month length.
   - `invoiceMonthForCharge(card, date, params, today)` returns the earliest `dueMonth` (try the month of `date`, then +1, then +2) whose `closingDate` is strictly after `date` when `purchase_on_closing_day_next_invoice` is 1, or on or after `date` when it is 0.

5. Events (`events.ts`):
   - `monthEvents(profile, month, today)` returns all events of `month` with no anchor filter:
     - **Entries without `cardId`:** `monthly` when `startMonth ≤ month ≤ endMonth`; `yearly` when also the calendar month equals that of `startMonth`; `once` when `date` falls in `month`. The sign follows `kind`, on `dateInMonth(month, day)`, or on `date` for `once`.
     - **Entries with `cardId`** are not cash events. They add to that card's invoice for `invoiceMonthForCharge(card, chargeDate)`. Throw if `kind` is `'in'`.
     - **One invoice event per card**, on `dueDate(card, month)`:
       - The amount is the stored `Invoice` amount when a row exists for (`cardId`, `month`), with `estimated = origin !== 'confirmada'`.
       - Otherwise it is the projection, `estimated = true`. The projection is the installments due in `month` + `variableEstimate` + the card entries mapped to `month` + partial-plan payments mapped to `month` (bullet below).
       - A `paga` or `fechada` row produces `-amount`. Paid status changes the label, not inclusion: the cash anchor (next function) decides whether the money already left.
       - A `parcial` row produces `-paidAmount` on its due date. Its remainder `amount - paidAmount` is added to the next month's projected invoice of the same card. Mark that line `// replaced in step 03 by the worst-case plan`. It only adds to **projected** invoices, since a stored invoice already contains what the bank charged.
     - **Debts:** payment `k` on `dateInMonth(month, dueDay)` for months `startMonth..startMonth+months-1`. Until step 02, the payment comes from `debtPayment(debt, k)`, which throws `Error('debt engine: step 02')`. All step 01 fixtures use `debts: []`.
   - `buildEvents(profile, today)` concatenates `monthEvents` from `monthOf(balanceDate)` through `addMonths(monthOf(today), projection_months - 1)`, and keeps only events with `date > balanceDate`. Events on or before `balanceDate` are already in the balance.
     - Sort by date. On the same date, outflows come before inflows, which makes the critical day conservative.
   - `profileBalance(profile)` is the sum of account balances. `cashProjection(profile, today)` and `criticalDay(profile, today)` start from it.

6. Metrics (`metrics.ts`):
   - `netIncome(profile, month, today)`: the sum of positive `monthEvents`.
   - `payday(profile)`: the day of the largest monthly `in` entry, the earliest on a tie, or `null`.
   - `freeMargin(profile, month, today)`: the sum of all `monthEvents` amounts (income − outflows − invoices − debts; spec 05). The old `savingsGoal` argument is removed, because goals are handled in step 10.
   - `commitmentRatio(profile, month, today)`: `(invoices + debts in month) / netIncome`, or `Infinity` when income is 0.

7. `simulator.ts`:
   - `simulatePurchase(profile, {cardId, total, installments, date?}, today)` computes `firstMonth` with `invoiceMonthForCharge(card, date ?? today)`.
   - `verdictFor` reads its four thresholds through `param()`, and income through `netIncome(profile, monthOf(today), today)`.

8. Dates and tests setup:
   - `todayLocal(now = new Date())` is built with `getFullYear` / `getMonth` / `getDate`.
   - Change the `package.json` test script to `"test": "TZ=America/Sao_Paulo vitest run"`.
   - Migrate `src/data/sample.ts` to the new `Profile`, with the old `TODAY` as `balanceDate`.
   - Screens still compile: pass `'2026-11-01'` explicitly until step 05 replaces it.

**Tests** (`src/engine/*.test.ts`; existing tests migrated, all green):

- **Parameters:**
  - `param()` picks the latest effective value on or before the date;
  - it throws on a missing key, and when all rows are in the future;
  - `annualToMonthly(4.449)` ≈ 0.1518 and `annualToMonthly(1.921)` ≈ 0.0934 (±1e-4);
  - every `DEFAULT_PARAMETERS` row has a non-empty `source` and a valid `effectiveFrom`;
  - every `ParamKey` has a default.
- **Card cycle:**
  - closing 5 and due 12: a charge on Nov 3 lands in the 2026-11 invoice; a charge on Nov 5 lands in 2026-12 with the flag at 1 and in 2026-11 with it at 0;
  - closing 28 and due 5: a charge on Nov 10 lands in 2026-12;
  - closing 31 in a February cycle is clamped to the 28th.
- **Events:**
  - a stored invoice overrides the projection, and `estimated` follows `origin`;
  - a `paga` invoice after `balanceDate` still produces an outflow;
  - a `parcial` invoice produces `paidAmount` on the due date, and its remainder appears in the next projected invoice even when the due date is in the past relative to `today` but after `balanceDate`;
  - an event on `balanceDate` is excluded;
  - a `yearly` entry appears once in 12 months;
  - `endMonth` is inclusive;
  - a card entry moves cash to the invoice due date, not the charge date;
  - on the same day, an outflow comes before an inflow.
- **Metrics:** income of 0 gives `commitmentRatio` `Infinity`; `freeMargin` includes debt events (use a stubbed `debtPayment` via fixture injection).
- **Dates:** `todayLocal(new Date('2026-11-02T01:30:00Z'))` returns `'2026-11-01'` under `TZ=America/Sao_Paulo`.

**Verify:** `npm test && npm run typecheck`, plus the invariant 2 grep, plus `grep -nE "0\.(1|25|4|7)\b" src/engine/simulator.ts` prints nothing.
**Exit criteria:** at least 35 tests pass, and `src/engine/index.ts` exports every type and function named above.
**Rollback:** revert the merge. Nothing persists yet.

---

## Step 02: Debt engine (Price, SAC)

Tier: default. Depends on: 01. Branch: `step/02-debt-engine`.

**Context brief.** Financing, loans, mortgages and "Pix no crédito" are debts (spec 05). Step 01 left `debtPayment` throwing. This step implements amortisation and removes the stub. A debt's `principal` is the outstanding balance now, `months` the payments left, and `startMonth` the next payment month.

**Tasks**

1. `src/engine/debt.ts`:
   - `priceSchedule(P, i, n)`: `PMT = P·i / (1 − (1+i)^−n)`, and `P/n` when `i === 0`.
   - `sacSchedule(P, i, n)`: `A = P/n`, `interest_k = balance_{k−1}·i`, `payment_k = A + interest_k`.
   - Both return `{ k, payment, interest, amortization, balance }[]` rounded with `cents()`. The last row absorbs rounding so the final `balance` is exactly 0.
   - `debtSummary(schedule)`: `{ totalPaid, totalInterest, firstPayment, lastPayment }`.
   - `debtPayment(debt, k)` picks the schedule by `system`.
2. `events.ts` uses `debtPayment`, and the throwing stub is removed.
3. `pix_credito` is a label only (spec 05: it is a loan, not a payment method).

**Tests:**
- Price: P=10000, i=0.02, n=12 gives PMT 945.60, and the payments sum to P plus the interest.
- SAC: P=12000, i=0.01, n=12 gives a first payment of 1120.00 and a last of 1010.00.
- `i = 0`; `n = 1`; awkward inputs (P=1000, i=0.0333, n=7) end at a balance of exactly 0 for both systems.
- Debt events appear only within `startMonth..startMonth+months-1`, on `dueDay`.

**Verify:** `npm test && npm run typecheck`. `grep -rn "debt engine: step 02" src` prints nothing.
**Exit criteria:** `freeMargin` and `buildEvents` include debt payments.
**Rollback:** revert the merge.

---

## Step 03: Rotativo worst case with the 2x cap

Tier: strongest. Depends on: 01, 02. Branch: `step/03-rotativo`.

**Context brief.** This is the spec's star scenario (spec 05). The user pays part of an invoice. The unpaid part pays the rotativo rate for one cycle, then moves to the parcelamento da fatura. By law, total charges are capped at 100% of the original unpaid amount, so the debt at most doubles. Rates and the cap are parameters. Spec 05 says to confirm the law text before relying on it, so the output is labelled "pior caso estimado" and lists its assumptions. This step also replaces step 01's temporary partial-invoice rule.

**Tasks**

1. `src/engine/rotativo.ts`, `worstCase(unpaid, months, params, today)`:
   - `r1 = param('rotativo_monthly_rate')`, `r2 = param('parcelado_fatura_monthly_rate')`, `cap = param('encargos_cap_ratio')`, all at `today`;
   - `B1 = unpaid · (1 + r1)`, which is one cycle of rotativo;
   - schedule `priceSchedule(B1, r2, months)` (step 02); uncapped total `T = Σ payments`;
   - if `T − unpaid > cap · unpaid`, scale each payment by `(unpaid · (1 + cap)) / T`, round with `cents()`, and the last payment absorbs the difference so the sum is exact;
   - return `{ unpaid, totalPaid, totalCharges, capped, monthlyPayment, payments: number[], assumptions }`. `assumptions` lists the three parameters used plus "IOF, multa e juros de mora não incluídos".
   - `unpaid ≤ 0` returns zero cost and no payments.
2. In `events.ts`, a `parcial` invoice's remainder now becomes `worstCase(amount − paidAmount, partialPlanMonths ?? param('partial_plan_default_months'))`. Payment `k` (1-based) is added to the same card's projected invoice for `addMonths(dueMonth, k)`, labelled estimated. Remove the step 01 next-month rule and its marker comment.

**Tests:**
- With fixture parameters r1 = 0.15, r2 = 0.09 and cap = 1:
  - unpaid 1000 at 12x: `B1` 1150, payment ≈ 160.60, total ≈ 1927.18, not capped;
  - unpaid 1000 at 24x: uncapped charges ≈ 1843.42, so capped; total exactly 2000.00, and the payments sum to exactly 2000.00.
- A cap of 0.5 gives a total of 1500.00.
- `unpaid = 0` costs nothing.
- A missing rate throws.
- A `parcial` invoice spreads the worst-case payments over the next N projected invoices of that card, and a confirmed later invoice does not get them added again.
- Editing `rotativo_monthly_rate` with a newer `effectiveFrom` changes `worstCase` from that date on. This is the test step 10 relies on.

**Verify:** `npm test && npm run typecheck`. `grep -nE "0\.(09|15|1518|0934)" src/engine/rotativo.ts` prints nothing.
**Exit criteria:** `worstCase` is exported, and partial invoices use it.
**Rollback:** revert the merge. Partial invoices fall back to the step 01 rule.

---

## Step 04: SQLite layer (driver, schema v1, repositories)

Tier: strongest. Depends on: 01. Branch: `step/04-sqlite-layer`.

**Context brief.** Data must live on the phone and work offline (spec 08). Losing money data is the worst failure this app can have, so this step builds only the DB layer, with real-SQL tests and no UI. The schema contains every table the MVP needs, so later steps add no migration.

**Tasks**

1. Run `npx expo install expo-sqlite` and confirm 58.0.x is pinned. Tests use Node's built-in SQLite, so add no other dependency.
2. Driver (`src/db/driver.ts`, types only):

   ```ts
   type SqlParam = string | number | null;
   interface SqlDriver {
     exec(sql: string): Promise<void>;
     run(sql: string, params?: SqlParam[]): Promise<{ changes: number }>;
     all<T>(sql: string, params?: SqlParam[]): Promise<T[]>;
     first<T>(sql: string, params?: SqlParam[]): Promise<T | null>;
     transaction<T>(fn: (tx: SqlDriver) => Promise<T>): Promise<T>; // never nest
   }
   ```

   - `src/db/expoDriver.ts` wraps `SQLiteDatabase`. `transaction` uses `withExclusiveTransactionAsync(async (txn) => fn(wrap(txn)))`, and every query inside runs through `txn`. Only this file imports values from `expo-sqlite`. Every other file uses `import type`.
   - `src/db/nodeDriver.ts` is for tests only: `const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite')`, a plain `import 'node:sqlite'` fails under Vite. `transaction` runs `BEGIN`, awaits `fn`, then `COMMIT`, or `ROLLBACK` and rethrow.
   - Only parameterised queries, never SQL built from strings.
3. `src/db/open.ts`: `openDb()` calls `openDatabaseAsync('lsp.db')`, runs `PRAGMA foreign_keys = ON` and `PRAGMA journal_mode = WAL`, then `migrate`.
4. `src/db/migrations.ts`:
   - an ordered `{ version, sql }[]`;
   - `migrate(driver)` reads `PRAGMA user_version` and applies each missing migration, plus `PRAGMA user_version = N`, inside one `transaction`.
   - v1:

   ```sql
   CREATE TABLE profile (id INTEGER PRIMARY KEY CHECK (id = 1), balance_date TEXT NOT NULL,
     onboarded_at TEXT, onboarding_seconds INTEGER);
   CREATE TABLE accounts (id TEXT PRIMARY KEY, bank TEXT NOT NULL,
     kind TEXT NOT NULL CHECK (kind IN ('corrente','poupanca','carteira')), balance_cents INTEGER NOT NULL);
   CREATE TABLE cards (id TEXT PRIMARY KEY, bank TEXT NOT NULL, name TEXT NOT NULL,
     closing_day INTEGER NOT NULL CHECK (closing_day BETWEEN 1 AND 31),
     due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31), limit_cents INTEGER NOT NULL,
     variable_estimate_cents INTEGER NOT NULL DEFAULT 0, available_informed_cents INTEGER);
   CREATE TABLE entries (id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('in','out')), name TEXT NOT NULL,
     amount_cents INTEGER NOT NULL, day INTEGER NOT NULL CHECK (day BETWEEN 1 AND 31),
     recurrence TEXT NOT NULL CHECK (recurrence IN ('once','monthly','yearly')), start_month TEXT NOT NULL,
     end_month TEXT, date TEXT, account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
     card_id TEXT REFERENCES cards(id) ON DELETE SET NULL, category TEXT,
     CHECK (card_id IS NULL OR kind = 'out'));
   CREATE TABLE installments (id TEXT PRIMARY KEY, card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
     due_month TEXT NOT NULL, amount_cents INTEGER NOT NULL);
   CREATE TABLE invoices (id TEXT PRIMARY KEY, card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
     due_month TEXT NOT NULL, amount_cents INTEGER NOT NULL,
     origin TEXT NOT NULL CHECK (origin IN ('estimada','confirmada')),
     status TEXT NOT NULL CHECK (status IN ('fechada','paga','parcial')), paid_cents INTEGER,
     partial_plan_months INTEGER, estimated_cents_at_confirm INTEGER, UNIQUE (card_id, due_month));
   CREATE TABLE debts (id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL, principal_cents INTEGER NOT NULL,
     monthly_rate REAL NOT NULL, months INTEGER NOT NULL, system TEXT NOT NULL CHECK (system IN ('price','sac')),
     start_month TEXT NOT NULL, due_day INTEGER NOT NULL);
   CREATE TABLE goals (id TEXT PRIMARY KEY, name TEXT NOT NULL, target_cents INTEGER NOT NULL,
     saved_cents INTEGER NOT NULL DEFAULT 0, deadline TEXT, priority INTEGER NOT NULL);
   CREATE TABLE scenarios (id TEXT PRIMARY KEY, name TEXT NOT NULL, changes_json TEXT NOT NULL);
   CREATE TABLE parameters (key TEXT NOT NULL, effective_from TEXT NOT NULL, value REAL NOT NULL,
     source TEXT NOT NULL, note TEXT, PRIMARY KEY (key, effective_from));
   CREATE TABLE score_history (month TEXT PRIMARY KEY, total REAL NOT NULL, controle REAL NOT NULL,
     colchao REAL NOT NULL, metas REAL NOT NULL, liberdade REAL NOT NULL);
   ```

   - v1 then seeds `parameters` with **literal `INSERT` values written into the migration**, matching `DEFAULT_PARAMETERS` today. It does not read the constant, because a shipped migration must never change.
   - Notes for later: `scenarios.changes_json` stores money as reais. It is only read back into the engine, and it is documented as such in `mappers.ts`.
5. `src/db/mappers.ts`:
   - `toCents(x)` throws on non-finite values or `|x| > 1e9`, and returns `Math.round(x * 100)`.
   - `fromCents(c) = c / 100`.
   - Row ↔ type mappers per table.
6. `src/db/repos/` has one file per entity (`accounts.ts`, `cards.ts`, `entries.ts`, `installments.ts`, `invoices.ts`, `debts.ts`, `goals.ts`, `scenarios.ts`, `parameters.ts`, `scoreHistory.ts`, `profileMeta.ts`), each with `list`, `save` (an upsert) and `remove`. Also:
   - `loadProfile(driver)` (`src/db/loadProfile.ts`);
   - `resetAll(driver)` (`src/db/reset.ts`), which deletes every row of every table listed in `sqlite_master` except `parameters`, then deletes the `parameters` rows with `source = 'editado por você'`;
   - `parameters.save` with an existing (`key`, `effective_from`) updates the value. User edits use `source: 'editado por você'`.

**Tests** (`src/db/*.test.ts`, `nodeDriver` on `:memory:`):
- **Migrations:**
  - a fresh DB reaches the latest version;
  - `migrate` twice is a no-op;
  - versions are exactly `1..N`;
  - a throwaway v2 defined in the test keeps v1 rows;
  - a failing migration leaves `user_version` and the tables unchanged.
- **Parameter seed:** every `ParamKey` has a row after `migrate`, and the latest row per key equals `DEFAULT_PARAMETERS`. That way a changed default without a new migration fails.
- **Round-trip:** saving then loading returns `cents(input)` for every money field. 1234.565 loads as 1234.56, and 0.1 + 0.2 as 0.3.
- **Constraints:**
  - deleting a card removes its invoices and installments, and sets `card_id` to null on its entries;
  - `UNIQUE (card_id, due_month)` holds;
  - an `in` entry with `card_id` is rejected;
  - a rolled-back transaction writes nothing.
- **`resetAll`:** every table in `sqlite_master` is empty except the seeded default parameters, and a user-edited parameter is gone.
- **Mappers:** `toCents(NaN)`, `toCents(Infinity)` and `toCents(2e9)` throw.

**Verify:** `npm test && npm run typecheck && npx expo-doctor`, plus `grep -rln "from 'expo-sqlite'" src | grep -v expoDriver.ts` prints nothing (type-only imports use `import type`).
**Exit criteria:** `loadProfile` on a migrated empty DB returns a valid empty `Profile`, with `balanceDate` from the `profile` row. `migrate` inserts that row with today's date.
**Rollback:** revert the merge. No device has a DB yet.

---

## Step 05: App data provider, screens on real data, empty states

Tier: default. Depends on: 04. Branch: `step/05-app-data`.

**Context brief.** Connect the DB to the UI. Screens stop using `sampleProfile` and hard-coded dates. With no data, each screen shows a calm empty state that leads to onboarding (step 09).

**Tasks**

1. `src/state/AppData.tsx`:
   - `AppDataProvider` calls `openDb()`, then `loadProfile`.
   - It exposes `useAppData(): { status: 'loading' | 'ready' | 'error'; profile; today; refresh(); db }`.
   - `today = todayLocal()` is re-read when `AppState` becomes `active`.
   - The error state shows "Não consegui abrir seus dados. Tentar de novo" and never deletes or recreates the DB.
2. `App.tsx` wraps the navigator in `AppDataProvider`. The five screens use `profile` and `today` from the hook, and every literal date is removed (invariant 7).
3. Empty state when there are no entries and no cards: "Vamos montar seu mês. Leva menos de 3 minutos." The button "Começar" navigates to a placeholder `Onboarding` route, which shows "Em breve" until step 09.
4. `src/lib/copy.ts` holds `DISCLAIMER` and the shared pt-BR strings. `src/components/Disclaimer.tsx` renders `DISCLAIMER`. Replace the three inline copies. `src/lib/copy.test.ts` asserts the exact text (invariant 4) and holds the banned-word list (invariant 9).
5. Dev-only `loadSample(db)`, behind `if (__DEV__)`, writes `src/data/sample.ts` through the repositories. It is reachable from a small "Dados de exemplo" button on the empty state, shown only in dev. `sample.ts` stays for tests.

**Tests:** `copy.test.ts` (disclaimer text; the banned-word list exists and invariant 9's grep matches it); `loadSample` round-trips through `nodeDriver`.
**Verify:** tests, typecheck, doctor, the invariant 7 grep, the bundle check. In Expo Go: the empty state shows; "Dados de exemplo" fills the tabs; kill the app, reopen, and the data is still there.
**Exit criteria:** the invariant 7 grep prints nothing; the data survives a restart.
**Rollback:** revert the merge. The DB file stays on the device, unused.

---

## Step 06: Navigation stacks and repository forms

Tier: default. Depends on: 05. Branch: `step/06-forms`.

**Context brief.** The repository is the half of the app that feeds the simulator (spec 03). Input is consolidated amounts, not purchases. This step:
- adds a stack per tab and the forms to create, edit and delete everything the user maintains: accounts and balances, cards, entries, future installments per month, and debts;
- sets two file-ownership rules that let steps 07, 08 and 10 run in parallel: one navigation file per tab, and one repository file per entity (from step 04).

**Tasks**

1. Install native-stack:
   - `npm install @react-navigation/native-stack@^7.21.0`;
   - check `npx expo-doctor` stays green.
2. Navigation:
   - `src/navigation/RootTabs.tsx` holds the five tabs;
   - one stack file per tab: `HojeStack.tsx`, `FluxoStack.tsx`, `SimularStack.tsx`, `BancosStack.tsx` and `PlanoStack.tsx`;
   - forms open as modal routes;
   - `App.tsx` renders `RootTabs` and the `Onboarding` route;
   - later steps edit only their own tab's stack file.
3. `src/lib/money.ts` is pure TypeScript so Vitest can import it:
   - `parseBRL("1.234,56") = 1234.56`; it returns `null` for empty, non-numeric, negative or > 1e9 input;
   - `formatBRL`.
4. Input components:
   - `src/components/MoneyInput.tsx` uses `decimal-pad` and shows the inline error from `parseBRL`;
   - `DayInput` accepts 1–31 and shows "último dia do mês" for days that a month lacks.
5. Forms in `src/screens/forms/`. Each takes `{ initial?, onSave, onCancel }`, saves through its repository in one transaction, then calls `refresh()`.
   - `AccountForm`: bank chips plus "Outro", kind, balance. Plus an "Atualizar saldos" screen that edits all balances at once and sets `profile.balance_date = today`.
   - `CardForm`:
     - bank, name, limit, closing day and due day (they must differ), variable estimate ("quanto você costuma gastar fora as parcelas", labelled estimado);
     - optional available limit, labelled "informado por você".
     - When the available limit is empty, show the estimate `limit − open invoice − future installments`, labelled "estimativa" (spec 05).
   - `EntryForm`:
     - kind; name; amount; day; recurrence; start and end month; optional category chips (the six categories);
     - "pago no cartão" picker (`cardId`, only for outflows), with the hint "entra na fatura".
   - `InstallmentsForm`:
     - one card's next `projection_months` months as a grid, one sum per month;
     - "mesmo valor por N meses" helper (pure function in `src/lib/fill.ts`).
   - `DebtForm`:
     - name, kind, current outstanding balance, rate in % a.m. (stored as a fraction), payments left, Price/SAC, due day, next payment month;
     - shows the payment from `debtPayment`.
6. `BancosScreen` lists:
   - per bank: accounts, cards, how much falls due in that bank this month, and the limit left (spec 03 "visão por banco");
   - per card: the invoice of the month with its "estimado"/"confirmado" badge, and the future installments;
   - a debts section.
   Every row has edit and delete. Delete uses an inline confirm (no `Alert.alert`). Deleting a card lists what goes with it (invoices, installments), and which entries become account outflows.
7. A `FluxoStack` route `Lancamentos` lists entries with add and edit (step 07 links it from the Fluxo screen).
8. Accessibility: every input has an `accessibilityLabel`, touch targets are at least 44 pt, and errors use `accessibilityLiveRegion="polite"`.

**Tests:**
- `money.test.ts`: "1.234,56", "0,5", "1234", "", "abc", "-1", "2.000.000.000".
- `fill.test.ts`.
- Repository create → edit → delete per entity with `nodeDriver`.
- Card deletion side effects.

**Verify:** tests, typecheck, doctor, bundle check. In Expo Go, add an account, a card, a salary, rent, a debt and installments, and confirm Hoje updates without a restart.
**Exit criteria:** every item of spec 03 "o que o usuário mantém" 1–4 can be created, edited and deleted. Goals are step 10.
**Rollback:** revert the merge. The rows stay valid under schema v1.

---

## Step 07: Fluxo views (monthly, daily, due-date calendar)

Tier: default. Depends on: 06. Branch: `step/07-fluxo-views`.

**Context brief.** Spec 07 tab 2 and spec 09 list three MVP views:
- the 18-month monthly view;
- the daily view inside a month, to find the critical day (the due date that arrives before the salary);
- the due-date calendar ("dia 5: Itaú R$ 2.100 · dia 12: Nubank R$ 4.800").

Step 09's Raio-X reuses the calendar.

**Tasks**

1. `src/engine/summary.ts`:
   - `monthlySummary(profile, today)` returns, for each month, `{ month, income, outflows, invoices, debts, margin, endBalance, estimated }`, built from `buildEvents` and `monthEvents` only;
   - `criticalMonth(summary)` is the month with the lowest `endBalance`;
   - `dueCalendar(profile, month, today)` returns the month's outflow events sorted by date, with bank and amount.
2. `src/components/DueCalendar.tsx` renders `dueCalendar` as a list. It is reused by step 09.
3. `FluxoScreen` has a segmented control "Mês a mês | Dia a dia | Vencimentos":
   - Mês a mês: 18 rows, with the critical month highlighted (text plus colour);
   - Dia a dia: the selected month's events with the running balance, and the critical day highlighted;
   - Vencimentos: `DueCalendar`.
   Add a header button "Lançamentos" (the step 06 route) and `<Disclaimer />`.

**Tests:** `monthlySummary` on a fixture with a debt and a partial invoice; `criticalMonth` breaks ties by the earliest month; the `dueCalendar` order on the same day.
**Verify:** tests, typecheck, doctor, bundle check.
**Exit criteria:** all three views render from real data; the critical day matches `criticalDay`.
**Rollback:** revert the merge.

---

## Step 08: Monthly upkeep (confirm the invoice, mark paid)

Tier: default. Depends on: 03, 06. Branch: `step/08-upkeep`.

**Context brief.** Spec 03 says upkeep must be effortless:
- recurrences already repeat by themselves (step 01 `monthly`);
- the invoice comes prefilled from the estimate, and the user only confirms the real amount when it closes;
- confirming turns "estimada" into "confirmada" and measures forecast quality (spec 09 metric).

Estimates are computed when needed, never stored ahead, so they cannot go stale. Push notifications are V1; this step adds an in-app prompt instead.

**Tasks**

1. `src/engine/upkeep.ts`:
   - `invoicesToConfirm(profile, today)` returns, per card, the `dueMonth` whose `closingDate ≤ today ≤ dueDate` and that has no row or an `estimada` row. It returns `{ card, dueMonth, estimate }`, where `estimate` is the projection or the stored estimated amount.
   - `forecastError(invoices)`: `{ meanAbs, meanPct }` over confirmed rows with `estimatedAtConfirm`, or `null` when there are none.
2. `HojeScreen` shows a card per invoice to confirm: "Sua fatura do Nubank fechou. Confirma o valor?" It opens `ConfirmInvoiceSheet`, a modal in `HojeStack` prefilled with the estimate. Saving upserts the invoice with `origin 'confirmada'`, `status 'fechada'` and `estimatedAtConfirm = estimate`.
3. "Marquei como paga" on a confirmed invoice, from Hoje or Bancos:
   - **in full:** `status 'paga'`, then the question "Quer atualizar o saldo da conta agora?", which opens "Atualizar saldos" (step 06);
   - **partial:** `status 'parcial'` with `paidAmount` and `partialPlanMonths`, the default being `param('partial_plan_default_months')`. The sheet immediately shows the `worstCase` summary (step 03): "pior caso estimado: você pagaria até R$ X no total; tem teto de 2x", plus `<Disclaimer />`.

**Tests:**
- `invoicesToConfirm` on the day before closing, on it and the day after;
- closing day 31 in a 30-day month;
- the due date itself;
- an `estimada` row still prompts;
- a `confirmada` row does not;
- `forecastError` with no data returns `null`.

**Verify:** tests, typecheck, doctor, bundle check.
**Exit criteria:** confirming changes the badge to "confirmado" and Fluxo uses the amount; a partial payment shows the capped worst case.
**Rollback:** revert the merge. The rows written stay valid.

---

## Step 09: Onboarding in under 3 minutes and the Raio-X

Tier: default. Depends on: 06, 07. Branch: `step/09-onboarding`.

**Context brief.** The first useful value must arrive in under 3 minutes (spec 07; spec 09 metric 1). This step replaces the placeholder `Onboarding` route from step 05.

**Tasks**

1. `src/screens/onboarding/` is a 5-screen linear stack with a progress bar. It reuses the step 06 inputs, with bank chips: Nubank, Itaú, Bradesco, Santander, Banco do Brasil, Caixa, Inter, C6, Outro.
   1. **Renda:**
      - net income and pay day → a monthly `in` entry named "Salário";
      - "Quanto tem na conta hoje?" (optional, 0 by default) → an account and `balance_date = today`.
   2. **Cartões** (repeat with "Adicionar outro cartão"):
      - limit, closing day, due day;
      - "Quanto vem na próxima fatura? (estimativa serve)", saved as an `Invoice` for the next `dueMonth`. Its `origin` is `'confirmada'` if that cycle has already closed, and `'estimada'` otherwise;
      - `variableEstimate` defaults to `max(0, that amount − installments of that month)`, labelled estimado, and is editable.
   3. **Parcelas futuras** (skippable): the 18-month grid with "mesmo valor por N meses".
   4. **Fixos** (skippable): name, amount, day and category chips → monthly `out` entries.
   5. **Raio-X do próximo mês:**
      - the free margin for next month with its semáforo;
      - `DueCalendar` (step 07);
      - the critical day;
      - one insight sentence built from engine output (for example the critical day before payday);
      - `<Disclaimer />`.
   Every screen after Renda has "Pular por agora".
2. On finish, set `profile.onboarded_at` and `onboarding_seconds` (from the first screen shown to the Raio-X). Both stay on the device.
3. Launch routing: `onboarded_at` null → Onboarding; otherwise → tabs. The empty-state "Começar" button opens Onboarding.

**Tests:** the routing decision (pure function); the default `variableEstimate`; the `origin` choice around the closing date.
**Verify:** tests, typecheck, doctor, bundle check. You time it in Expo Go with 1 income, 2 cards and 2 fixed costs; the target is under 3 minutes.
**Exit criteria:** a fresh install lands in onboarding and ends on the Raio-X. Skipping everything after Renda still gives a valid Raio-X.
**Rollback:** revert the merge.

---

## Step 10: Plano tab (goals with calculated delay, health score, parameters, delete my data)

Tier: default. Depends on: 03, 06. Branch: `step/10-plano`.

**Context brief.** Spec 05 defines the score:
- the four CFPB elements, 0–100 each;
- weights and cuts as parameters;
- shown as one sentence and four bars, with the trend before the number.

Goals show progress and the delay a change causes ("essa compra atrasa sua reserva em 3 meses"). Spec 06 requires that criteria are visible and parameters editable (explainability), and that the user can delete everything (LGPD).

**Tasks**

1. `src/engine/goals.ts`:
   - `contributions(profile, today)` is the monthly series `max(0, freeMargin(month))` over the horizon;
   - `goalTimeline(goals, contributions)` fills goals **in priority order**: goal 1 takes each month's contribution until reached, then the next goal;
   - it returns, per goal, the month it is reached, or `null` when that is outside the horizon ("não alcança em 18 meses");
   - `goalDelays(baselineProfile, scenarioProfile, today)` gives the per-goal difference in months, with `null` handled explicitly.
2. `src/engine/score.ts`, `healthScore(profile, today)`. Every constant comes from `param()`.
   - Controle: 0 if income is 0 or the margin is negative; otherwise `clamp(margin / income / controle_full_margin_share, 0, 1)·100`.
   - Colchão: `clamp(reserveMonths / reserve_target_months, 0, 1)·100`, where `reserveMonths = balance / essentials`. Essentials are this month's outflows in `moradia`, `alimentacao`, `transporte`, `dividas` and uncategorised, plus invoices and debts. When essentials are 0, the score is 100.
   - Metas: the share of goals on track. On track means reached by the deadline or, with no deadline, reachable within the horizon. With no goals the score is 100, labelled "sem metas ainda".
   - Liberdade: linear from 100 at `commitment_band_yellow` to 0 at `commitment_band_red`. It is 0 if income is 0, or if any invoice was `parcial` within the last `rotativo_lookback_months`.
   - Total: `Σ weight·part / Σ weights`.
   - Returns `{ total, parts, topImprovement }`, where `topImprovement` is a pt-BR sentence naming the part with the largest weighted gap.
3. Score history: on app open, if `score_history` has no row for the current month, insert one. The trend compares with the row from 3 months earlier, if any.
4. `PlanoScreen` sections:
   - **Metas:** list, `GoalForm` (`MoneyInput`), progress bar, months to target.
   - **Saúde financeira:** one sentence, four labelled bars, the trend ("↑ 6 pontos em 3 meses"), and "Por que você está vendo isto" with the formulas in plain words, marked "referência do app".
   - **Comprometimento:** the band, as today, read from parameters.
   - **Premissas:** each parameter's value, source and date.
     - Editing writes a row with `effective_from = today` and `source 'editado por você'`; a same-day edit updates it.
     - "Restaurar padrão" deletes the user rows for that key.
   - **Recorrências:** a link to `Lancamentos`.
   - **Apagar todos os meus dados:** type "APAGAR" to confirm, then `resetAll`, then Onboarding.

**Tests:**
- `goalTimeline`: priority order, an already-reached goal, an unreachable goal, uneven contributions.
- `goalDelays` when a scenario makes a goal unreachable.
- `healthScore`:
  - each part's boundaries;
  - income 0 gives no NaN;
  - weights that don't sum to 1 are normalised;
  - an old `parcial` outside the lookback window no longer zeroes Liberdade.
- A parameter edit through `parameters.save` changes `worstCase` (step 03) from today on.
- After `resetAll`, `loadProfile` returns an empty profile.

**Verify:** tests, typecheck, doctor, bundle check.
**Exit criteria:** the score and goals render from real data; a parameter edit is reflected immediately; delete-all lands in Onboarding.
**Rollback:** revert the merge. Snapshot rows are harmless.

---

## Step 11: Scenario engine and commit

Tier: strongest. Depends on: 03, 07, 10. Branch: `step/11-scenario-engine`.

**Context brief.** "E se…?" is the main feature (spec 04). A scenario never has its own data. It is a list of `ScenarioChange` (types from step 01) applied to the baseline profile (spec 01 linking rule). The result follows spec 04's fixed order. One tap turns an accepted scenario into real rows. This step is engine and DB only; the UI is step 12.

**Tasks**

1. `src/engine/scenarios.ts`, `applyChanges(profile, changes, today): Profile` (pure). Per change type:
   - `purchase`: equal installments, with the remainder on the first, starting at `invoiceMonthForCharge`. With `interestMonthly`, use `priceSchedule` amounts.
   - `debt`: adds a `Debt` with `principal − downPayment`. The down payment is a `once` outflow today. `incomeStressPct` scales income entries by `(1 − pct)` over the debt's months, which is the mortgage stress view.
   - `subscription`: a monthly `out` entry, optionally on a card.
   - `incomeChange`: overrides income entries for N months from `startMonth`, by percentage or by amount.
   - `costChange`: a monthly `out` entry from `startMonth`.
   - `emergency`: a `once` outflow on `date`.
   - `payPartial`: sets the invoice row to `parcial` with `paidAmount = payNow` and `partialPlanMonths = months`, so step 03's rule produces the worst case.
2. `evaluate(profile, scenario, today): ScenarioResult` returns, in spec 04 order:
   - `verdict`;
   - `monthly`: `monthlySummary` of both the baseline and the scenario;
   - `criticalDay` for both;
   - `limitImpact` per card, as the estimated available limit after the change;
   - `savingsImpact`: the change in the sum of `contributions`;
   - `goalDelays`;
   - `extras` per type: lost monthly freedom in R$ and as % of free margin for a subscription; months of cushion and the first negative month for an income drop; months the reserve covers for an emergency; `debtSummary` for financing and mortgages;
   - `uncertainty`: the scenario's critical balance re-run with every card's `variableEstimate × (1 ± variable_estimate_uncertainty)`;
   - `assumptions`: the parameters used.
3. `toRows(scenario)` maps changes to `Entry | Installment | Debt | Invoice` rows. In `src/db/repos/scenarios.ts`, `commitScenario(db, scenario)` writes them in one transaction, plus `saveScenario` and `listScenarios` for named scenarios.

**Tests:**
- `applyChanges` per type.
- Income −30% for 3 months finds the correct first negative month.
- An emergency computes the months covered.
- `uncertainty.low ≤ scenario critical balance ≤ uncertainty.high`.
- `evaluate` on a 12x purchase spans 12 invoice months.
- `commitScenario` writes exactly `toRows`; an injected failure mid-commit writes nothing (`nodeDriver`).
- Performance: `evaluate` over 18 months with 3 cards and 30 entries runs in under 50 ms in Node, which is the margin for the < 1 s on-device target.

**Verify:** `npm test && npm run typecheck`.
**Exit criteria:** every `ScenarioChange` type evaluates; commit is atomic.
**Rollback:** revert the merge.

---

## Step 12: Simulator UI (8 types)

Tier: default. Depends on: 06, 11. Branch: `step/12-simulator-ui`.

**Context brief.** This puts step 11's engine on the "E se…?" tab. There are 8 types: comprar parcelado, financiar, hipoteca, nova assinatura, renda cair, aumentar custo de vida, emergência and "minha fatura é maior que o que eu recebo" (payPartial). Results must update in under 1 s, in spec 04 order, ending with the disclaimer.

**Tasks**

1. `SimuladorScreen` shows a grid of the 8 types, then a compact form per type in `src/screens/simulator/` (using `MoneyInput` and the card picker), then `ScenarioResultCard`.
2. `ScenarioResultCard` order:
   1. the verdict line with its `Pill` (text plus colour);
   2. the monthly timeline as a horizontal list, with the critical month highlighted;
   3. the impact on limit and savings;
   4. delayed goals;
   5. "Três saídas", a placeholder ("Em breve") until step 13;
   6. the premissas used and the uncertainty range ("entre R$ X e R$ Y"), with a link to Plano → Premissas;
   7. `<Disclaimer />`.
3. Re-evaluate on input change with a 150 ms debounce.
4. "Seguir com isso" opens a confirmation that lists exactly the rows `toRows` will write, then `commitScenario`, then `refresh()`. "Salvar cenário" names it and saves it, and saved scenarios are listed at the top of the tab.
5. The payPartial form is prefilled from the current invoice, and its result headline is "pior caso: ainda muito caro, mas tem teto" with the capped total.

**Tests:** form-to-`ScenarioChange` mappers (pure, in `src/screens/simulator/mappers.ts`, kept free of react-native imports).
**Verify:** tests, typecheck, doctor, bundle check. In Expo Go, a 12x purchase shows 12 months, and "Seguir com isso" adds the installments, visible in Bancos.
**Exit criteria:** all 8 types render the full order; commit writes exactly what the confirmation listed.
**Rollback:** revert the merge. Committed rows are ordinary rows, editable in step 06's forms.

---

## Step 13: Action catalog (the "três saídas")

Tier: strongest. Depends on: 08, 12. Branch: `step/13-actions`.

**Context brief.** Every suggestion is a concrete action with a calculated cost (spec 01 principle 3; spec 04 catalog). The MVP ships 5 of the 10 actions, using spec catalog numbers: #1, #2, #3, #6 and #8.

Guardrails:
- Spec 04 alert rule (Medina 2021): any message about a due date must come with the projected balance on that date and an alternative.
- Spec 06 rule 2: never offer, compare or broker credit. That excludes overdraft, loans and "Pix no crédito" as suggestions.
- #10 renegociação (educational) is out of MVP.

**Tasks**

1. `src/engine/actions.ts`:
   - `Action` is `{ id: 1 | 2 | 3 | 6 | 8; title; message; why; impact: { criticalBalanceAfter: number; totalCost: number; monthsShift?: number }; assumptions }`;
   - `suggestActions(profile, scenario | null, today): Action[]` returns at most 3, ranked by `criticalBalanceAfter`, then by lower `totalCost`, then by `id`.
2. The actions:
   - **#1 Mover o vencimento.**
     - Trigger: the critical day is a card's due date, before `payday`, with a negative balance.
     - Compute: re-run with that card's `dueDay` at payday + 3, + 4 and + 5, and pick the best.
     - Cost 0. Message: "Mover o vencimento do Nubank para o dia 12 deixa o mês no azul. Dá para trocar no app do banco."
   - **#2 Melhor dia de compra.**
     - Trigger: a `purchase` scenario.
     - Compute the invoice for buying today versus the day after the next closing (honour `purchase_on_closing_day_next_invoice`), and the days of float gained.
     - Label "estimado; a regra do banco pode variar".
   - **#3 Pagar integral vs. parcial.**
     - Trigger: the balance on a due date is below that invoice.
     - Compare three options:
       - (a) paying in full, shown as the shortfall on that day ("faltariam R$ X no dia 12"), with no overdraft cost estimate;
       - (b) the partial worst case (`worstCase`), with its total cost;
       - (c) #1 if it applies.
   - **#6 Teto de fatura do mês.**
     - Trigger: a projected invoice above `commitment_band_orange × netIncome`.
     - Compute the ceiling and how much is left until closing.
   - **#8 Adiar a compra N meses.**
     - Trigger: a `purchase` verdict other than `confortavel`.
     - Compute the smallest N in 1..6 that turns the verdict to `confortavel`. Message: "Se esperar 2 meses, o cenário fica confortável."
3. `ScenarioResultCard` replaces the "Em breve" placeholder with the actions. `HojeScreen` shows the single top action for the baseline (spec 07: "1 insight e 1 ação sugerida").
4. The partial-payment sheet from step 08 shows #3's comparison.

**Tests:**
- Each action triggers on one fixture and stays silent on another.
- At most 3 are returned, in a stable order.
- Every action has a non-empty `why` and a finite `totalCost`.
- Guardrail: an action whose message mentions a date always has `criticalBalanceAfter` computed.
- No action message matches the invariant 9 banned list.
- No action suggests overdraft or credit (extend the banned list with "cheque especial" for action messages only).

**Verify:** tests, typecheck, doctor, bundle check.
**Exit criteria:** every scenario result shows 0–3 actions with costs; Hoje shows one action.
**Rollback:** revert the merge. The placeholder returns.

---

## Step 14: Spreadsheet import (the "Life Strategic Plan" Excel)

Tier: default. Depends on: 06. Branch: `step/14-import`.
**Blocked:** needs a sample of your real spreadsheet, with the tabs and column headers kept and dummy values. Do not guess the layout.

**Context brief.** Spec 07 maps your spreadsheet: the Painel tab becomes profile and recurrences; Hipoteca, Empréstimo and Financiamento become debts; Cenários becomes scenarios. OFX and CSV are V2.

**Tasks**

1. Install the file picker: `npx expo install expo-document-picker expo-file-system`.
   - Parse with SheetJS from the official tarball, pinned: `npm install https://cdn.sheetjs.com/xlsx-<version>/xlsx-<version>.tgz`.
   - The npm `xlsx@0.18.5` is stale and has known advisories.
   - Before choosing `<version>`, check that it is at least two weeks old.
2. `src/import/`:
   - `readWorkbook(uri)`;
   - pure `mapWorkbook(sheets): ImportPreview { entries, debts, scenarios, warnings }`, with header matching that ignores accents and case;
   - unknown tabs and columns become warnings and are never dropped silently.
3. The preview screen (in `PlanoStack`) lists everything to be created, editable with the step 06 forms. "Importar" writes it in one transaction and "Cancelar" writes nothing. A re-import matches on (name, kind) and asks "substituir ou pular".
4. Files are read locally and never uploaded. Reject files over 5 MB and non-xlsx files with a calm message.

**Tests:** `mapWorkbook` against `src/import/__fixtures__/sample.json` (the sheets as row arrays, no binary); warnings; the duplicate key; the transaction rollback.
**Verify:** tests, typecheck, doctor, bundle check. In Expo Go, import the sample.
**Exit criteria:** the imported profile gives the same monthly totals as your Painel tab, within R$ 1.
**Rollback:** revert the merge. Imported rows are ordinary rows.

---

## Out of scope (spec roadmap V1+)

These are not in this plan:
- push notifications and smart alerts;
- Pix Automático;
- Open Finance;
- OFX and CSV import;
- Supabase sync and login;
- AI explanations;
- the paid tier through RevenueCat;
- actions #4, #5, #7, #9 and #10;
- the app icon and store assets.

Spec 10 step 7 asks for 10 interviews, a price test and a clickable prototype before building everything. Running them alongside steps 07–10 costs no engineering time.

## Open decisions (defaults chosen; change before the step starts)

| Decision | Default | Step |
|---|---|---|
| SQL tests | built-in `node:sqlite` through `createRequire`, behind `SqlDriver` | 04 |
| Balance date | one date for all accounts ("Atualizar saldos" updates all) | 01, 06 |
| Purchase on the closing day | next invoice (parameter) | 01 |
| Partial invoice | worst case over `partial_plan_default_months` (12) unless the user picks | 03, 08 |
| Goal funding | priority waterfall of positive free margin | 10 |
| Deleting a card | cascades invoices and installments; its entries become account outflows | 04, 06 |
| Spreadsheet parser | SheetJS official tarball | 14 |

## Mutation log

- 2026-10-26 r1: plan created (11 steps).
- 2026-10-26 r2: applied the adversarial review (Opus). Changes:
  - all tables moved into migration v1, with a contiguous-version rule (CRITICAL);
  - the money rules fixed: cash anchored on `balanceDate`; paid invoices stay as outflows until the balance is updated; partial remainders are never dropped (CRITICAL);
  - serial execution by default, with worktrees, file-ownership rules and a corrected parallel table (CRITICAL);
  - test driver moved to `node:sqlite` via `createRequire`, verified by a smoke test (HIGH);
  - closing-to-due mapping, payday, a single income source, `Debt.dueDay`, `Entry.cardId` and `Card.availableInformed` added (HIGH);
  - goals funded by priority waterfall, with no share column (HIGH);
  - added the Fluxo views (new step 07), debt forms, and the uncertainty range (HIGH);
  - parameters seeded literally, with a test and a same-day upsert (HIGH);
  - dependencies corrected: 03 depends on 02, 10 on 06, and 11 on 07 and 10 (HIGH);
  - steps 02 and 08 split into 04/05 and 11/12 (MEDIUM);
  - score edge cases, `resetAll` over every table, guardrail tests, `TZ` pinned, the round-trip rule, action #3's comparison, and spec catalog numbering (MEDIUM);
  - the unused `rotativo_max_days` dropped, and the default rates set to the exact conversions (0.1518 and 0.0934) (MEDIUM).
- 2026-10-26 execution: steps 01–13 done and merged into `feat/life-strategic-plan-app` (200 tests, `expo-doctor` 20/20, iOS and Android bundles 200 after every UI step). Step 14 is still blocked on a sample spreadsheet. Deviations from the step text:
  - **Step 04:** 1234.565 stores as 1234.57, not 1234.56 (JS float). The test asserts what matters: DB value = engine `cents()`.
  - **Step 05:** `@react-navigation/native-stack` was installed here instead of in step 06, because the Onboarding route needed a root stack.
  - **Step 06:** form controls live in one `src/components/form.tsx` (`MoneyInput`, `DayInput`, `Chips`, `BankPicker`...), plus a `useForm` hook. Pure validation lives in `src/screens/forms/mappers.ts`. `availableLimit()` was added to the engine (`limit.ts`). The installments grid replaces only months from the first shown month on.
  - **Step 07:** a month's `lowBalance` counts only post-event balances, to match `criticalDay`. A test caught a mismatch.
  - **Step 09:** onboarding is one screen with five internal steps, not five stack screens. Each card's variable estimate is settled after the installments step.
  - **Step 11:** `essentialOutflows()` moved into `metrics.ts` (shared by the score and the emergency scenario). Hypothetical events never land on or before the balance date. The performance test allows 250 ms in Node (the plan said 50), to avoid flaky CI; measured runs were far below that.
  - **Step 12:** the disclaimer guardrail now checks every component that shows results (`ResultCard`, `RaioX`, `PayInvoiceScreen`...).
  - **Step 13:** the banned-word list moved to `src/lib/copy.ts`. Importing it from a test file re-registered that file's tests.
