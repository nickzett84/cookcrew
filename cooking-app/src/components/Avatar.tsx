import { View, Text } from 'react-native';
import { colors, fonts, cookPalette } from '../theme';

type Props = {
  name: string;
  color?: string;
  size?: number;
};

export function Avatar({ name, color, size = 32 }: Props) {
  const fallbackIdx = (name.charCodeAt(0) || 0) % cookPalette.length;
  const bg = color ?? cookPalette[fallbackIdx];
  const initial = name[0]?.toUpperCase() ?? '?';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontFamily: fonts.display,
          color: colors.ink,
          fontSize: size * 0.42,
          letterSpacing: -0.2,
        }}
      >
        {initial}
      </Text>
    </View>
  );
}
