/**
 * Alivy, light & airy: off-white air, frosted white glass, the two-lens symbol (electric blue + neon
 * purple) glowing faintly behind the content. Text colours are checked on white glass and on #F4F5F7, ≥4.5:1.
 */
export const COLORS = {
  /** Electric blue: actions, links, the safe path. 5.9:1 on white. */
  primary: '#0052FF',
  primaryText: '#0040CC',
  /** Text on a filled primary (blue→violet) or slate button. */
  onPrimary: '#FFFFFF',
  /** Critical actions use dark slate, never red (brandbook: no "debt red"). */
  danger: '#0A0F1D',
  /** Errors and negative values: deep coral, 5.3:1 on white. */
  error: '#B4532A',
  /** Attention fills (pendências, pontes); pair with slate text. */
  warn: '#E88D5D',
  /** Paid, settled, positive: mint fill; text uses successText. */
  success: '#10B981',
  successText: '#047857',
  /** Projections and scenarios. Decorative; violet text uses accentText. */
  accent: '#A855F7',
  accentText: '#7C3AED',
  border: 'rgba(10,15,29,0.14)',
  hairline: 'rgba(10,15,29,0.08)',
  /** Secondary text: 6.9:1 on #F4F5F7. */
  placeholder: '#4F576B',
  text: '#0A0F1D',
};

/** Page air, top to bottom. */
export const BACKDROP = ['#F9FAFC', '#F4F5F7', '#F2F1F8'] as const;
/** Primary button: blue into violet (white text ≥4.5:1 along the whole ramp). */
export const ACCENT = ['#0052FF', '#7C3AED'] as const;
/** Frosted white glass: blur, a milky wash, a bright rim and a soft slate shadow. */
export const GLASS = { tint: 'rgba(255,255,255,0.58)', edge: 'rgba(255,255,255,0.95)', blur: 40 } as const;

/** Brand faces (loaded in App.tsx): Plus Jakarta Sans titles, Inter body, Space Grotesk numbers. */
export const FONTS = {
  title: { 500: 'PlusJakartaSans_500Medium', 600: 'PlusJakartaSans_600SemiBold', 700: 'PlusJakartaSans_700Bold' },
  body: { 400: 'Inter_400Regular', 500: 'Inter_500Medium', 600: 'Inter_600SemiBold', 700: 'Inter_700Bold' },
  numbers: { 400: 'SpaceGrotesk_400Regular', 500: 'SpaceGrotesk_500Medium', 600: 'SpaceGrotesk_600SemiBold', 700: 'SpaceGrotesk_700Bold' },
} as const;

/** Native-stack header for every stack: the air colour, no hairline, Jakarta title, dark status bar. */
export const STACK_OPTIONS = {
  statusBarStyle: 'dark',
  headerShadowVisible: false,
  headerStyle: { backgroundColor: BACKDROP[0] },
  headerTintColor: COLORS.primary,
  headerTitleStyle: { fontFamily: FONTS.title[600], color: COLORS.text },
  contentStyle: { backgroundColor: 'transparent' },
} as const;
