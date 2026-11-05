import { StyleSheet, Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { COLORS, FONTS } from './theme';

type Weight = 400 | 500 | 600 | 700;

/** Nearest weight the face ships with ('bold' = 700; unset = 400). */
function weightOf(style: TextStyle): Weight {
  const w = style.fontWeight === 'bold' ? 700 : Number(style.fontWeight ?? 400);
  return w >= 700 ? 700 : w >= 600 ? 600 : w >= 500 ? 500 : 400;
}

/**
 * App text in the brand faces. Custom fonts carry their weight in the family name, so the weight in a
 * style picks the file: Space Grotesk for money and figures (`numeric`), Plus Jakarta Sans for titles
 * (20 pt and up), Inter for everything else. Slate by default.
 */
export function Text({ style, numeric, ...props }: TextProps & { numeric?: boolean }) {
  const { fontWeight: _weight, ...flat } = StyleSheet.flatten([{ color: COLORS.text }, style]) ?? {};
  const weight = weightOf({ fontWeight: _weight });
  const family = numeric
    ? FONTS.numbers[weight]
    : (flat.fontSize ?? 14) >= 20
      ? FONTS.title[weight === 400 ? 500 : weight]
      : FONTS.body[weight];
  return <RNText {...props} style={[flat, { fontFamily: flat.fontFamily ?? family }]} />;
}
