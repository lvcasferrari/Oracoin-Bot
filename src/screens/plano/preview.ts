import type { Profile } from '../../engine';

// shortcut: the strategy shown in Roteiro lives in module memory and is lost on reload; move it to context if Roteiro gets deep links.
let current: { title: string; profile: Profile } | null = null;

export const setRoteiroPreview = (preview: { title: string; profile: Profile } | null) => {
  current = preview;
};
export const roteiroPreview = () => current;
