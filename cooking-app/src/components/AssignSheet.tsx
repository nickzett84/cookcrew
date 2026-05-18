// Host-only picker. Tap a cook → assigns. Tap "Remove assignment" → unassigns.
// Closes after either action. Non-hosts never see this sheet — they take
// unassigned items directly via a single tap on the chip.

import { Modal, View, Text, Pressable } from 'react-native';
import { Avatar } from './Avatar';
import { colors, fonts, sizes, space } from '../theme';
import type { Cook } from '../lib/api';

type Props = {
  visible: boolean;
  onClose: () => void;
  cooks: Cook[];
  currentAssignee: string | null;
  itemLabel: string; // shown under the heading, e.g. "Chop carrots"
  onAssign: (cookId: string) => void;
  onUnassign: () => void;
};

export function AssignSheet({
  visible,
  onClose,
  cooks,
  currentAssignee,
  itemLabel,
  onAssign,
  onUnassign,
}: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(40,30,20,0.4)', justifyContent: 'flex-end' }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.paper,
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: space.xxl,
          }}
        >
          <View
            style={{
              width: 40,
              height: 4,
              backgroundColor: colors.lineSoft,
              borderRadius: 4,
              alignSelf: 'center',
              marginBottom: 12,
            }}
          />

          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: sizes.xl,
              color: colors.ink,
              letterSpacing: -0.3,
            }}
          >
            Assign to…
          </Text>
          <Text
            style={{
              fontFamily: fonts.body,
              fontSize: sizes.sm,
              color: colors.inkSoft,
              marginTop: 2,
              marginBottom: 12,
            }}
            numberOfLines={2}
          >
            {itemLabel}
          </Text>

          {cooks.map((c) => {
            const selected = c.id === currentAssignee;
            return (
              <Pressable
                key={c.id}
                onPress={() => onAssign(c.id)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 10,
                  paddingHorizontal: 8,
                  borderRadius: 10,
                  backgroundColor: selected ? colors.surface : 'transparent',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Avatar name={c.name} color={c.color} size={36} />
                <Text
                  style={{
                    flex: 1,
                    fontFamily: fonts.bodyMed,
                    fontSize: sizes.md,
                    color: colors.ink,
                  }}
                  numberOfLines={1}
                >
                  {c.name}
                </Text>
                {selected && (
                  <Text style={{ fontFamily: fonts.body, fontSize: sizes.xs, color: colors.inkFaint }}>
                    current
                  </Text>
                )}
              </Pressable>
            );
          })}

          {currentAssignee && (
            <Pressable
              onPress={onUnassign}
              style={({ pressed }) => ({
                marginTop: 12,
                paddingVertical: 12,
                alignItems: 'center',
                borderTopWidth: 1,
                borderTopColor: colors.lineSoft,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text
                style={{
                  fontFamily: fonts.bodyMed,
                  fontSize: sizes.md,
                  color: colors.accent,
                }}
              >
                Remove assignment
              </Text>
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
