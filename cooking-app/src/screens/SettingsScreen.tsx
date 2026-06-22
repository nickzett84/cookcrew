import { useState } from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, fonts, sizes, space } from '../theme';
import { RootStackParamList } from '../navigation/types';
import { SignInButtons } from '../components/SignInButtons';
import { useAuth } from '../lib/auth';
import { useKitchen } from '../lib/kitchen';
import { OTA_VERSION } from '../version';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const { ready, session, email, signOut, deleteAccount } = useAuth();
  const { kitchen } = useKitchen();
  const [busy, setBusy] = useState(false);

  const inActiveKitchen = kitchen?.status === 'active';

  const onSignOut = () => {
    Alert.alert('Sign out?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        onPress: async () => {
          setBusy(true);
          try {
            await signOut();
          } catch (e) {
            Alert.alert("Couldn't sign out", e instanceof Error ? e.message : 'Try again.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const onDelete = () => {
    if (inActiveKitchen) {
      Alert.alert(
        "You're in an active kitchen",
        'Leave or wrap up your kitchen before deleting your account.',
      );
      return;
    }
    Alert.alert(
      'Delete account?',
      "This permanently removes your account. Kitchens you've hosted stay, but are no longer linked to you. This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await deleteAccount();
              navigation.popToTop();
            } catch (e) {
              Alert.alert("Couldn't delete account", e instanceof Error ? e.message : 'Try again.');
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
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={colors.inkSoft} />
        </Pressable>
        <Text style={{ fontFamily: fonts.display, fontSize: sizes.xl, color: colors.ink }}>
          Settings
        </Text>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }}>
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: sizes.xs,
            color: colors.inkFaint,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Account
        </Text>

        {!ready ? (
          <ActivityIndicator color={colors.accent} style={{ alignSelf: 'flex-start' }} />
        ) : session ? (
          <>
            <Text style={{ fontFamily: fonts.body, fontSize: sizes.md, color: colors.ink }}>
              Signed in{email ? ` as ${email}` : ''}
            </Text>

            <Pressable
              onPress={onSignOut}
              disabled={busy}
              style={({ pressed }) => ({ paddingVertical: 14, opacity: pressed || busy ? 0.5 : 1 })}
            >
              <Text style={{ fontFamily: fonts.bodyMed, fontSize: sizes.md, color: colors.accent }}>
                Sign out
              </Text>
            </Pressable>

            <Pressable
              onPress={onDelete}
              disabled={busy}
              style={({ pressed }) => ({ paddingVertical: 14, opacity: pressed || busy ? 0.5 : 1 })}
            >
              <Text style={{ fontFamily: fonts.bodyMed, fontSize: sizes.md, color: colors.accent }}>
                Delete account
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text
              style={{
                fontFamily: fonts.body,
                fontSize: sizes.md,
                color: colors.inkSoft,
                lineHeight: 22,
                marginBottom: 20,
              }}
            >
              Sign in to host a kitchen. Joining a friend's kitchen with a code never needs an account.
            </Text>
            <SignInButtons />
          </>
        )}
      </View>

      <Text
        style={{
          fontFamily: fonts.body,
          fontSize: sizes.xs,
          color: colors.inkFaint,
          textAlign: 'center',
          paddingBottom: space.md,
        }}
      >
        {OTA_VERSION}
      </Text>
    </SafeAreaView>
  );
}
