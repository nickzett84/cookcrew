import { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Btn } from '../components/Btn';
import { TopBar } from '../components/TopBar';
import { Avatar } from '../components/Avatar';
import { Chip } from '../components/Chip';
import { PeopleSheet } from './PeopleSheet';
import { colors, fonts, sizes, space } from '../theme';
import { RootStackParamList } from '../navigation/types';
import { useKitchen } from '../lib/kitchen';
import { api } from '../lib/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Lobby'>;

export function LobbyScreen({ navigation }: Props) {
  const { kitchen, cooks, meId, isHost, deviceId, recipe, leaveKitchen, endKitchen, reset } = useKitchen();
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  // Watch for the host ending the kitchen (realtime UPDATE → kitchen.status = 'ended').
  // Non-host cooks see the kitchen ended and bounce home with a toast-equivalent alert.
  useEffect(() => {
    if (kitchen?.status === 'ended' && !isHost) {
      reset();
      navigation.popToTop();
      Alert.alert('Kitchen wrapped', 'The head chef ended this kitchen.');
    }
  }, [kitchen?.status, isHost, reset, navigation]);

  // When the recipe goes live, every cook sitting in the Lobby auto-jumps
  // to the Cooking screen. Hosts get there explicitly via Review → Cooking;
  // this covers non-hosts and any rare case of landing on Lobby with an
  // already-active recipe.
  useEffect(() => {
    if (recipe?.status === 'active') {
      navigation.replace('Cooking');
    }
  }, [recipe?.status, navigation]);

  if (!kitchen) {
    navigation.replace('Landing');
    return null;
  }

  const onCopy = async () => {
    await Clipboard.setStringAsync(kitchen.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const onEnd = () => {
    Alert.alert(
      'End this kitchen?',
      'Anyone who joined will be sent back to the start.',
      [
        { text: 'Never mind', style: 'cancel' },
        {
          text: 'End kitchen',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await endKitchen();
              navigation.popToTop();
            } catch (e) {
              Alert.alert('Could not end kitchen', e instanceof Error ? e.message : 'Try again.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const onLeave = () => {
    Alert.alert(
      'Leave this kitchen?',
      'You can rejoin with the code anytime.',
      [
        { text: 'Never mind', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await leaveKitchen();
              navigation.popToTop();
            } catch (e) {
              Alert.alert('Could not leave', e instanceof Error ? e.message : 'Try again.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <TopBar
        kitchen={kitchen.name}
        cooks={cooks.map((c) => ({ name: c.name, color: c.color }))}
        onAvatarsPress={() => setPeopleOpen(true)}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 }}
      >
        {/* Share card */}
        <View
          style={{
            borderRadius: 16,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.lineSoft,
            padding: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: fonts.display,
                  fontSize: sizes.xs,
                  color: colors.inkSoft,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                }}
              >
                Share code
              </Text>
              <Text
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 30,
                  color: colors.ink,
                  letterSpacing: 4,
                  marginTop: 2,
                }}
              >
                {kitchen.code}
              </Text>
            </View>
            <Btn small kind="secondary" onPress={onCopy}>
              {copied ? 'Copied!' : 'Copy'}
            </Btn>
          </View>
          <Text style={{ fontFamily: fonts.body, fontSize: sizes.sm, color: colors.inkSoft, marginTop: 10 }}>
            Share this with your friends so they can join.
          </Text>
        </View>

        {/* Cooks list */}
        <View style={{ marginTop: 22 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <Text
              style={{
                fontFamily: fonts.display,
                fontSize: sizes.xs,
                color: colors.inkSoft,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
              }}
            >
              In the kitchen ({cooks.length})
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.sage }} />
              <Text style={{ fontFamily: fonts.body, fontSize: sizes.xs, color: colors.sage }}>live</Text>
            </View>
          </View>

          {cooks.map((c) => {
            const cookIsHost = c.id === kitchen.main_cook_id;
            return (
              <View
                key={c.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.lineSoft,
                }}
              >
                <Avatar name={c.name} color={c.color} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.display, fontSize: sizes.md, color: colors.ink }}>
                    {c.name} {c.id === meId && <Text style={{ color: colors.inkFaint }}>(you)</Text>}
                  </Text>
                  {cookIsHost && (
                    <Text style={{ fontFamily: fonts.body, fontSize: sizes.xs, color: colors.inkFaint, marginTop: 2 }}>
                      head chef
                    </Text>
                  )}
                </View>
                {cookIsHost && <Chip variant="soft">head chef</Chip>}
              </View>
            );
          })}

          {cooks.length === 1 && (
            <Text
              style={{
                fontFamily: fonts.body,
                fontSize: sizes.sm,
                color: colors.inkFaint,
                fontStyle: 'italic',
                textAlign: 'center',
                marginTop: 14,
              }}
            >
              Waiting for friends to join...
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Footer actions */}
      <View style={{ paddingHorizontal: 16, paddingBottom: space.lg, paddingTop: 8, gap: 8 }}>
        {isHost ? (
          <>
            <Btn full disabled={busy} onPress={() => navigation.navigate('RecipeImport')}>
              Import a recipe
            </Btn>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Pressable
                onPress={async () => {
                  if (!deviceId || !kitchen || busy) return;
                  setBusy(true);
                  try {
                    const parsed = await api.createManualRecipe({
                      kitchenId: kitchen.id,
                      deviceId,
                    });
                    navigation.navigate('RecipeReview', { parsed });
                  } catch (e) {
                    Alert.alert(
                      "Couldn't start a blank recipe",
                      e instanceof Error ? e.message : 'Try again.',
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
                hitSlop={8}
              >
                <Text style={{ fontFamily: fonts.bodyMed, fontSize: sizes.sm, color: colors.accent }}>
                  Type by hand
                </Text>
              </Pressable>
              <Pressable onPress={onEnd} hitSlop={8} disabled={busy}>
                <Text style={{ fontFamily: fonts.bodyMed, fontSize: sizes.sm, color: colors.accent, opacity: 0.7 }}>
                  End kitchen
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Text
              style={{
                fontFamily: fonts.body,
                fontSize: sizes.sm,
                color: colors.inkSoft,
                textAlign: 'center',
              }}
            >
              Hang tight. The head chef is still getting the recipe ready.
            </Text>
            <Pressable onPress={onLeave} hitSlop={8} style={{ alignSelf: 'center' }} disabled={busy}>
              <Text style={{ fontFamily: fonts.bodyMed, fontSize: sizes.sm, color: colors.accent, opacity: 0.7 }}>
                Leave kitchen
              </Text>
            </Pressable>
          </>
        )}
      </View>

      <PeopleSheet
        visible={peopleOpen}
        onClose={() => setPeopleOpen(false)}
        onEndKitchen={() => {
          setPeopleOpen(false);
          onEnd();
        }}
        onLeaveKitchen={() => {
          setPeopleOpen(false);
          onLeave();
        }}
      />
    </SafeAreaView>
  );
}
