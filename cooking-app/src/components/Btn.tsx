import { Pressable, Text, ViewStyle, StyleProp } from 'react-native';
import { colors, fonts, radius, sizes } from '../theme';

type Kind = 'primary' | 'secondary' | 'tertiary';

type Props = {
  children: string;
  onPress?: () => void;
  kind?: Kind;
  full?: boolean;
  small?: boolean;
  sage?: boolean;
  danger?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Btn({ children, onPress, kind = 'primary', full, small, sage, danger, disabled, style }: Props) {
  const isFilled = kind === 'primary' || sage || danger;
  const bg =
    disabled ? colors.fill :
    sage ? colors.sage :
    danger ? colors.accent :
    kind === 'primary' ? colors.ink :
    'transparent';
  const fg =
    disabled ? colors.inkFaint :
    isFilled ? colors.paper :
    colors.ink;
  const border =
    kind === 'secondary' ? colors.line :
    'transparent';

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        {
          alignSelf: full ? 'stretch' : 'flex-start',
          height: small ? 36 : 52,
          paddingHorizontal: small ? 16 : 22,
          borderRadius: small ? 12 : radius.button,
          backgroundColor: bg,
          borderWidth: kind === 'secondary' ? 1 : 0,
          borderColor: border,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          opacity: pressed ? 0.85 : 1,
          transform: [{ translateY: pressed ? 1 : 0 }],
        },
        style,
      ]}
    >
      <Text
        style={{
          fontFamily: fonts.display,
          color: fg,
          fontSize: small ? sizes.sm : sizes.md,
          letterSpacing: -0.1,
        }}
      >
        {children}
      </Text>
    </Pressable>
  );
}
