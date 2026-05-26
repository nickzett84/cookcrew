import { useRef, useState } from 'react';
import { Pressable, View, Text, TextInput, Keyboard } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { colors, fonts } from '../theme';

type Props = {
  value: string;
  onChange: (v: string) => void;
  length?: number;
};

const sanitize = (raw: string, length: number) =>
  raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, length);

export function CodeInput({ value, onChange, length = 6 }: Props) {
  const ref = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const focus = () => ref.current?.focus();

  // Long-press anywhere on the input → read clipboard and fill. iOS users
  // expect long-press to mean "paste" on text fields; the hidden TextInput
  // doesn't surface the system paste menu (it's 1×1px and invisible), so we
  // wire it up explicitly.
  const handleLongPress = async () => {
    const raw = await Clipboard.getStringAsync();
    if (!raw) return;
    const clean = sanitize(raw, length);
    if (clean.length === 0) return;
    onChange(clean);
    focus();
  };

  const slots = Array.from({ length }, (_, i) => value[i] ?? '');
  const cursorIdx = Math.min(value.length, length - 1);

  return (
    <Pressable onPress={focus} onLongPress={handleLongPress} delayLongPress={350}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}>
        {slots.map((char, i) => {
          const filled = char.length > 0;
          const active = focused && i === cursorIdx && value.length < length;
          return (
            <View
              key={i}
              style={{
                flex: 1,
                aspectRatio: 1,
                maxWidth: 48,
                borderRadius: 10,
                borderWidth: active ? 2.5 : 1.5,
                borderColor: active
                  ? colors.accent
                  : filled
                  ? colors.ink
                  : colors.lineSoft,
                backgroundColor: active ? colors.accentSoft : colors.paper,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {active && !filled ? (
                <View
                  style={{
                    width: 2,
                    height: 24,
                    backgroundColor: colors.accent,
                    borderRadius: 1,
                  }}
                />
              ) : (
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
              )}
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => onChange(sanitize(t, length))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
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
