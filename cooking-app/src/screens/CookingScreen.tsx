import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { TopBar } from '../components/TopBar';
import { Checkbox } from '../components/Checkbox';
import { AssignChip } from '../components/AssignChip';
import { AssignSheet } from '../components/AssignSheet';
import { DelegationBanner } from '../components/DelegationBanner';
import { EditModal } from '../components/EditModal';
import { WrapUpSheet } from '../components/WrapUpSheet';
import { PeopleSheet } from './PeopleSheet';
import { AskTab } from './AskTab';
import { colors, fonts, sizes, space } from '../theme';
import { RootStackParamList } from '../navigation/types';
import { useKitchen } from '../lib/kitchen';
import type { Task, Ingredient, Cook, RecipeSection } from '../lib/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Cooking'>;

type Tab = 'cook' | 'shop' | 'mine' | 'ask';

type AssignTarget =
  | { kind: 'task'; id: string; label: string; currentAssignee: string | null }
  | { kind: 'ingredient'; id: string; label: string; currentAssignee: string | null };

type BannerState = {
  description: string;
  assignerName: string;
  assignerColor: string;
};

// Host-only live-edit targets. Cooking-screen variant of the RecipeReview
// EditTarget — same edit kinds but without section editing (sections during
// cooking is a Phase 7 polish item if needed).
type EditTarget =
  | { kind: 'task_new'; sectionId: string; sectionTitle: string }
  | { kind: 'task_edit'; task: Task }
  | { kind: 'ingredient_new' }
  | { kind: 'ingredient_edit'; ingredient: Ingredient }
  | { kind: 'section_new' }
  | { kind: 'section_edit'; sectionId: string; title: string };

// Flattened rows for the Cook tab's DraggableFlatList. Only `task` rows are
// draggable (head chef only); headers/buttons keep their position because they
// never initiate a drag.
type CookRow =
  | { type: 'header'; key: string; section: RecipeSection }
  | { type: 'emptyNote'; key: string }
  | { type: 'task'; key: string; task: Task; indexInSection: number }
  | { type: 'addTask'; key: string; section: RecipeSection }
  | { type: 'addSection'; key: string };

export function CookingScreen({ navigation }: Props) {
  const {
    kitchen,
    cooks,
    meId,
    isHost,
    isSousChef,
    recipe,
    sections,
    tasks,
    ingredients,
    toggleTask,
    toggleIngredient,
    assignTask,
    assignIngredient,
    dispatchRecipe,
    moveTask,
    leaveKitchen,
    endKitchen,
    reset,
  } = useKitchen();

  const [tab, setTab] = useState<Tab>('cook');
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<AssignTarget | null>(null);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [wrapUpOpen, setWrapUpOpen] = useState(false);
  const [celebrationDismissed, setCelebrationDismissed] = useState(false);
  const [shopCelebrationDismissed, setShopCelebrationDismissed] = useState(false);

  // Sous chef shares the host's delegate powers but not recipe-editing.
  const canManage = isHost || isSousChef;

  // Bounce home when the host ends the kitchen.
  useEffect(() => {
    if (kitchen?.status === 'ended' && !isHost) {
      const hostName =
        cooks.find((c) => c.id === kitchen.main_cook_id)?.name ?? 'The head chef';
      reset();
      navigation.popToTop();
      Alert.alert('Kitchen wrapped', `${hostName} wrapped up the kitchen. Hope it was tasty!`);
    }
  }, [kitchen?.status, isHost, reset, navigation, cooks, kitchen?.main_cook_id]);

  const sortedIngredients = useMemo(
    () => [...ingredients].sort((a, b) => a.order_index - b.order_index),
    [ingredients],
  );

  const cookById = useMemo(() => {
    const map = new Map<string, Cook>();
    for (const c of cooks) map.set(c.id, c);
    return map;
  }, [cooks]);

  // Detect newly-assigned items for the current user and fire the banner.
  // We compare the set of "things assigned to me" against the previous render.
  // Skip on first hydration and skip self-triggered assignments (assigned_by === meId).
  const seenRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!meId) return;
    const next = new Set<string>();
    for (const t of tasks) if (t.assigned_to === meId) next.add(`task:${t.id}`);
    for (const i of ingredients) if (i.assigned_to === meId) next.add(`ing:${i.id}`);

    if (seenRef.current === null) {
      seenRef.current = next;
      return;
    }
    const prev = seenRef.current;
    for (const key of next) {
      if (prev.has(key)) continue;
      const [kind, id] = key.split(':');
      if (kind === 'task') {
        const t = tasks.find((x) => x.id === id);
        if (!t || !t.assigned_by || t.assigned_by === meId) continue;
        const assigner = cookById.get(t.assigned_by);
        setBanner({
          description: t.description,
          assignerName: assigner?.name ?? 'Someone',
          assignerColor: assigner?.color ?? colors.fillSoft,
        });
        break;
      } else {
        const ing = ingredients.find((x) => x.id === id);
        if (!ing || !ing.assigned_by || ing.assigned_by === meId) continue;
        const assigner = cookById.get(ing.assigned_by);
        setBanner({
          description: ing.quantity ? `${ing.name} — ${ing.quantity}` : ing.name,
          assignerName: assigner?.name ?? 'Someone',
          assignerColor: assigner?.color ?? colors.fillSoft,
        });
        break;
      }
    }
    seenRef.current = next;
  }, [tasks, ingredients, meId, cookById]);

  // When task completion drops below 100%, re-arm the celebration banner so it
  // reappears the next time everyone catches up.
  useEffect(() => {
    if (tasks.length === 0) return;
    const allDone = tasks.every((t) => !!t.completed_at);
    if (!allDone) setCelebrationDismissed(false);
  }, [tasks]);

  useEffect(() => {
    if (ingredients.length === 0) return;
    const allChecked = ingredients.every((i) => !!i.checked_at);
    if (!allChecked) setShopCelebrationDismissed(false);
  }, [ingredients]);

  const openAssignFor = (target: AssignTarget, currentAssignee: string | null) => {
    if (!meId) return;
    if (canManage) {
      setAssignTarget({ ...target, currentAssignee });
      return;
    }
    // Non-manager: take only when unassigned. The chip wouldn't render the
    // affordance otherwise, but guard anyway.
    if (currentAssignee !== null) return;
    if (target.kind === 'task') {
      assignTask(target.id, meId).catch((e) =>
        Alert.alert("Couldn't take task", e instanceof Error ? e.message : 'Try again.'),
      );
    } else {
      assignIngredient(target.id, meId).catch((e) =>
        Alert.alert("Couldn't take ingredient", e instanceof Error ? e.message : 'Try again.'),
      );
    }
  };

  const onAssignFromSheet = async (cookId: string) => {
    if (!assignTarget) return;
    const target = assignTarget;
    setAssignTarget(null);
    try {
      if (target.kind === 'task') await assignTask(target.id, cookId);
      else await assignIngredient(target.id, cookId);
    } catch (e) {
      Alert.alert("Couldn't assign", e instanceof Error ? e.message : 'Try again.');
    }
  };

  const onUnassignFromSheet = async () => {
    if (!assignTarget) return;
    const target = assignTarget;
    setAssignTarget(null);
    try {
      if (target.kind === 'task') await assignTask(target.id, null);
      else await assignIngredient(target.id, null);
    } catch (e) {
      Alert.alert("Couldn't remove assignment", e instanceof Error ? e.message : 'Try again.');
    }
  };

  const onEnd = () => {
    Alert.alert(
      'End this kitchen?',
      'Anyone who joined will be sent back to the start.',
      [
        { text: 'Never mind', style: 'cancel' },
        {
          text: 'End kitchen',
          style: 'destructive',
          onPress: async () => {
            try {
              await endKitchen();
              navigation.popToTop();
            } catch (e) {
              Alert.alert('Could not end kitchen', e instanceof Error ? e.message : 'Try again.');
            }
          },
        },
      ],
    );
  };

  const onLeave = () => {
    Alert.alert(
      'Leave this kitchen?',
      'You can rejoin with the code anytime.',
      [
        { text: 'Never mind', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveKitchen();
              navigation.popToTop();
            } catch (e) {
              Alert.alert('Could not leave', e instanceof Error ? e.message : 'Try again.');
            }
          },
        },
      ],
    );
  };

  if (!kitchen) {
    navigation.replace('Landing');
    return null;
  }

  // Loading: arrived before realtime/initial fetch hydrated the recipe.
  if (!recipe) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
        <TopBar
          kitchen={kitchen.name}
          cooks={cooks.map((c) => ({ name: c.name, color: c.color }))}
          onAvatarsPress={() => setPeopleOpen(true)}
        />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: colors.accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}
          >
            <Ionicons name="restaurant-outline" size={32} color={colors.accent} />
          </View>
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: sizes.xxl,
              color: colors.ink,
              letterSpacing: -0.3,
              textAlign: 'center',
              marginBottom: 8,
            }}
          >
            Hang tight
          </Text>
          <Text
            style={{
              fontFamily: fonts.body,
              fontSize: sizes.md,
              color: colors.inkSoft,
              textAlign: 'center',
              lineHeight: 22,
            }}
          >
            The head chef is still getting the recipe ready.
          </Text>
          <ActivityIndicator color={colors.inkFaint} style={{ marginTop: 24 }} />
        </View>
        <PeopleSheet
          visible={peopleOpen}
          onClose={() => setPeopleOpen(false)}
          onEndKitchen={() => {
            setPeopleOpen(false);
            onEnd();
          }}
          onLeaveKitchen={() => {
            setPeopleOpen(false);
            onLeave();
          }}
        />
      </SafeAreaView>
    );
  }

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => !!t.completed_at).length;
  const totalIngredients = ingredients.length;
  const checkedIngredients = ingredients.filter((i) => !!i.checked_at).length;

  // Mine tab grouping: order tasks by (sectionOrder, order_index) and group
  // them under their section header so the user sees them in the order
  // they need to be done in, not the order they were assigned.
  const sectionOrderById = new Map(sections.map((s) => [s.id, s.order_index]));
  const myTasks = tasks
    .filter((t) => t.assigned_to === meId)
    .sort((a, b) => {
      const sa = sectionOrderById.get(a.section_id) ?? 0;
      const sb = sectionOrderById.get(b.section_id) ?? 0;
      if (sa !== sb) return sa - sb;
      return a.order_index - b.order_index;
    });
  const myIngredients = sortedIngredients.filter((i) => i.assigned_to === meId);

  const renderTaskRow = (t: Task) => {
    const checked = !!t.completed_at;
    const onToggle = () => {
      toggleTask(t.id, !checked).catch((e) =>
        Alert.alert("Couldn't update task", e instanceof Error ? e.message : 'Try again.'),
      );
    };
    const assignee = t.assigned_to ? cookById.get(t.assigned_to) ?? null : null;
    const onChip = () =>
      openAssignFor(
        { kind: 'task', id: t.id, label: t.description, currentAssignee: t.assigned_to },
        t.assigned_to,
      );
    const onLongPress = isHost ? () => setEditTarget({ kind: 'task_edit', task: t }) : undefined;
    return (
      <Pressable
        key={t.id}
        onPress={onToggle}
        onLongPress={onLongPress}
        delayLongPress={350}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 10,
        }}
      >
        <Checkbox checked={checked} onToggle={onToggle} />
        <Text
          style={{
            flex: 1,
            fontFamily: fonts.body,
            fontSize: sizes.md,
            color: checked ? colors.inkFaint : colors.ink,
            textDecorationLine: checked ? 'line-through' : 'none',
            lineHeight: 22,
          }}
        >
          {t.description}
        </Text>
        <AssignChip
          assignee={assignee}
          canEdit={canManage || (assignee === null && meId !== null)}
          emptyLabel={canManage ? 'assign' : 'take'}
          onPress={onChip}
        />
      </Pressable>
    );
  };

  // Head-chef long-press menu on a Cook-tab section header (rename / delete).
  const sectionLongPress = (section: RecipeSection, taskCount: number) =>
    isHost
      ? () => {
          Alert.alert(`"${section.title}"`, undefined, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Rename',
              onPress: () =>
                setEditTarget({ kind: 'section_edit', sectionId: section.id, title: section.title }),
            },
            {
              text: 'Delete section',
              style: 'destructive',
              onPress: () => {
                Alert.alert(
                  `Delete "${section.title}"?`,
                  taskCount > 0
                    ? `This also deletes ${taskCount} task${taskCount === 1 ? '' : 's'} in this section.`
                    : undefined,
                  [
                    { text: 'Never mind', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () =>
                        dispatchRecipe({ type: 'delete_section', sectionId: section.id }).catch((e) =>
                          Alert.alert("Couldn't delete", e instanceof Error ? e.message : 'Try again.'),
                        ),
                    },
                  ],
                );
              },
            },
          ]);
        }
      : undefined;

  // Flattened rows for the Cook tab. Only task rows are draggable. The host's
  // per-section "+ add task" and the trailing "+ add section" are rows too.
  const cookRows = useMemo<CookRow[]>(() => {
    const rows: CookRow[] = [];
    for (const section of sections) {
      rows.push({ type: 'header', key: `h:${section.id}`, section });
      const sectionTasks = tasks
        .filter((t) => t.section_id === section.id)
        .sort((a, b) => a.order_index - b.order_index);
      if (sectionTasks.length === 0) {
        rows.push({ type: 'emptyNote', key: `e:${section.id}` });
      } else {
        sectionTasks.forEach((task, i) =>
          rows.push({ type: 'task', key: `t:${task.id}`, task, indexInSection: i }),
        );
      }
      if (isHost) rows.push({ type: 'addTask', key: `a:${section.id}`, section });
    }
    if (isHost) rows.push({ type: 'addSection', key: 'add-section' });
    return rows;
  }, [sections, tasks, isHost]);

  // Reorder handler mirrors RecipeReview: walk the dropped row order, reassign
  // each task a (section_id, order_index) under its preceding header, then fire
  // the optimistic move.
  const onCookDragEnd = ({ data, to }: { data: CookRow[]; from: number; to: number }) => {
    let currentSectionId: string | null = null;
    let indexInSection = 0;
    let movedTaskId: string | null = null;
    let movedTarget: { sectionId: string; index: number } | null = null;
    const reordered: Task[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row.type === 'header') {
        currentSectionId = row.section.id;
        indexInSection = 0;
      } else if (row.type === 'task') {
        const sectionId = currentSectionId ?? sections[0]?.id;
        if (!sectionId) continue;
        reordered.push({ ...row.task, section_id: sectionId, order_index: indexInSection });
        if (i === to) {
          movedTaskId = row.task.id;
          movedTarget = { sectionId, index: indexInSection };
        }
        indexInSection++;
      }
    }

    if (!movedTaskId || !movedTarget) return;
    moveTask(
      { taskId: movedTaskId, targetSectionId: movedTarget.sectionId, targetIndex: movedTarget.index },
      reordered,
    ).catch((e) => Alert.alert("Couldn't move task", e instanceof Error ? e.message : 'Try again.'));
  };

  const renderCookRow = ({ item, drag, isActive }: RenderItemParams<CookRow>) => {
    switch (item.type) {
      case 'header': {
        const section = item.section;
        const sectionTasks = tasks.filter((t) => t.section_id === section.id);
        const sectionDone = sectionTasks.length > 0 && sectionTasks.every((t) => !!t.completed_at);
        return (
          <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
            <Pressable
              onLongPress={sectionLongPress(section, sectionTasks.length)}
              delayLongPress={350}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <Text
                style={{
                  fontFamily: fonts.display,
                  fontSize: sizes.xs,
                  color: sectionDone ? colors.inkFaint : colors.accent,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                }}
              >
                {section.title}
              </Text>
              {sectionDone && <Ionicons name="checkmark-circle" size={14} color={colors.sage} />}
            </Pressable>
          </View>
        );
      }
      case 'emptyNote':
        return (
          <View style={{ paddingHorizontal: 16 }}>
            <Text
              style={{
                fontFamily: fonts.body,
                fontSize: sizes.sm,
                color: colors.inkFaint,
                fontStyle: 'italic',
                paddingVertical: 12,
              }}
            >
              No tasks in this section.
            </Text>
          </View>
        );
      case 'task':
        return (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              backgroundColor: isActive ? colors.surface : 'transparent',
            }}
          >
            <View style={{ flex: 1 }}>{renderTaskRow(item.task)}</View>
            {isHost && (
              <Pressable
                onLongPress={drag}
                delayLongPress={150}
                hitSlop={8}
                style={{ paddingLeft: 6, paddingVertical: 6 }}
              >
                <Ionicons name="reorder-three" size={22} color={colors.inkFaint} />
              </Pressable>
            )}
          </View>
        );
      case 'addTask':
        return (
          <View style={{ paddingHorizontal: 16 }}>
            <Pressable
              onPress={() =>
                setEditTarget({
                  kind: 'task_new',
                  sectionId: item.section.id,
                  sectionTitle: item.section.title,
                })
              }
              hitSlop={4}
              style={{ paddingVertical: 8 }}
            >
              <Text style={{ fontFamily: fonts.bodyMed, fontSize: sizes.sm, color: colors.accent }}>
                + add task
              </Text>
            </Pressable>
          </View>
        );
      case 'addSection':
        return (
          <View style={{ paddingHorizontal: 16 }}>
            <Pressable
              onPress={() => setEditTarget({ kind: 'section_new' })}
              hitSlop={6}
              style={{
                marginTop: 28,
                paddingTop: 14,
                paddingBottom: 6,
                borderTopWidth: 1,
                borderTopColor: colors.lineSoft,
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.bodyMed,
                  fontSize: sizes.sm,
                  color: colors.accent,
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                }}
              >
                + add section
              </Text>
            </Pressable>
          </View>
        );
    }
  };

  const renderIngredientRow = (i: Ingredient) => {
    const checked = !!i.checked_at;
    const onToggle = () => {
      toggleIngredient(i.id, !checked).catch((e) =>
        Alert.alert("Couldn't update ingredient", e instanceof Error ? e.message : 'Try again.'),
      );
    };
    const assignee = i.assigned_to ? cookById.get(i.assigned_to) ?? null : null;
    const itemLabel = i.quantity ? `${i.name} — ${i.quantity}` : i.name;
    const onChip = () =>
      openAssignFor(
        { kind: 'ingredient', id: i.id, label: itemLabel, currentAssignee: i.assigned_to },
        i.assigned_to,
      );
    const onLongPress = isHost
      ? () => setEditTarget({ kind: 'ingredient_edit', ingredient: i })
      : undefined;
    return (
      <Pressable
        key={i.id}
        onPress={onToggle}
        onLongPress={onLongPress}
        delayLongPress={350}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: colors.lineSoft,
        }}
      >
        <Checkbox checked={checked} onToggle={onToggle} />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: fonts.bodyMed,
              fontSize: sizes.md,
              color: checked ? colors.inkFaint : colors.ink,
              textDecorationLine: checked ? 'line-through' : 'none',
            }}
          >
            {i.name}
          </Text>
          {i.quantity ? (
            <Text
              style={{
                fontFamily: fonts.body,
                fontSize: sizes.sm,
                color: checked ? colors.inkFaint : colors.inkSoft,
                marginTop: 2,
                textDecorationLine: checked ? 'line-through' : 'none',
              }}
            >
              {i.quantity}
            </Text>
          ) : null}
        </View>
        <AssignChip
          assignee={assignee}
          canEdit={canManage || (assignee === null && meId !== null)}
          emptyLabel={canManage ? 'assign' : 'take'}
          onPress={onChip}
        />
      </Pressable>
    );
  };

  const onBannerTap = () => {
    setBanner(null);
    setTab('mine');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <TopBar
        kitchen={kitchen.name}
        cooks={cooks.map((c) => ({ name: c.name, color: c.color }))}
        onAvatarsPress={() => setPeopleOpen(true)}
      />

      <View style={{ flex: 1 }}>
        {tab === 'cook' && (
          <DraggableFlatList
            data={cookRows}
            keyExtractor={(item) => item.key}
            renderItem={renderCookRow}
            onDragEnd={onCookDragEnd}
            activationDistance={12}
            contentContainerStyle={{ paddingBottom: 16 }}
            ListHeaderComponent={
              <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: fonts.display,
                      fontSize: sizes.xxl,
                      color: colors.ink,
                      letterSpacing: -0.3,
                    }}
                  >
                    {recipe.title || 'Untitled recipe'}
                  </Text>
                  {isHost && (
                    <Pressable
                      onPress={() => setWrapUpOpen(true)}
                      hitSlop={8}
                      style={({ pressed }) => ({
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: colors.accent,
                        opacity: pressed ? 0.6 : 1,
                      })}
                    >
                      <Text
                        style={{
                          fontFamily: fonts.bodyMed,
                          fontSize: sizes.sm,
                          color: colors.accent,
                        }}
                      >
                        Done?
                      </Text>
                    </Pressable>
                  )}
                </View>
                <Progress
                  done={doneTasks}
                  total={totalTasks}
                  label={`${doneTasks} of ${totalTasks} done`}
                />
              </View>
            }
          />
        )}

        {tab === 'shop' && (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 }}
          >
            <Text
              style={{
                fontFamily: fonts.display,
                fontSize: sizes.xxl,
                color: colors.ink,
                letterSpacing: -0.3,
              }}
            >
              Shopping
            </Text>
            <Progress
              done={checkedIngredients}
              total={totalIngredients}
              label={`${checkedIngredients} of ${totalIngredients} checked`}
            />

            <View style={{ marginTop: 16 }}>
              {sortedIngredients.length === 0 && (
                <Text
                  style={{
                    fontFamily: fonts.body,
                    fontSize: sizes.sm,
                    color: colors.inkFaint,
                    fontStyle: 'italic',
                    paddingVertical: 12,
                  }}
                >
                  No ingredients yet.
                </Text>
              )}
              {sortedIngredients.map(renderIngredientRow)}
              {isHost && (
                <Pressable
                  onPress={() => setEditTarget({ kind: 'ingredient_new' })}
                  hitSlop={4}
                  style={{ paddingVertical: 12, marginTop: 4 }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.bodyMed,
                      fontSize: sizes.sm,
                      color: colors.accent,
                    }}
                  >
                    + add ingredient
                  </Text>
                </Pressable>
              )}
            </View>
          </ScrollView>
        )}

        {tab === 'mine' && (
          <MineTab
            myTasks={myTasks}
            myIngredients={myIngredients}
            sections={sections}
            renderTaskRow={renderTaskRow}
            renderIngredientRow={renderIngredientRow}
          />
        )}

        {tab === 'ask' && <AskTab />}
      </View>

      {tab === 'cook' &&
        totalTasks > 0 &&
        doneTasks === totalTasks &&
        !celebrationDismissed && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              marginHorizontal: 12,
              marginBottom: 6,
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 14,
              backgroundColor: colors.sageSoft,
            }}
          >
            <Ionicons name="sparkles" size={20} color={colors.sage} />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: fonts.bodyMed,
                  fontSize: sizes.md,
                  color: colors.ink,
                }}
              >
                Everything's checked off!
              </Text>
              {isHost && (
                <Pressable onPress={() => setWrapUpOpen(true)} hitSlop={6} style={{ marginTop: 2 }}>
                  <Text
                    style={{
                      fontFamily: fonts.bodyMed,
                      fontSize: sizes.sm,
                      color: colors.accent,
                    }}
                  >
                    Wrap up the kitchen →
                  </Text>
                </Pressable>
              )}
            </View>
            <Pressable
              onPress={() => setCelebrationDismissed(true)}
              hitSlop={10}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
            >
              <Ionicons name="close" size={18} color={colors.inkSoft} />
            </Pressable>
          </View>
        )}

      {tab === 'shop' &&
        totalIngredients > 0 &&
        checkedIngredients === totalIngredients &&
        !shopCelebrationDismissed && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              marginHorizontal: 12,
              marginBottom: 6,
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 14,
              backgroundColor: colors.sageSoft,
            }}
          >
            <Ionicons name="checkmark-circle" size={20} color={colors.sage} />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: fonts.bodyMed,
                  fontSize: sizes.md,
                  color: colors.ink,
                }}
              >
                Got everything!
              </Text>
              <Pressable onPress={() => setTab('cook')} hitSlop={6} style={{ marginTop: 2 }}>
                <Text
                  style={{
                    fontFamily: fonts.bodyMed,
                    fontSize: sizes.sm,
                    color: colors.accent,
                  }}
                >
                  Switch to Cook →
                </Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => setShopCelebrationDismissed(true)}
              hitSlop={10}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
            >
              <Ionicons name="close" size={18} color={colors.inkSoft} />
            </Pressable>
          </View>
        )}

      <TabBar value={tab} onChange={setTab} />

      <PeopleSheet
        visible={peopleOpen}
        onClose={() => setPeopleOpen(false)}
        onEndKitchen={() => {
          setPeopleOpen(false);
          onEnd();
        }}
        onLeaveKitchen={() => {
          setPeopleOpen(false);
          onLeave();
        }}
      />

      <AssignSheet
        visible={assignTarget !== null}
        onClose={() => setAssignTarget(null)}
        cooks={cooks}
        currentAssignee={assignTarget?.currentAssignee ?? null}
        itemLabel={assignTarget?.label ?? ''}
        onAssign={onAssignFromSheet}
        onUnassign={onUnassignFromSheet}
      />

      <DelegationBanner
        visible={banner !== null}
        assignerName={banner?.assignerName ?? ''}
        assignerColor={banner?.assignerColor ?? colors.fillSoft}
        description={banner?.description ?? ''}
        onPress={onBannerTap}
        onDismiss={() => setBanner(null)}
      />

      <EditModal
        visible={editTarget !== null}
        title={editModalTitle(editTarget)}
        fields={editModalFields(editTarget)}
        onClose={() => setEditTarget(null)}
        onSave={async (values) => {
          if (!editTarget) return;
          try {
            if (editTarget.kind === 'task_new') {
              await dispatchRecipe({
                type: 'add_task',
                sectionId: editTarget.sectionId,
                description: values[0],
              });
            } else if (editTarget.kind === 'task_edit') {
              await dispatchRecipe({
                type: 'update_task',
                taskId: editTarget.task.id,
                description: values[0],
              });
            } else if (editTarget.kind === 'ingredient_new') {
              await dispatchRecipe({
                type: 'add_ingredient',
                name: values[0],
                quantity: values[1] ?? '',
              });
            } else if (editTarget.kind === 'ingredient_edit') {
              await dispatchRecipe({
                type: 'update_ingredient',
                ingredientId: editTarget.ingredient.id,
                name: values[0],
                quantity: values[1] ?? '',
              });
            } else if (editTarget.kind === 'section_new') {
              await dispatchRecipe({ type: 'add_section', title: values[0] });
            } else if (editTarget.kind === 'section_edit') {
              await dispatchRecipe({
                type: 'update_section',
                sectionId: editTarget.sectionId,
                title: values[0],
              });
            }
            setEditTarget(null);
          } catch (e) {
            Alert.alert("Couldn't save", e instanceof Error ? e.message : 'Try again.');
          }
        }}
        onDelete={
          editTarget?.kind === 'task_edit'
            ? async () => {
                try {
                  await dispatchRecipe({ type: 'delete_task', taskId: editTarget.task.id });
                  setEditTarget(null);
                } catch (e) {
                  Alert.alert("Couldn't delete", e instanceof Error ? e.message : 'Try again.');
                }
              }
            : editTarget?.kind === 'ingredient_edit'
            ? async () => {
                try {
                  await dispatchRecipe({
                    type: 'delete_ingredient',
                    ingredientId: editTarget.ingredient.id,
                  });
                  setEditTarget(null);
                } catch (e) {
                  Alert.alert("Couldn't delete", e instanceof Error ? e.message : 'Try again.');
                }
              }
            : undefined
        }
      />

      <WrapUpSheet
        visible={wrapUpOpen}
        onClose={() => setWrapUpOpen(false)}
        onEnd={async () => {
          try {
            await endKitchen();
            setWrapUpOpen(false);
            navigation.popToTop();
          } catch (e) {
            Alert.alert("Couldn't end kitchen", e instanceof Error ? e.message : 'Try again.');
          }
        }}
        tasksDone={doneTasks}
        tasksTotal={totalTasks}
        itemsBought={checkedIngredients}
        itemsTotal={totalIngredients}
        cooksCount={cooks.length}
      />
    </SafeAreaView>
  );
}

function editModalTitle(t: EditTarget | null): string {
  if (!t) return '';
  if (t.kind === 'task_new') return `Add a step to ${t.sectionTitle}`;
  if (t.kind === 'task_edit') return 'Edit step';
  if (t.kind === 'ingredient_new') return 'Add ingredient';
  if (t.kind === 'ingredient_edit') return 'Edit ingredient';
  if (t.kind === 'section_new') return 'Add section';
  return 'Rename section';
}

function editModalFields(t: EditTarget | null) {
  if (!t) return [];
  if (t.kind === 'task_new') {
    return [
      { label: 'Step', value: '', placeholder: 'e.g. Mince 4 garlic cloves', multiline: true },
    ];
  }
  if (t.kind === 'task_edit') {
    return [{ label: 'Step', value: t.task.description, multiline: true }];
  }
  if (t.kind === 'ingredient_new') {
    return [
      { label: 'Item', value: '', placeholder: 'e.g. carrots' },
      { label: 'Quantity', value: '', placeholder: 'e.g. 2 large' },
    ];
  }
  if (t.kind === 'ingredient_edit') {
    return [
      { label: 'Item', value: t.ingredient.name },
      { label: 'Quantity', value: t.ingredient.quantity ?? '' },
    ];
  }
  if (t.kind === 'section_new') {
    return [{ label: 'Section name', value: '', placeholder: 'e.g. Sauce' }];
  }
  return [{ label: 'Section name', value: t.title }];
}

function MineTab({
  myTasks,
  myIngredients,
  sections,
  renderTaskRow,
  renderIngredientRow,
}: {
  myTasks: Task[];
  myIngredients: Ingredient[];
  sections: { id: string; title: string; order_index: number }[];
  renderTaskRow: (t: Task) => React.ReactElement;
  renderIngredientRow: (i: Ingredient) => React.ReactElement;
}) {
  const total = myTasks.length + myIngredients.length;
  if (total === 0) {
    return (
      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}
      >
        <Ionicons name="person-outline" size={32} color={colors.inkFaint} />
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: sizes.lg,
            color: colors.ink,
            textAlign: 'center',
            marginTop: 12,
          }}
        >
          Nothing on your plate yet
        </Text>
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: sizes.sm,
            color: colors.inkSoft,
            textAlign: 'center',
            marginTop: 6,
            lineHeight: 20,
          }}
        >
          Pitch in by tapping any task in the Cook or Shop tab.
        </Text>
      </View>
    );
  }

  const tasksDone = myTasks.length > 0 && myTasks.every((t) => !!t.completed_at);
  const ingDone = myIngredients.length > 0 && myIngredients.every((i) => !!i.checked_at);
  const allDone = tasksDone && (myIngredients.length === 0 || ingDone) && (myTasks.length === 0 || tasksDone);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 }}
    >
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: sizes.xxl,
          color: colors.ink,
          letterSpacing: -0.3,
        }}
      >
        Your tasks
      </Text>

      {allDone && (
        <View
          style={{
            marginTop: 12,
            backgroundColor: colors.sageSoft,
            borderRadius: 12,
            padding: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Ionicons name="checkmark-circle" size={20} color={colors.sage} />
          <Text
            style={{
              flex: 1,
              fontFamily: fonts.bodyMed,
              fontSize: sizes.sm,
              color: colors.ink,
            }}
          >
            You're a beast. Help out somewhere else?
          </Text>
        </View>
      )}

      {myIngredients.length > 0 && (
        <View style={{ marginTop: 24 }}>
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: sizes.xs,
              color: colors.accent,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          >
            To buy
          </Text>
          <View style={{ marginTop: 6 }}>
            {myIngredients.map(renderIngredientRow)}
          </View>
        </View>
      )}

      {myTasks.length > 0 && (
        <View style={{ marginTop: 24 }}>
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: sizes.xs,
              color: colors.inkSoft,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          >
            To do
          </Text>
          {sections
            .filter((s) => myTasks.some((t) => t.section_id === s.id))
            .map((s) => {
              const tasksInSection = myTasks.filter((t) => t.section_id === s.id);
              return (
                <View key={s.id} style={{ marginTop: 14 }}>
                  <Text
                    style={{
                      fontFamily: fonts.display,
                      fontSize: sizes.xs,
                      color: colors.accent,
                      letterSpacing: 0.6,
                      textTransform: 'uppercase',
                    }}
                  >
                    {s.title}
                  </Text>
                  <View style={{ marginTop: 4 }}>
                    {tasksInSection.map(renderTaskRow)}
                  </View>
                </View>
              );
            })}
        </View>
      )}
    </ScrollView>
  );
}

function Progress({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = total === 0 ? 0 : Math.min(1, done / total);
  return (
    <View style={{ marginTop: 12 }}>
      <View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.lineSoft,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${pct * 100}%`,
            height: '100%',
            backgroundColor: colors.sage,
          }}
        />
      </View>
      <Text
        style={{
          fontFamily: fonts.body,
          fontSize: sizes.sm,
          color: colors.inkSoft,
          marginTop: 6,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

const TAB_DEFS: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'cook', label: 'Cook', icon: 'list-outline' },
  { key: 'shop', label: 'Shop', icon: 'basket-outline' },
  { key: 'mine', label: 'Mine', icon: 'person-outline' },
  { key: 'ask', label: 'Ask', icon: 'sparkles-outline' },
];

function TabBar({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: colors.lineSoft,
        paddingTop: 6,
        paddingBottom: space.sm,
        backgroundColor: colors.paper,
      }}
    >
      {TAB_DEFS.map((t) => {
        const active = t.key === value;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 6 }}
            hitSlop={4}
          >
            <Ionicons
              name={t.icon}
              size={22}
              color={active ? colors.ink : colors.inkFaint}
            />
            <Text
              style={{
                fontFamily: active ? fonts.bodyMed : fonts.body,
                fontSize: sizes.xs,
                color: active ? colors.ink : colors.inkFaint,
                marginTop: 2,
              }}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
