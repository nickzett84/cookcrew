import { Modal, View, Text, Pressable, ScrollView } from 'react-native';
import { colors, fonts, sizes, space } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function HowItWorksSheet({ visible, onClose }: Props) {
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
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: space.xxl,
            maxHeight: '85%',
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
              marginBottom: 4,
            }}
          >
            How CookCrew works
          </Text>
          <View
            style={{
              height: 1,
              width: 48,
              backgroundColor: colors.accent,
              opacity: 0.6,
              marginBottom: 18,
            }}
          />

          <ScrollView showsVerticalScrollIndicator={false}>
            <Paragraph
              lead="One recipe, everyone in sync."
              body="The host creates a kitchen and shares a 6-letter code. Friends join from their own phones — just a name, no accounts."
            />
            <Paragraph
              lead="Drop in your recipe"
              body="as a photo, PDF, or by hand. CookCrew turns it into a shopping list and a step-by-step task list. Check-offs sync live across every phone."
            />
            <Paragraph
              lead="Split the work."
              body="Tap “+ take” on anything to claim it — or, if you're hosting, hand tasks out to friends. Stuck on a step? Ask Claude in the chat tab. When dinner's served, the host wraps up the kitchen."
            />
          </ScrollView>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({
              marginTop: 18,
              paddingVertical: 14,
              alignItems: 'center',
              backgroundColor: colors.ink,
              borderRadius: 16,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ fontFamily: fonts.bodyMed, fontSize: sizes.md, color: colors.paper }}>
              Got it
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Paragraph({ lead, body }: { lead: string; body: string }) {
  return (
    <Text
      style={{
        fontFamily: fonts.body,
        fontSize: sizes.md,
        color: colors.inkSoft,
        lineHeight: 22,
        marginBottom: 16,
      }}
    >
      <Text style={{ fontFamily: fonts.bodyMed, color: colors.ink }}>{lead}</Text>{' '}
      {body}
    </Text>
  );
}
