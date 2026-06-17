import { Modal, View, Text, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../components/Avatar';
import { Chip } from '../components/Chip';
import { Btn } from '../components/Btn';
import { colors, fonts, sizes, space } from '../theme';
import { useKitchen } from '../lib/kitchen';

type Props = {
  visible: boolean;
  onClose: () => void;
  onEndKitchen: () => void;
  onLeaveKitchen: () => void;
};

const KITCHEN_MAX = 10;

export function PeopleSheet({ visible, onClose, onEndKitchen, onLeaveKitchen }: Props) {
  const { kitchen, cooks, meId, isHost, setSousChef } = useKitchen();
  if (!kitchen) return null;

  const onTapCook = (cookId: string, cookName: string) => {
    // Host can promote / demote a non-host cook to sous chef.
    if (!isHost) return;
    if (cookId === kitchen.main_cook_id) return;
    const isCurrentSous = kitchen.sous_chef_id === cookId;
    Alert.alert(
      isCurrentSous ? `Remove ${cookName} as sous chef?` : `Make ${cookName} sous chef?`,
      isCurrentSous
        ? undefined
        : 'They’ll get a chef-hat badge. (In v2 they’ll also take over automatically if you lose connection.)',
      [
        { text: 'Never mind', style: 'cancel' },
        {
          text: isCurrentSous ? 'Remove' : 'Make sous chef',
          style: isCurrentSous ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await setSousChef(isCurrentSous ? null : cookId);
            } catch (e) {
              Alert.alert(
                "Couldn't update sous chef",
                e instanceof Error ? e.message : 'Try again.',
              );
            }
          },
        },
      ],
    );
  };

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

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 14,
            }}
          >
            <Text
              style={{
                fontFamily: fonts.display,
                fontSize: sizes.xl,
                color: colors.ink,
                letterSpacing: -0.3,
              }}
            >
              Crew
            </Text>
            <Text style={{ fontFamily: fonts.body, fontSize: sizes.xs, color: colors.inkSoft }}>
              {cooks.length} of {KITCHEN_MAX} max
            </Text>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {cooks.map((c) => {
              const cookIsHost = c.id === kitchen.main_cook_id;
              const cookIsSous = c.id === kitchen.sous_chef_id;
              const tappable = isHost && !cookIsHost;
              const borderColor = cookIsHost
                ? colors.ink
                : cookIsSous
                ? colors.steelSoft
                : colors.lineSoft;
              const borderWidth = cookIsHost || cookIsSous ? 2 : 1;
              return (
                <Pressable
                  key={c.id}
                  onPress={tappable ? () => onTapCook(c.id, c.name) : undefined}
                  style={({ pressed }) => ({
                    flexBasis: '48%',
                    borderRadius: 12,
                    backgroundColor: colors.surface,
                    borderWidth,
                    borderColor,
                    padding: 14,
                    alignItems: 'center',
                    opacity: pressed && tappable ? 0.7 : 1,
                  })}
                >
                  <View>
                    <Avatar name={c.name} color={c.color} size={44} />
                    {cookIsSous && (
                      <View
                        style={{
                          position: 'absolute',
                          right: -4,
                          bottom: -4,
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          backgroundColor: colors.paper,
                          borderWidth: 1.5,
                          borderColor: colors.steel,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons name="restaurant" size={11} color={colors.steel} />
                      </View>
                    )}
                  </View>
                  <Text
                    style={{
                      fontFamily: fonts.display,
                      fontSize: sizes.md,
                      color: colors.ink,
                      marginTop: 8,
                    }}
                    numberOfLines={1}
                  >
                    {c.name}
                  </Text>
                  {cookIsHost && (
                    <View style={{ marginTop: 6 }}>
                      <Chip variant="soft">head chef</Chip>
                    </View>
                  )}
                  {cookIsSous && (
                    <View style={{ marginTop: 6 }}>
                      <Chip variant="soft">sous chef</Chip>
                    </View>
                  )}
                  {c.id === meId && !cookIsHost && !cookIsSous && (
                    <View style={{ marginTop: 6 }}>
                      <Chip variant="soft">you</Chip>
                    </View>
                  )}
                  {tappable && (
                    <Text
                      style={{
                        fontFamily: fonts.body,
                        fontSize: sizes.xs,
                        color: colors.inkFaint,
                        marginTop: 6,
                      }}
                    >
                      {cookIsSous ? 'tap to remove' : 'tap to make sous chef'}
                    </Text>
                  )}
                </Pressable>
              );
            })}

          </View>

          <View style={{ marginTop: space.lg }}>
            {isHost ? (
              <Pressable onPress={onEndKitchen} hitSlop={8} style={{ alignItems: 'center', paddingVertical: 12 }}>
                <Text style={{ fontFamily: fonts.bodyMed, fontSize: sizes.md, color: colors.accent }}>
                  End the kitchen
                </Text>
              </Pressable>
            ) : (
              <Btn full kind="secondary" onPress={onLeaveKitchen}>
                Leave kitchen
              </Btn>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
