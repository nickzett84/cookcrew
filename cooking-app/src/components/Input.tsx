import { TextInput, View, Text, TextInputProps } from 'react-native';
import { colors, fonts, sizes } from '../theme';

type Props = TextInputProps & {
  label?: string;
};

export function Input({ label, style, ...rest }: Props) {
  return (
    <View>
      {label && (
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: sizes.xs,
            color: colors.inkSoft,
            letterSpacing: 0.6,
            marginBottom: 6,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </Text>
      )}
      <TextInput
        placeholderTextColor={colors.inkFaint}
        style={[
          {
            height: 52,
            paddingHorizontal: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.lineSoft,
            backgroundColor: colors.paper,
            fontFamily: fonts.body,
            fontSize: sizes.lg,
            color: colors.ink,
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}
