import { useState } from 'react';
import { View, Text, Pressable, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Btn } from '../components/Btn';
import { Avatar } from '../components/Avatar';
import { Input } from '../components/Input';
import { colors, fonts, sizes, cookPalette, space } from '../theme';
import { RootStackParamList } from '../navigation/types';
import { useKitchen } from '../lib/kitchen';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateKitchen'>;

export function CreateKitchenScreen({ navigation }: Props) {
  const { ready, createKitchen } = useKitchen();
  const [name, setName] = useState('');
  const [colorIdx, setColorIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const trimmed = name.trim();
  const valid = trimmed.length >= 2 && ready && !submitting;

  const onCreate = async () => {
    if (!valid) return;
    setSubmitting(true);
    try {
      await createKitchen(trimmed, cookPalette[colorIdx]);
      navigation.navigate('Lobby');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not create the kitchen.';
      Alert.alert("Couldn't create kitchen", msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, paddingHorizontal: 18, paddingTop: 8 }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{ alignSelf: 'flex-start' }}>
            <Ionicons name="chevron-back" size={28} color={colors.inkSoft} />
          </Pressable>

          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: sizes.xxl,
              color: colors.ink,
              letterSpacing: -0.5,
              marginTop: 18,
            }}
          >
            Hi! Who are you?
          </Text>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 12,
              backgroundColor: colors.surface,
              borderRadius: 12,
              marginTop: 18,
            }}
          >
            <Avatar name={trimmed || '?'} color={cookPalette[colorIdx]} size={42} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: sizes.md, color: colors.ink }}>
                {trimmed || 'Your name'}
              </Text>
              <Text style={{ fontFamily: fonts.body, fontSize: sizes.xs, color: colors.inkFaint, marginTop: 2 }}>
                this is how friends see you
              </Text>
            </View>
          </View>

          <View style={{ marginTop: space.xl }}>
            <Input
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="Nick"
              autoCapitalize="words"
              autoFocus
              maxLength={20}
              returnKeyType="done"
              onSubmitEditing={onCreate}
            />
          </View>

          <View style={{ marginTop: space.xl }}>
            <Text
              style={{
                fontFamily: fonts.display,
                fontSize: sizes.xs,
                color: colors.inkSoft,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              Avatar color
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {cookPalette.map((c, i) => {
                const selected = i === colorIdx;
                return (
                  <Pressable key={c} onPress={() => setColorIdx(i)} hitSlop={6}>
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: c,
                        borderWidth: selected ? 2.5 : 1,
                        borderColor: selected ? colors.ink : colors.lineSoft,
                      }}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ flex: 1 }} />
          <View style={{ paddingBottom: space.lg }}>
            <Btn full disabled={!valid} onPress={onCreate}>
              {submitting ? 'Creating...' : 'Create kitchen'}
            </Btn>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
