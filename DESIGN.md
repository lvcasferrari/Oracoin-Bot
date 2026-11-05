# Design: Alivy

**World:** light & airy liquid glass (brandbook "Alivy", v1.0). Off-white air (`BACKDROP` #F9FAFC → #F4F5F7 → #F2F1F8) with the two-lens symbol glowing out of focus behind the top of every screen (`Backdrop`, `assets/brand/glow.png`). Content sits on frosted white glass (`Card`: blur 40 light, white wash 58%, bright 1 px rim, radius 24, soft slate shadow 0/10/22 at 7%).

**Symbol:** two overlapping glass lenses, electric blue and neon purple. Source: the approved logo, cut out with a colour-to-alpha matte (`assets/brand/mark.png` / `@2x`); the opaque original is the app icon (`assets/brand/icon.png`) and the splash shows the cut-out on #F4F5F7. The cut-out is made for light backgrounds only (its rim keeps a faint JPEG halo on dark).

**Tokens** (`src/components/theme.ts`):
- Text dark slate #0A0F1D; secondary #4F576B (6.9:1 on #F4F5F7).
- Electric blue #0052FF: actions, links, invoices, the safe path. Neon purple #A855F7: projections and scenarios (decorative; violet text #7C3AED).
- Primary button: blue → violet (#0052FF → #7C3AED) pill, white text. Critical actions: slate fill, never red.
- Mint #10B981 for paid / positive (text #047857). Coral #E88D5D / #FFA57B for attention and pendências; errors and negative values in deep coral #B4532A. No "debt red" anywhere; words carry the state ("Mês apertado", "estimado").

**Type** (`src/components/Text.tsx` picks the file from the style's weight): Plus Jakarta Sans for titles (≥20 pt) and headers, Inter for body and controls, Space Grotesk for money and figures (`<Money>` / `numeric`).

**Rules**
- Text ≥4.5:1 on white glass and on #F4F5F7; chart fills ≥3:1 against the air.
- Controls are pills (radius 24), 44 pt minimum; inputs and chips are milky glass with a hairline slate border.
- Headers take the air colour with no hairline; tab bar frosted light; status bar dark.
- Tone (brandbook): calm and forward-looking. Prefer "fôlego", "previsão", "estimado"; avoid "atrasado", "dívida pendente", "no vermelho".
