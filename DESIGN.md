# Design

**World:** night "liquid glass". A deep teal-to-indigo gradient fills every screen (`BACKDROP`); content sits on frosted cards (`Card`: blur 28, white wash 6%, hairline edge, brighter top edge, radius 22). One accent, mint (`#5fd4a0`); the primary button is a mint-to-teal gradient pill with dark text.

**Tokens:** `src/components/theme.ts` (`COLORS`, `BACKDROP`, `ACCENT`, `GLASS`). All text goes through `src/components/Text.tsx`, which defaults to `COLORS.text`.

**Rules**
- Text ≥4.5:1 on the darkest glass (`#0d1a1c`); secondary text `#a3b1ac`, never grey below that.
- State reads from colour plus words (pills) and shape (tab icons filled when active).
- Controls are pills (radius 24), 44 pt minimum; inputs and chips are faint glass with a hairline border.
- Status bar light, headers solid night tone, tab bar frosted.
- Charts: mint for gains and fills, coral `#ff8a80` for losses, amber `#ffc46b` for warnings, blue `#6fa8ff` for invoices.
