import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { colors, fonts, sizes } from '../theme';

type Props = {
  code: string;
};

export function CodeChip({ code }: Props) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Pressable
      onPress={onCopy}
      hitSlop={6}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.lineSoft,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons
        name={copied ? 'checkmark' : 'copy-outline'}
        size={12}
        color={copied ? colors.sage : colors.inkSoft}
      />
      <Text
        style={{
          fontFamily: fonts.mono,
          fontSize: sizes.sm,
          color: colors.ink,
          letterSpacing: 1,
        }}
      >
        {copied ? 'Copied' : code}
      </Text>
    </Pressable>
  );
}
