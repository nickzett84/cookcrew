import { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Btn } from './Btn';
import { colors, fonts, sizes, space } from '../theme';

export type EditField = {
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
};

type Props = {
  visible: boolean;
  title: string;
  fields: EditField[];
  onSave: (values: string[]) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  onClose: () => void;
  saveLabel?: string;
};

export function EditModal({
  visible,
  title,
  fields,
  onSave,
  onDelete,
  onClose,
  saveLabel = 'Save',
}: Props) {
  const [values, setValues] = useState<string[]>(fields.map((f) => f.value));
  const [busy, setBusy] = useState(false);

  // Reset values when the modal opens with new fields.
  useEffect(() => {
    if (visible) {
      setValues(fields.map((f) => f.value));
      setBusy(false);
    }
  }, [visible, fields]);

  const valid = values.every((v, i) => {
    // First field is required by convention; trailing fields can be empty.
    if (i === 0) return v.trim().length > 0;
    return true;
  });

  const onSavePress = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await onSave(values.map((v) => v.trim()));
    } finally {
      setBusy(false);
    }
  };

  const onDeletePress = async () => {
    if (!onDelete || busy) return;
    setBusy(true);
    try {
      await onDelete();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(40,30,20,0.4)', justifyContent: 'flex-end' }}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
                marginBottom: 14,
              }}
            />

            <Text
              style={{
                fontFamily: fonts.display,
                fontSize: sizes.xl,
                color: colors.ink,
                letterSpacing: -0.3,
                marginBottom: 16,
              }}
            >
              {title}
            </Text>

            {fields.map((field, i) => (
              <View key={i} style={{ marginBottom: 14 }}>
                <Text
                  style={{
                    fontFamily: fonts.display,
                    fontSize: sizes.xs,
                    color: colors.inkSoft,
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                    marginBottom: 6,
                  }}
                >
                  {field.label}
                </Text>
                <TextInput
                  value={values[i]}
                  onChangeText={(t) => {
                    const next = values.slice();
                    next[i] = t;
                    setValues(next);
                  }}
                  placeholder={field.placeholder}
                  placeholderTextColor={colors.inkFaint}
                  autoFocus={i === 0}
                  multiline={field.multiline}
                  style={{
                    minHeight: field.multiline ? 80 : 48,
                    paddingHorizontal: 14,
                    paddingVertical: field.multiline ? 12 : 0,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.lineSoft,
                    backgroundColor: colors.surface,
                    fontFamily: fonts.body,
                    fontSize: sizes.lg,
                    color: colors.ink,
                    textAlignVertical: field.multiline ? 'top' : 'center',
                  }}
                />
              </View>
            ))}

            <View style={{ marginTop: 4 }}>
              <Btn full disabled={!valid || busy} onPress={onSavePress}>
                {busy ? 'Saving...' : saveLabel}
              </Btn>
              {onDelete && (
                <View style={{ marginTop: 8 }}>
                  <Btn full kind="secondary" onPress={onDeletePress} disabled={busy}>
                    Delete
                  </Btn>
                </View>
              )}
              <Pressable
                onPress={onClose}
                disabled={busy}
                hitSlop={8}
                style={{ alignItems: 'center', paddingVertical: 12, marginTop: 4 }}
              >
                <Text
                  style={{
                    fontFamily: fonts.bodyMed,
                    fontSize: sizes.sm,
                    color: colors.inkSoft,
                  }}
                >
                  Cancel
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
