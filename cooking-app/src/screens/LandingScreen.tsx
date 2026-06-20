import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Btn } from '../components/Btn';
import { HowItWorksSheet } from '../components/HowItWorksSheet';
import { colors, fonts, sizes, space } from '../theme';
import { RootStackParamList } from '../navigation/types';
import { OTA_VERSION } from '../version';

type Props = NativeStackScreenProps<RootStackParamList, 'Landing'>;

export function LandingScreen({ navigation }: Props) {
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={{ flex: 1, paddingHorizontal: 18, paddingTop: 30, paddingBottom: 20 }}>
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 32, color: colors.ink, letterSpacing: -0.5 }}>
            CookCrew
          </Text>
          <View style={{ height: 1, width: 56, backgroundColor: colors.accent, opacity: 0.6, marginVertical: 8 }} />
          <Text style={{ fontFamily: fonts.body, fontSize: sizes.sm, color: colors.inkSoft, fontStyle: 'italic' }}>
            Cook together, not alone.
          </Text>
        </View>

        <View style={{ flex: 1, justifyContent: 'center', gap: 14 }}>
          <Pressable
            onPress={() => navigation.navigate('CreateKitchen')}
            style={({ pressed }) => ({
              borderRadius: 16,
              padding: 22,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.lineSoft,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ fontFamily: fonts.display, fontSize: sizes.xxl, color: colors.accent, letterSpacing: -0.5 }}>
              I'm hosting
            </Text>
            <Text style={{ fontFamily: fonts.body, fontSize: sizes.md, color: colors.inkSoft, marginTop: 6 }}>
              Pick a recipe, invite friends.
            </Text>
            <Text style={{ fontFamily: fonts.bodyMed, fontSize: sizes.md, color: colors.accent, marginTop: 14 }}>
              Create kitchen →
            </Text>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('JoinKitchen')}
            style={({ pressed }) => ({
              borderRadius: 16,
              padding: 22,
              borderWidth: 1,
              borderColor: colors.lineSoft,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ fontFamily: fonts.display, fontSize: sizes.xxl, color: colors.ink, letterSpacing: -0.5 }}>
              I'm joining
            </Text>
            <Text style={{ fontFamily: fonts.body, fontSize: sizes.md, color: colors.inkSoft, marginTop: 6 }}>
              Got a 6-letter code from a friend.
            </Text>
            <Text style={{ fontFamily: fonts.bodyMed, fontSize: sizes.md, color: colors.ink, marginTop: 14 }}>
              Enter code →
            </Text>
          </Pressable>
        </View>

        <View style={{ alignItems: 'center', paddingTop: space.md }}>
          <Pressable
            onPress={() => setHowItWorksOpen(true)}
            hitSlop={12}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
          >
            <Text style={{ fontFamily: fonts.body, fontSize: sizes.xs, color: colors.accent }}>
              how does this work?
            </Text>
          </Pressable>
          <Text
            style={{
              fontFamily: fonts.body,
              fontSize: sizes.xs,
              color: colors.inkFaint,
              marginTop: 8,
            }}
          >
            {OTA_VERSION}
          </Text>
        </View>
      </View>

      <HowItWorksSheet visible={howItWorksOpen} onClose={() => setHowItWorksOpen(false)} />
    </SafeAreaView>
  );
}
