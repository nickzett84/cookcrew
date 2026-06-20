import { useRef, useState } from 'react';
import { Pressable, View, Text, TextInput, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { colors, fonts, sizes } from '../theme';

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

  // Read the clipboard, sanitize, fill the slots. Wired up to both the
  // long-press gesture on the slots and the explicit "Paste from clipboard"
  // button below — long-press is the native iOS expectation, the button is
  // the discoverable hint for everyone else.
  const handlePaste = async () => {
    const raw = await Clipboard.getStringAsync();
    if (!raw) return;
    const clean = sanitize(raw, length);
    if (clean.length === 0) return;
    onChange(clean);
    focus();
  };

  const slots = Array.from({ length }, (_, i) => value[i] ?? '');
  // When the code is partially typed, the cursor sits on the first empty
  // slot. When fully typed, it parks on the last slot so the user can see
  // they're still "in" the input and can backspace from there.
  const cursorIdx = Math.min(value.length, length - 1);

  return (
    <View>
      <Pressable onPress={focus} onLongPress={handlePaste} delayLongPress={350}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}>
          {slots.map((char, i) => {
            const filled = char.length > 0;
            const active = focused && i === cursorIdx;
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

      <Pressable
        onPress={handlePaste}
        hitSlop={8}
        style={({ pressed }) => ({
          alignSelf: 'center',
          marginTop: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: 6,
          paddingHorizontal: 10,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Ionicons name="clipboard-outline" size={14} color={colors.accent} />
        <Text style={{ fontFamily: fonts.bodyMed, fontSize: sizes.sm, color: colors.accent }}>
          Paste from clipboard
        </Text>
      </Pressable>
    </View>
  );
}
