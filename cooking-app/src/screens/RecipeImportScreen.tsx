import { useState } from 'react';
import { View, Text, Pressable, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RecipeParsingOverlay } from '../components/RecipeParsingOverlay';
import { CodeChip } from '../components/CodeChip';
import { AvatarStack } from '../components/AvatarStack';
import { PeopleSheet } from './PeopleSheet';
import { colors, fonts, sizes, space } from '../theme';
import { RootStackParamList } from '../navigation/types';
import { useKitchen } from '../lib/kitchen';
import { uploadRecipeFile } from '../lib/uploads';
import { api } from '../lib/api';

type Props = NativeStackScreenProps<RootStackParamList, 'RecipeImport'>;

const PARSING_MIN_MS = 800; // hold the parsing overlay so it doesn't flash on fast parses

export function RecipeImportScreen({ navigation }: Props) {
  const { kitchen, deviceId, cooks, endKitchen, leaveKitchen } = useKitchen();
  const [parsing, setParsing] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);

  if (!kitchen || !deviceId) {
    navigation.replace('Landing');
    return null;
  }

  const runImport = async (uri: string, contentType: string, sourceType: 'photo' | 'pdf') => {
    setParsing(true);
    const startedAt = Date.now();
    try {
      const sourcePath = await uploadRecipeFile(kitchen.id, uri, contentType);
      const parsed = await api.parseRecipe({
        kitchenId: kitchen.id,
        sourcePath,
        sourceType,
        deviceId,
      });
      // Hold the overlay for at least PARSING_MIN_MS so a sub-second response
      // doesn't feel jumpy (per design handoff §6.7).
      const elapsed = Date.now() - startedAt;
      if (elapsed < PARSING_MIN_MS) {
        await new Promise((r) => setTimeout(r, PARSING_MIN_MS - elapsed));
      }
      navigation.replace('RecipeReview', { parsed });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong.';
      Alert.alert(
        "Couldn't read that recipe",
        msg,
        [
          { text: 'Try again', style: 'default' },
          {
            text: 'Type it out instead',
            onPress: async () => {
              try {
                const parsedManual = await api.createManualRecipe({
                  kitchenId: kitchen.id,
                  deviceId,
                });
                navigation.replace('RecipeReview', { parsed: parsedManual });
              } catch (e2) {
                Alert.alert(
                  "Couldn't start a blank recipe",
                  e2 instanceof Error ? e2.message : 'Try again.',
                );
              }
            },
          },
        ],
      );
    } finally {
      setParsing(false);
    }
  };

  const onTakePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera off', 'Allow camera access in Settings to snap a recipe.');
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.9,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      await runImport(asset.uri, asset.mimeType ?? 'image/jpeg', 'photo');
    } catch {
      Alert.alert(
        'Camera unavailable',
        "The simulator doesn't have a camera — try Choose from photo library, or run on a real iPhone.",
      );
    }
  };

  const onPickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Library off', 'Allow photo library access in Settings to pick a recipe.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      allowsEditing: false,
      selectionLimit: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await runImport(asset.uri, asset.mimeType ?? 'image/jpeg', 'photo');
  };

  const onPickPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await runImport(asset.uri, asset.mimeType ?? 'application/pdf', 'pdf');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={{ flex: 1, paddingHorizontal: 18, paddingTop: 8 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            disabled={parsing}
          >
            <Ionicons name="chevron-back" size={28} color={colors.inkSoft} />
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <CodeChip code={kitchen.code} />
            <Pressable onPress={() => setPeopleOpen(true)} hitSlop={6}>
              <AvatarStack
                cooks={cooks.map((c) => ({ name: c.name, color: c.color }))}
                size={28}
              />
            </Pressable>
          </View>
        </View>

        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: sizes.xxl,
            color: colors.ink,
            letterSpacing: -0.5,
            marginTop: 18,
          }}
        >
          What are we cooking?
        </Text>
        <Text style={{ fontFamily: fonts.body, fontSize: sizes.md, color: colors.inkSoft, marginTop: 6 }}>
          Snap a cookbook page or pick a PDF — Claude will turn it into a checklist.
        </Text>

        <ScrollView style={{ flex: 1, marginTop: space.xl }} contentContainerStyle={{ gap: 12 }}>
          <ImportCard
            icon="camera-outline"
            title="Take a photo"
            sub="Snap your cookbook page"
            onPress={onTakePhoto}
            disabled={parsing}
          />
          <ImportCard
            icon="image-outline"
            title="Choose from photo library"
            sub="Pick a photo you already have"
            onPress={onPickFromLibrary}
            disabled={parsing}
          />
          <ImportCard
            icon="document-outline"
            title="Upload a PDF"
            sub="For digital recipes"
            onPress={onPickPdf}
            disabled={parsing}
          />
        </ScrollView>

        <View style={{ alignItems: 'center', paddingBottom: space.lg, paddingTop: space.md }}>
          <Pressable
            hitSlop={8}
            onPress={async () => {
              if (parsing) return;
              try {
                const parsedManual = await api.createManualRecipe({
                  kitchenId: kitchen.id,
                  deviceId,
                });
                navigation.replace('RecipeReview', { parsed: parsedManual });
              } catch (e) {
                Alert.alert(
                  "Couldn't start a blank recipe",
                  e instanceof Error ? e.message : 'Try again.',
                );
              }
            }}
            disabled={parsing}
          >
            <Text style={{ fontFamily: fonts.bodyMed, fontSize: sizes.sm, color: colors.accent }}>
              Type it out instead
            </Text>
          </Pressable>
        </View>
      </View>

      <RecipeParsingOverlay visible={parsing} />

      <PeopleSheet
        visible={peopleOpen}
        onClose={() => setPeopleOpen(false)}
        onEndKitchen={() => {
          setPeopleOpen(false);
          Alert.alert(
            'End this kitchen?',
            'Anyone who joined will be sent back to the start.',
            [
              { text: 'Never mind', style: 'cancel' },
              {
                text: 'End kitchen',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await endKitchen();
                    navigation.popToTop();
                  } catch (e) {
                    Alert.alert(
                      'Could not end kitchen',
                      e instanceof Error ? e.message : 'Try again.',
                    );
                  }
                },
              },
            ],
          );
        }}
        onLeaveKitchen={() => {
          setPeopleOpen(false);
          Alert.alert(
            'Leave this kitchen?',
            'You can rejoin with the code anytime.',
            [
              { text: 'Never mind', style: 'cancel' },
              {
                text: 'Leave',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await leaveKitchen();
                    navigation.popToTop();
                  } catch (e) {
                    Alert.alert(
                      'Could not leave',
                      e instanceof Error ? e.message : 'Try again.',
                    );
                  }
                },
              },
            ],
          );
        }}
      />
    </SafeAreaView>
  );
}

type CardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  onPress: () => void;
  disabled?: boolean;
};

function ImportCard({ icon, title, sub, onPress, disabled }: CardProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.lineSoft,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        backgroundColor: colors.paper,
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: colors.fill,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={22} color={colors.ink} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: sizes.md, color: colors.ink }}>{title}</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: sizes.sm, color: colors.inkSoft, marginTop: 2 }}>
          {sub}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.inkFaint} />
    </Pressable>
  );
}
