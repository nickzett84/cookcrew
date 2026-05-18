// Slides in from top when a task or ingredient gets assigned to me.
// Auto-dismisses after 4s; tap to handle (parent decides — we jump to Mine).

import { useEffect, useRef } from 'react';
import { Animated, Easing, View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from './Avatar';
import { colors, fonts, sizes } from '../theme';

type Props = {
  visible: boolean;
  assignerName: string;
  assignerColor: string;
  description: string;
  onPress: () => void;
  onDismiss: () => void;
};

export function DelegationBanner({
  visible,
  assignerName,
  assignerColor,
  description,
  onPress,
  onDismiss,
}: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-160)).current;
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      if (dismissRef.current) clearTimeout(dismissRef.current);
      dismissRef.current = setTimeout(() => {
        Animated.timing(translateY, {
          toValue: -160,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }).start(() => onDismiss());
      }, 4000);
    } else {
      Animated.timing(translateY, {
        toValue: -160,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
    return () => {
      if (dismissRef.current) clearTimeout(dismissRef.current);
    };
  }, [visible, onDismiss, translateY]);

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={{
        position: 'absolute',
        top: insets.top,
        left: 0,
        right: 0,
        paddingHorizontal: 12,
        paddingTop: 8,
        zIndex: 100,
        transform: [{ translateY }],
      }}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 12,
          backgroundColor: colors.paper,
          borderRadius: 12,
          borderLeftWidth: 4,
          borderLeftColor: colors.accent,
          borderTopWidth: 1,
          borderTopColor: colors.lineSoft,
          borderRightWidth: 1,
          borderRightColor: colors.lineSoft,
          borderBottomWidth: 1,
          borderBottomColor: colors.lineSoft,
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Avatar name={assignerName} color={assignerColor} size={36} />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: fonts.bodyMed,
              fontSize: sizes.sm,
              color: colors.inkSoft,
            }}
            numberOfLines={1}
          >
            {assignerName} gave you
          </Text>
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: sizes.md,
              color: colors.ink,
              marginTop: 1,
            }}
            numberOfLines={2}
          >
            {description}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}
