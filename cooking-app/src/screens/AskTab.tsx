// Ask Claude tab. Shared chat thread per kitchen — every cook sees every
// question and answer. The user composes at the bottom, fires `askClaude`
// which POSTs to the edge function; user + assistant rows arrive via
// realtime and render in the thread.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, sizes, radius } from '../theme';
import { useKitchen } from '../lib/kitchen';

export function AskTab() {
  const { chatMessages, askingClaude, askClaude, cooks, tasks, sections } = useKitchen();
  const [draft, setDraft] = useState('');
  const [includeContext, setIncludeContext] = useState(true);
  const scrollRef = useRef<ScrollView | null>(null);

  // "Current step" = the first uncompleted task in recipe order. That's what
  // the cooks are about to do, which is the natural context for a question.
  // Using the most recently *tapped* task would point at a step they already
  // finished — wrong direction.
  const currentTask = useMemo(() => {
    const orderedSections = [...sections].sort((a, b) => a.order_index - b.order_index);
    for (const sec of orderedSections) {
      const next = tasks
        .filter((t) => t.section_id === sec.id && !t.completed_at)
        .sort((a, b) => a.order_index - b.order_index)[0];
      if (next) return next;
    }
    return null;
  }, [tasks, sections]);

  // Auto-scroll to the bottom whenever the thread grows or the thinking
  // indicator appears/disappears.
  useEffect(() => {
    const id = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 50);
    return () => clearTimeout(id);
  }, [chatMessages.length, askingClaude]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || askingClaude) return;
    setDraft('');
    try {
      await askClaude(
        trimmed,
        includeContext,
        includeContext && currentTask ? currentTask.id : null,
      );
    } catch (e) {
      Alert.alert("Couldn't reach Claude", e instanceof Error ? e.message : 'Try again.');
    }
  };

  const empty = chatMessages.length === 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 12,
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {empty ? (
          <EmptyState />
        ) : (
          <View style={{ gap: 10 }}>
            {chatMessages.map((m) => {
              const isUser = m.role === 'user';
              const cook = m.cook_id ? cooks.find((c) => c.id === m.cook_id) ?? null : null;
              return (
                <View
                  key={m.id}
                  style={{
                    alignSelf: isUser ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    backgroundColor: isUser ? colors.surface : colors.accentSoft,
                    borderRadius: 14,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderWidth: 1,
                    borderColor: isUser ? colors.lineSoft : 'transparent',
                  }}
                >
                  {!isUser && (
                    <Text
                      style={{
                        fontFamily: fonts.bodyMed,
                        fontSize: sizes.xs,
                        color: colors.accent,
                        letterSpacing: 0.4,
                        textTransform: 'uppercase',
                        marginBottom: 4,
                      }}
                    >
                      Claude
                    </Text>
                  )}
                  {isUser && cook && (
                    <Text
                      style={{
                        fontFamily: fonts.bodyMed,
                        fontSize: sizes.xs,
                        color: colors.inkSoft,
                        letterSpacing: 0.4,
                        textTransform: 'uppercase',
                        marginBottom: 4,
                      }}
                    >
                      {cook.name}
                    </Text>
                  )}
                  <Text
                    style={{
                      fontFamily: fonts.body,
                      fontSize: sizes.md,
                      color: colors.ink,
                      lineHeight: 22,
                    }}
                  >
                    {m.content}
                  </Text>
                </View>
              );
            })}
            {askingClaude && (
              <View
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: colors.accentSoft,
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <ActivityIndicator size="small" color={colors.accent} />
                <Text
                  style={{
                    fontFamily: fonts.body,
                    fontSize: sizes.sm,
                    color: colors.inkSoft,
                  }}
                >
                  Thinking…
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <View
        style={{
          paddingHorizontal: 12,
          paddingTop: 8,
          paddingBottom: 12,
          borderTopWidth: 1,
          borderTopColor: colors.lineSoft,
          backgroundColor: colors.paper,
          gap: 8,
        }}
      >
        {includeContext && currentTask && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 10,
              backgroundColor: colors.accentSoft,
              alignSelf: 'flex-start',
              maxWidth: '100%',
            }}
          >
            <Ionicons name="bookmark" size={12} color={colors.accent} />
            <Text
              style={{
                fontFamily: fonts.bodyMed,
                fontSize: sizes.xs,
                color: colors.accent,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
              }}
            >
              You're on
            </Text>
            <Text
              style={{
                flex: 1,
                fontFamily: fonts.body,
                fontSize: sizes.sm,
                color: colors.ink,
              }}
              numberOfLines={1}
            >
              {currentTask.description}
            </Text>
          </View>
        )}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 8,
          }}
        >
          <View
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: colors.lineSoft,
              borderRadius: 14,
              backgroundColor: colors.fillSoft,
              paddingHorizontal: 12,
              paddingVertical: 8,
              minHeight: 44,
              justifyContent: 'center',
            }}
          >
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Ask anything about cooking"
              placeholderTextColor={colors.inkFaint}
              multiline
              maxLength={2000}
              style={{
                fontFamily: fonts.body,
                fontSize: sizes.md,
                color: colors.ink,
                lineHeight: 20,
                paddingVertical: 0,
                maxHeight: 120,
              }}
              returnKeyType="send"
              blurOnSubmit
              onSubmitEditing={() => send(draft)}
            />
          </View>
          <Pressable
            onPress={() => send(draft)}
            disabled={!draft.trim() || askingClaude}
            hitSlop={6}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: radius.button,
              backgroundColor:
                !draft.trim() || askingClaude ? colors.fill : colors.accent,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Ionicons
              name="paper-plane"
              size={18}
              color={!draft.trim() || askingClaude ? colors.inkFaint : colors.paper}
            />
          </Pressable>
        </View>

        <Pressable
          onPress={() => setIncludeContext((v) => !v)}
          hitSlop={12}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            alignSelf: 'flex-start',
            paddingVertical: 8,
            paddingRight: 12,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 5,
              borderWidth: 1.5,
              borderColor: includeContext ? colors.sage : colors.lineSoft,
              backgroundColor: includeContext ? colors.sage : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {includeContext && <Ionicons name="checkmark" size={14} color={colors.paper} />}
          </View>
          <Text
            style={{
              fontFamily: fonts.body,
              fontSize: sizes.sm,
              color: colors.inkSoft,
            }}
          >
            Include recipe context
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function EmptyState() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 32, gap: 8 }}>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Ionicons name="sparkles-outline" size={32} color={colors.accent} />
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: sizes.lg,
            color: colors.ink,
            textAlign: 'center',
          }}
        >
          Ask Claude anything
        </Text>
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: sizes.sm,
            color: colors.inkSoft,
            textAlign: 'center',
            paddingHorizontal: 24,
            lineHeight: 20,
          }}
        >
          Cooking questions, substitutions, doneness checks — everyone in the kitchen sees the answers.
        </Text>
      </View>
    </View>
  );
}
