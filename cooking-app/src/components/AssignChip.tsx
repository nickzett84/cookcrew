// Right-side affordance on each task / ingredient row. Doubles as the
// assignee display *and* the tap target to change the assignment.
//
// - Assigned: small color-tinted pill with the cook's first name.
// - Unassigned + can edit: dashed faint pill with "+ assign" (host) or
//   "+ take" (non-host).
// - Unassigned + can't edit: renders nothing.

import { View, Text, Pressable } from 'react-native';
import { colors, fonts, sizes, radius } from '../theme';
import type { Cook } from '../lib/api';

type Props = {
  assignee: Cook | null;
  canEdit: boolean;
  // 'host' for the cook list + remove picker; 'take' for instant claim-self.
  emptyLabel: 'assign' | 'take';
  onPress: () => void;
};

function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

export function AssignChip({ assignee, canEdit, emptyLabel, onPress }: Props) {
  if (!assignee && !canEdit) return null;

  if (assignee) {
    const inner = (
      <View
        style={{
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: radius.chip,
          backgroundColor: assignee.color,
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
        }}
      >
        <Text
          style={{
            fontFamily: fonts.bodyMed,
            fontSize: sizes.xs,
            color: colors.ink,
            letterSpacing: -0.1,
          }}
          numberOfLines={1}
        >
          {firstName(assignee.name)}
        </Text>
      </View>
    );
    return canEdit ? (
      <Pressable onPress={onPress} hitSlop={8}>
        {inner}
      </Pressable>
    ) : (
      inner
    );
  }

  // Empty + can edit.
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: radius.chip,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: colors.lineSoft,
        backgroundColor: 'transparent',
        opacity: pressed ? 0.6 : 1,
        alignSelf: 'flex-start',
      })}
    >
      <Text
        style={{
          fontFamily: fonts.bodyMed,
          fontSize: sizes.xs,
          color: colors.inkFaint,
          letterSpacing: -0.1,
        }}
      >
        {emptyLabel === 'assign' ? '+ assign' : '+ take'}
      </Text>
    </Pressable>
  );
}
