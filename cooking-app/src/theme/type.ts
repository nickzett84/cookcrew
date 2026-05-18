// Geist throughout, loaded via @expo-google-fonts. Font family strings match
// the keys returned by `useFonts` in App.tsx — keep them in sync.

export const fonts = {
  display: 'Geist_600SemiBold',
  body:    'Geist_400Regular',
  bodyMed: 'Geist_500Medium',
  mono:    'GeistMono_500Medium',
} as const;

export const sizes = {
  xs: 11, sm: 12, md: 14, lg: 16, xl: 20, xxl: 28, xxxl: 36,
} as const;

export const weights = {
  reg: '400',
  med: '500',
  semi: '600',
} as const;
