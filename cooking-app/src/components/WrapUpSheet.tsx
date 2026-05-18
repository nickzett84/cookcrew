import { useState } from 'react';
import { Modal, View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, sizes, space } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onEnd: () => Promise<void>;
  tasksDone: number;
  tasksTotal: number;
  itemsBought: number;
  itemsTotal: number;
  cooksCount: number;
};

export function WrapUpSheet({
  visible,
  onClose,
  onEnd,
  tasksDone,
  tasksTotal,
  itemsBought,
  itemsTotal,
  cooksCount,
}: Props) {
  const [ending, setEnding] = useState(false);
  const allTasksDone = tasksTotal === 0 || tasksDone === tasksTotal;
  const tasksLeft = Math.max(0, tasksTotal - tasksDone);

  const handleEnd = async () => {
    setEnding(true);
    try {
      await onEnd();
    } finally {
      setEnding(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        onPress={ending ? undefined : onClose}
        style={{ flex: 1, backgroundColor: 'rgba(40,30,20,0.4)', justifyContent: 'flex-end' }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.paper,
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            paddingHorizontal: 20,
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
              marginBottom: 14,
            }}
          />

          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: sizes.xxl,
              color: colors.ink,
              letterSpacing: -0.4,
            }}
          >
            All done?
          </Text>
          <Text
            style={{
              fontFamily: fonts.body,
              fontSize: sizes.sm,
              color: colors.inkSoft,
              marginTop: 4,
              lineHeight: 20,
            }}
          >
            This will end the kitchen for everyone.
          </Text>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            <Stat
              icon="checkmark-done-outline"
              value={tasksDone}
              label={tasksDone === 1 ? 'task done' : 'tasks done'}
              celebratory={allTasksDone && tasksTotal > 0}
            />
            <Stat
              icon="basket-outline"
              value={itemsBought}
              label={itemsBought === 1 ? 'item bought' : 'items bought'}
              celebratory={itemsTotal > 0 && itemsBought === itemsTotal}
            />
            <Stat
              icon="people-outline"
              value={cooksCount}
              label={cooksCount === 1 ? 'cook' : 'cooks'}
            />
          </View>

          {!allTasksDone && (
            <View
              style={{
                marginTop: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingVertical: 10,
                paddingHorizontal: 12,
                backgroundColor: colors.fillSoft,
                borderRadius: 10,
              }}
            >
              <Ionicons name="alert-circle-outline" size={16} color={colors.ochre} />
              <Text
                style={{
                  flex: 1,
                  fontFamily: fonts.body,
                  fontSize: sizes.sm,
                  color: colors.inkSoft,
                  lineHeight: 20,
                }}
              >
                Heads up — {tasksLeft} task{tasksLeft === 1 ? '' : 's'} still unchecked.
              </Text>
            </View>
          )}

          <Pressable
            onPress={handleEnd}
            disabled={ending}
            style={({ pressed }) => ({
              marginTop: 20,
              backgroundColor: colors.accent,
              borderRadius: 16,
              paddingVertical: 14,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: ending ? 0.7 : pressed ? 0.85 : 1,
              flexDirection: 'row',
              gap: 8,
            })}
          >
            {ending && <ActivityIndicator color={colors.paper} size="small" />}
            <Text style={{ fontFamily: fonts.bodyMed, fontSize: sizes.md, color: colors.paper }}>
              {ending ? 'Wrapping up…' : 'End kitchen'}
            </Text>
          </Pressable>

          <Pressable
            onPress={onClose}
            disabled={ending}
            style={({ pressed }) => ({
              marginTop: 8,
              paddingVertical: 14,
              alignItems: 'center',
              opacity: ending ? 0.4 : pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ fontFamily: fonts.bodyMed, fontSize: sizes.md, color: colors.ink }}>
              Keep cooking
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Stat({
  icon,
  value,
  label,
  celebratory,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  celebratory?: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: celebratory ? colors.sageSoft : colors.surface,
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 8,
        alignItems: 'center',
      }}
    >
      <Ionicons
        name={icon}
        size={20}
        color={celebratory ? colors.sage : colors.inkSoft}
      />
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: sizes.xl,
          color: colors.ink,
          marginTop: 4,
          letterSpacing: -0.3,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontFamily: fonts.body,
          fontSize: sizes.xs,
          color: colors.inkSoft,
          marginTop: 2,
          textAlign: 'center',
        }}
        numberOfLines={2}
      >
        {label}
      </Text>
    </View>
  );
}
