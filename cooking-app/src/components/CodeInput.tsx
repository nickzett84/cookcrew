import { useRef } from 'react';
import { Pressable, View, Text, TextInput, Keyboard } from 'react-native';
import { colors, fonts } from '../theme';

type Props = {
  value: string;
  onChange: (v: string) => void;
  length?: number;
};

export function CodeInput({ value, onChange, length = 6 }: Props) {
  const ref = useRef<TextInput>(null);
  const focus = () => ref.current?.focus();

  const slots = Array.from({ length }, (_, i) => value[i] ?? '');
  // Highlight the next slot to be filled (or the last filled one if full)
  const cursorIdx = Math.min(value.length, length - 1);

  return (
    <Pressable onPress={focus}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}>
        {slots.map((char, i) => {
          const filled = char.length > 0;
          const active = i === cursorIdx && value.length < length;
          return (
            <View
              key={i}
              style={{
                flex: 1,
                aspectRatio: 1,
                maxWidth: 48,
                borderRadius: 10,
                borderWidth: active ? 2 : 1.5,
                borderColor: active ? colors.ink : filled ? colors.ink : colors.lineSoft,
                backgroundColor: colors.paper,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 22,
                  color: filled ? colors.ink : colors.inkFaint,
                  letterSpacing: -0.5,
                }}
              >
                {char}
              </Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => onChange(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, length))}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        keyboardType="default"
        maxLength={length}
        onSubmitEditing={() => Keyboard.dismiss()}
        style={{
          position: 'absolute',
          opacity: 0,
          width: 1,
          height: 1,
        }}
      />
    </Pressable>
  );
}
