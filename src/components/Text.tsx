import { Text as RNText, type TextProps } from 'react-native';
import { COLORS } from './theme';

/** App text: light on the dark backdrop unless a style says otherwise. */
export function Text({ style, ...props }: TextProps) {
  return <RNText {...props} style={[{ color: COLORS.text }, style]} />;
}
