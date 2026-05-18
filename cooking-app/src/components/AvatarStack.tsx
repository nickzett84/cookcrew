import { View } from 'react-native';
import { Avatar } from './Avatar';
import { colors } from '../theme';

type Cook = { name: string; color?: string };

type Props = {
  cooks: Cook[];
  size?: number;
  max?: number;
};

export function AvatarStack({ cooks, size = 22, max = 4 }: Props) {
  const visible = cooks.slice(0, max);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {visible.map((c, i) => (
        <View
          key={i}
          style={{
            marginLeft: i === 0 ? 0 : -size * 0.32,
            zIndex: visible.length - i,
            borderRadius: size / 2,
            borderWidth: 2,
            borderColor: colors.paper,
          }}
        >
          <Avatar name={c.name} color={c.color} size={size} />
        </View>
      ))}
    </View>
  );
}
