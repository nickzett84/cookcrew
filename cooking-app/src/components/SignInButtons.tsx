import { useState } from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, sizes, radius } from '../theme';
import { useAuth } from '../lib/auth';

// Apple + Google sign-in buttons. Sign-in success flips the AuthProvider
// session, so consumers react to that (navigate, re-render) rather than needing
// a callback here. Cancels resolve silently; real failures show an alert.
export function SignInButtons() {
  const { signInWithApple, signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      Alert.alert("Couldn't sign in", e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 12, opacity: busy ? 0.6 : 1 }}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={radius.button}
        style={{ height: 50, width: '100%' }}
        onPress={() => run(signInWithApple)}
      />

      <Pressable
        onPress={() => run(signInWithGoogle)}
        disabled={busy}
        style={({ pressed }) => ({
          height: 50,
          borderRadius: radius.button,
          borderWidth: 1,
          borderColor: colors.lineSoft,
          backgroundColor: colors.paper,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Ionicons name="logo-google" size={18} color={colors.ink} />
        <Text style={{ fontFamily: fonts.bodyMed, fontSize: sizes.md, color: colors.ink }}>
          Continue with Google
        </Text>
      </Pressable>

      {busy && (
        <ActivityIndicator color={colors.accent} style={{ position: 'absolute', alignSelf: 'center', top: 56 }} />
      )}
    </View>
  );
}
