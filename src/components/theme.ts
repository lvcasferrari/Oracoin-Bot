/**
 * Dark "liquid glass" world: a deep teal-to-indigo night, frosted cards floating on it, one mint accent.
 * Every text colour here is checked against the darkest glass (#0d1a1c), ≥4.5:1.
 */
export const COLORS = {
  primary: '#5fd4a0',
  primaryText: '#7ee2b4',
  /** Text on a primary or danger fill. */
  onPrimary: '#06140e',
  danger: '#e5675c',
  error: '#ff8a80',
  warn: '#ffc46b',
  border: 'rgba(255,255,255,0.22)',
  hairline: 'rgba(255,255,255,0.12)',
  placeholder: '#a3b1ac',
  text: '#eef3f1',
};

/** Page background, top-left to bottom-right. */
export const BACKDROP = ['#061512', '#0b2430', '#1c1842'] as const;
/** Primary button fill. */
export const ACCENT = ['#6ee7b0', '#3fc1c9'] as const;
/** Frosted card surface: blur plus a faint white wash and a lit top edge. */
export const GLASS = { tint: 'rgba(255,255,255,0.06)', edge: 'rgba(255,255,255,0.16)', blur: 28 } as const;
