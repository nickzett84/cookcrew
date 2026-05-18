import { ReactNode } from 'react';
import { View, Text, ViewStyle, StyleProp } from 'react-native';
import { colors, fonts, sizes, radius } from '../theme';

type Props = {
  children: ReactNode;
  variant?: 'accent' | 'ghost' | 'soft';
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export function Chip({ children, variant = 'soft', color, style }: Props) {
  const bg =
    color ? color :
    variant === 'ghost' ? 'transparent' :
    variant === 'accent' ? colors.accent :
    colors.fillSoft;
  const fg = color ? colors.ink : variant === 'accent' ? colors.paper : colors.ink;
  const borderColor = variant === 'ghost' ? colors.lineSoft : 'transparent';

  return (
    <View
      style={[
        {
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: radius.chip,
          backgroundColor: bg,
          borderWidth: 1,
          borderColor,
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
        },
        style,
      ]}
    >
      <Text
        style={{
          fontFamily: fonts.bodyMed,
          fontSize: sizes.xs,
          color: fg,
          letterSpacing: -0.1,
        }}
      >
        {children}
      </Text>
    </View>
  );
}
