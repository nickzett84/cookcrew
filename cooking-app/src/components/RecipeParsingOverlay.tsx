import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { colors, fonts, sizes } from '../theme';

const STAGES = [
  'Uploading your recipe...',
  'Reading the recipe...',
  'Checking the ingredients...',
  'Splitting tasks...',
  'Almost ready...',
];

type Props = {
  visible: boolean;
};

export function RecipeParsingOverlay({ visible }: Props) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!visible) {
      setIdx(0);
      return;
    }
    const timer = setInterval(() => {
      setIdx((i) => (i + 1) % STAGES.length);
    }, 2400);
    return () => clearInterval(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <View
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: '#221d18',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <ActivityIndicator size="large" color={colors.sage} />
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: sizes.xl,
          color: colors.paper,
          letterSpacing: -0.3,
          marginTop: 24,
          textAlign: 'center',
          paddingHorizontal: 32,
        }}
      >
        {STAGES[idx]}
      </Text>
      <Text
        style={{
          fontFamily: fonts.body,
          fontSize: sizes.sm,
          color: '#cfc6b6',
          marginTop: 10,
          fontStyle: 'italic',
        }}
      >
        Hang tight, this can take a few seconds.
      </Text>
    </View>
  );
}
