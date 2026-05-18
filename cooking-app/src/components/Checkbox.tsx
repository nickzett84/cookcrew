import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

type Props = {
  checked: boolean;
  onToggle: () => void;
  size?: number;
  disabled?: boolean;
};

export function Checkbox({ checked, onToggle, size = 24, disabled }: Props) {
  return (
    <Pressable
      onPress={disabled ? undefined : onToggle}
      hitSlop={10}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: checked ? colors.sage : 'transparent',
        borderWidth: checked ? 0 : 1.5,
        borderColor: colors.lineSoft,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {checked && <Ionicons name="checkmark" size={size * 0.65} color={colors.paper} />}
    </Pressable>
  );
}
