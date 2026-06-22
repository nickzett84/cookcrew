import { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SignInButtons } from '../components/SignInButtons';
import { colors, fonts, sizes, space } from '../theme';
import { RootStackParamList } from '../navigation/types';
import { useAuth } from '../lib/auth';

type Props = NativeStackScreenProps<RootStackParamList, 'SignIn'>;

// Gate in front of creating a kitchen: the head chef must sign in (they consume
// the recipe parsing). Once a session exists, continue to CreateKitchen. Guests
// never see this — joining by code stays anonymous.
export function SignInScreen({ navigation }: Props) {
  const { session } = useAuth();

  useEffect(() => {
    if (session) navigation.replace('CreateKitchen');
  }, [session, navigation]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={colors.inkSoft} />
        </Pressable>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center', gap: 10 }}>
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: sizes.xxl,
            color: colors.ink,
            letterSpacing: -0.4,
          }}
        >
          Sign in to start a kitchen
        </Text>
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: sizes.md,
            color: colors.inkSoft,
            lineHeight: 22,
            marginBottom: space.lg,
          }}
        >
          You only need an account to host. Friends joining your kitchen with a code never have to sign in.
        </Text>

        <SignInButtons />
      </View>
    </SafeAreaView>
  );
}
