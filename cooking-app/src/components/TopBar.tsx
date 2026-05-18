import { ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';
import { AvatarStack } from './AvatarStack';
import { colors, fonts, sizes, space } from '../theme';

type Cook = { name: string; color?: string };

type Props = {
  kitchen: string;
  cooks: Cook[];
  right?: ReactNode;
  onAvatarsPress?: () => void;
};

export function TopBar({ kitchen, cooks, right, onAvatarsPress }: Props) {
  return (
    <View
      style={{
        paddingHorizontal: space.lg,
        paddingTop: space.xs,
        paddingBottom: space.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: colors.lineSoft,
      }}
    >
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: sizes.lg,
          color: colors.ink,
          letterSpacing: -0.3,
        }}
        numberOfLines={1}
      >
        {kitchen}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={onAvatarsPress} hitSlop={8}>
          <AvatarStack cooks={cooks} size={28} />
        </Pressable>
        {right}
      </View>
    </View>
  );
}
