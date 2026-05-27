import { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import DraggableFlatList, {
  RenderItemParams,
} from 'react-native-draggable-flatlist';
import { Btn } from '../components/Btn';
import { EditModal } from '../components/EditModal';
import { CodeChip } from '../components/CodeChip';
import { AvatarStack } from '../components/AvatarStack';
import { PeopleSheet } from './PeopleSheet';
import { colors, fonts, sizes, space } from '../theme';
import { RootStackParamList } from '../navigation/types';
import { useKitchen } from '../lib/kitchen';
import {
  api,
  Ingredient,
  ParsedRecipe,
  Recipe,
  RecipeAction,
  RecipeSection,
  Task,
} from '../lib/api';

type Props = NativeStackScreenProps<RootStackParamList, 'RecipeReview'>;

type EditTarget =
  | { kind: 'ingredient_new' }
  | { kind: 'ingredient_edit'; ingredient: Ingredient }
  | { kind: 'task_new'; section: RecipeSection }
  | { kind: 'task_edit'; task: Task }
  | { kind: 'section_new' }
  | { kind: 'section_edit'; section: RecipeSection };

type RowItem =
  | { type: 'header'; key: string; section: RecipeSection }
  | { type: 'task'; key: string; task: Task; sectionId: string; indexInSection: number }
  | { type: 'addTask'; key: string; sectionId: string }
  | { type: 'addSection'; key: string };

export function RecipeReviewScreen({ navigation, route }: Props) {
  const { kitchen, deviceId, cooks, endKitchen, leaveKitchen, setRecipe: setProviderRecipe } = useKitchen();
  const [peopleOpen, setPeopleOpen] = useState(false);
  const initial = route.params.parsed;

  const [recipe, setRecipe] = useState<Recipe>(initial.recipe);
  const [sections, setSections] = useState<RecipeSection[]>(initial.sections);
  const [tasks, setTasks] = useState<Task[]>(initial.tasks);
  const [ingredients, setIngredients] = useState<Ingredient[]>(initial.ingredients);

  const [titleDraft, setTitleDraft] = useState(recipe.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [starting, setStarting] = useState(false);

  if (!deviceId) {
    navigation.replace('Landing');
    return null;
  }

  const applyResult = (result: ParsedRecipe) => {
    setRecipe(result.recipe);
    setSections(result.sections);
    setTasks(result.tasks);
    setIngredients(result.ingredients);
    setTitleDraft(result.recipe.title);
  };

  // Server dispatch for things that don't need optimistic UI (small edits via modal).
  const dispatch = async (action: RecipeAction): Promise<boolean> => {
    try {
      const result = await api.updateRecipe({ recipeId: recipe.id, deviceId, action });
      applyResult(result);
      return true;
    } catch (e) {
      Alert.alert("Couldn't save", e instanceof Error ? e.message : 'Try again.');
      return false;
    }
  };

  // Optimistic dispatch — apply locally first, fire request, revert on error.
  const dispatchOptimistic = async (
    action: RecipeAction,
    apply: () => void,
    revert: () => void,
  ) => {
    apply();
    try {
      const result = await api.updateRecipe({ recipeId: recipe.id, deviceId, action });
      applyResult(result);
    } catch (e) {
      revert();
      Alert.alert("Couldn't save", e instanceof Error ? e.message : 'Try again.');
    }
  };

  const onTitleBlur = async () => {
    setEditingTitle(false);
    const next = titleDraft.trim();
    if (!next || next === recipe.title) {
      setTitleDraft(recipe.title);
      return;
    }
    const ok = await dispatch({ type: 'set_title', title: next });
    if (!ok) setTitleDraft(recipe.title);
  };

  const onStartCooking = async () => {
    setStarting(true);
    try {
      const result = await api.updateRecipe({
        recipeId: recipe.id,
        deviceId,
        action: { type: 'start_cooking' },
      });
      applyResult(result);
      // Hand the live recipe to the provider so the Cooking screen and
      // every other cook's app see it without waiting for the realtime tick.
      setProviderRecipe(result);
      navigation.replace('Cooking');
    } catch (e) {
      Alert.alert("Couldn't save", e instanceof Error ? e.message : 'Try again.');
    } finally {
      setStarting(false);
    }
  };

  // Build the flat row list for DraggableFlatList. Section headers + tasks + per-section add buttons.
  const rowItems = useMemo<RowItem[]>(() => {
    const rows: RowItem[] = [];
    for (const section of sections) {
      rows.push({ type: 'header', key: `h:${section.id}`, section });
      const sectionTasks = tasks
        .filter((t) => t.section_id === section.id)
        .sort((a, b) => a.order_index - b.order_index);
      sectionTasks.forEach((task, i) => {
        rows.push({
          type: 'task',
          key: `t:${task.id}`,
          task,
          sectionId: section.id,
          indexInSection: i,
        });
      });
      rows.push({ type: 'addTask', key: `a:${section.id}`, sectionId: section.id });
    }
    rows.push({ type: 'addSection', key: 'add-section' });
    return rows;
  }, [sections, tasks]);

  const onDragEnd = ({ data, from, to }: { data: RowItem[]; from: number; to: number }) => {
    if (from === to) return;

    // Walk the new array, assign each task a (section_id, indexInSection) based on
    // the most recent header. Find the moved task's new target.
    let currentSectionId: string | null = null;
    let indexInSection = 0;
    let movedTaskId: string | null = null;
    let movedTarget: { sectionId: string; index: number } | null = null;
    const reorderedTasks: Task[] = [];

    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      if (item.type === 'header') {
        currentSectionId = item.section.id;
        indexInSection = 0;
      } else if (item.type === 'task') {
        // If a task ended up before any header (e.g. dropped at the very top),
        // snap it to the first section.
        const sectionId = currentSectionId ?? sections[0]?.id;
        if (!sectionId) continue;
        reorderedTasks.push({
          ...item.task,
          section_id: sectionId,
          order_index: indexInSection,
        });
        if (i === to) {
          movedTaskId = item.task.id;
          movedTarget = { sectionId, index: indexInSection };
        }
        indexInSection++;
      }
      // addTask rows are skipped for indexing.
    }

    if (!movedTaskId || !movedTarget) return;

    const oldTasks = tasks;
    dispatchOptimistic(
      {
        type: 'move_task',
        taskId: movedTaskId,
        targetSectionId: movedTarget.sectionId,
        targetIndex: movedTarget.index,
      },
      () => setTasks(reorderedTasks),
      () => setTasks(oldTasks),
    );
  };

  const confirmDeleteSection = (section: RecipeSection) => {
    const tasksInSection = tasks.filter((t) => t.section_id === section.id).length;
    Alert.alert(
      `Delete "${section.title}"?`,
      tasksInSection > 0
        ? `This also deletes ${tasksInSection} task${tasksInSection === 1 ? '' : 's'} in this section.`
        : undefined,
      [
        { text: 'Never mind', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => dispatch({ type: 'delete_section', sectionId: section.id }),
        },
      ],
    );
  };

  const renderItem = ({ item, drag, isActive }: RenderItemParams<RowItem>) => {
    if (item.type === 'header') {
      return (
        <Pressable
          onPress={() => setEditTarget({ kind: 'section_edit', section: item.section })}
          onLongPress={() => confirmDeleteSection(item.section)}
          delayLongPress={300}
          hitSlop={4}
        >
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: sizes.lg,
              color: colors.accent,
              letterSpacing: -0.2,
              borderBottomWidth: 1,
              borderBottomColor: colors.accentSoft,
              paddingBottom: 4,
              marginBottom: 8,
              marginTop: 18,
              marginHorizontal: 16,
            }}
          >
            {item.section.title}
          </Text>
        </Pressable>
      );
    }
    if (item.type === 'addTask') {
      return (
        <Pressable
          onPress={() => {
            const sec = sections.find((s) => s.id === item.sectionId);
            if (sec) setEditTarget({ kind: 'task_new', section: sec });
          }}
          hitSlop={4}
          style={{ paddingVertical: 6, marginTop: 2, marginHorizontal: 16 }}
        >
          <Text
            style={{
              fontFamily: fonts.bodyMed,
              fontSize: sizes.sm,
              color: colors.accent,
            }}
          >
            + add task
          </Text>
        </Pressable>
      );
    }
    if (item.type === 'addSection') {
      return (
        <Pressable
          onPress={() => setEditTarget({ kind: 'section_new' })}
          hitSlop={6}
          style={{
            paddingVertical: 10,
            marginTop: 20,
            marginHorizontal: 16,
            borderTopWidth: 1,
            borderTopColor: colors.lineSoft,
            paddingTop: 14,
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
      );
    }
    // Task row.
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 6,
          paddingHorizontal: 16,
          backgroundColor: isActive ? colors.surface : 'transparent',
          opacity: isActive ? 0.9 : 1,
        }}
      >
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: sizes.md,
            color: colors.accent,
            minWidth: 22,
          }}
        >
          {item.indexInSection + 1}.
        </Text>
        <Pressable
          onPress={() => setEditTarget({ kind: 'task_edit', task: item.task })}
          onLongPress={drag}
          delayLongPress={200}
          style={({ pressed }) => ({
            flex: 1,
            paddingRight: 8,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text
            style={{
              fontFamily: fonts.body,
              fontSize: sizes.md,
              color: colors.ink,
              lineHeight: 22,
            }}
          >
            {item.task.description}
          </Text>
        </Pressable>
        <Pressable onLongPress={drag} delayLongPress={150} hitSlop={8} style={{ padding: 6 }}>
          <Ionicons name="reorder-three" size={22} color={colors.inkFaint} />
        </Pressable>
      </View>
    );
  };

  const ListHeader = (
    <View>
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 18,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.lineSoft,
          alignItems: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: sizes.xs,
            color: colors.inkFaint,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
          }}
        >
          Recipe card
        </Text>
        {editingTitle ? (
          <TextInput
            value={titleDraft}
            onChangeText={setTitleDraft}
            onBlur={onTitleBlur}
            onSubmitEditing={onTitleBlur}
            autoFocus
            placeholder="Untitled recipe"
            placeholderTextColor={colors.inkFaint}
            returnKeyType="done"
            maxLength={200}
            style={{
              fontFamily: fonts.display,
              fontSize: sizes.xxl,
              color: colors.ink,
              letterSpacing: -0.5,
              marginTop: 4,
              textAlign: 'center',
              paddingHorizontal: 4,
              paddingVertical: 2,
              minWidth: 200,
              borderBottomWidth: 1,
              borderBottomColor: colors.accent,
            }}
          />
        ) : (
          <Pressable onPress={() => setEditingTitle(true)} hitSlop={6}>
            <Text
              style={{
                fontFamily: fonts.display,
                fontSize: sizes.xxl,
                color: recipe.title ? colors.ink : colors.inkFaint,
                letterSpacing: -0.5,
                marginTop: 4,
                textAlign: 'center',
              }}
            >
              {recipe.title || 'Untitled recipe — tap to name it'}
            </Text>
          </Pressable>
        )}
      </View>

      <View
        style={{
          backgroundColor: colors.surface,
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.lineSoft,
        }}
      >
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: sizes.xs,
            color: colors.inkSoft,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Ingredients · {ingredients.length}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {ingredients.map((ing) => (
            <Pressable
              key={ing.id}
              onPress={() => setEditTarget({ kind: 'ingredient_edit', ingredient: ing })}
              style={({ pressed }) => ({
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.lineSoft,
                backgroundColor: colors.paper,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ fontFamily: fonts.body, fontSize: sizes.sm, color: colors.ink }}>
                {ing.name}
                {ing.quantity ? ` · ${ing.quantity}` : ''}
              </Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => setEditTarget({ kind: 'ingredient_new' })}
            style={({ pressed }) => ({
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: colors.accent,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              style={{
                fontFamily: fonts.bodyMed,
                fontSize: sizes.sm,
                color: colors.accent,
              }}
            >
              + add
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: colors.lineSoft,
          }}
        >
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="chevron-back" size={28} color={colors.inkSoft} />
          </Pressable>
          <View
            style={{
              marginLeft: 'auto',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}
          >
            {kitchen && <CodeChip code={kitchen.code} />}
            <Pressable onPress={() => setPeopleOpen(true)} hitSlop={6}>
              <AvatarStack
                cooks={cooks.map((c) => ({ name: c.name, color: c.color }))}
                size={28}
              />
            </Pressable>
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <DraggableFlatList
            data={rowItems}
            keyExtractor={(item) => item.key}
            renderItem={renderItem}
            onDragEnd={onDragEnd}
            ListHeaderComponent={ListHeader}
            contentContainerStyle={{ paddingBottom: 16 }}
            activationDistance={8}
          />
        </View>

        <View
          style={{
            paddingHorizontal: 16,
            paddingBottom: space.lg,
            paddingTop: 10,
            backgroundColor: colors.paper,
            borderTopWidth: 1,
            borderTopColor: colors.lineSoft,
          }}
        >
          <Btn full onPress={onStartCooking} disabled={starting}>
            {starting ? 'Starting...' : 'Start cooking!'}
          </Btn>
        </View>
      </KeyboardAvoidingView>

      <EditModal
        visible={editTarget !== null}
        title={modalTitle(editTarget)}
        fields={modalFields(editTarget)}
        onClose={() => setEditTarget(null)}
        onSave={async (values) => {
          if (!editTarget) return;
          let ok = false;
          if (editTarget.kind === 'ingredient_new') {
            ok = await dispatch({
              type: 'add_ingredient',
              name: values[0],
              quantity: values[1] ?? '',
            });
          } else if (editTarget.kind === 'ingredient_edit') {
            ok = await dispatch({
              type: 'update_ingredient',
              ingredientId: editTarget.ingredient.id,
              name: values[0],
              quantity: values[1] ?? '',
            });
          } else if (editTarget.kind === 'task_new') {
            ok = await dispatch({
              type: 'add_task',
              sectionId: editTarget.section.id,
              description: values[0],
            });
          } else if (editTarget.kind === 'task_edit') {
            ok = await dispatch({
              type: 'update_task',
              taskId: editTarget.task.id,
              description: values[0],
            });
          } else if (editTarget.kind === 'section_new') {
            ok = await dispatch({ type: 'add_section', title: values[0] });
          } else if (editTarget.kind === 'section_edit') {
            ok = await dispatch({
              type: 'update_section',
              sectionId: editTarget.section.id,
              title: values[0],
            });
          }
          if (ok) setEditTarget(null);
        }}
        onDelete={
          editTarget?.kind === 'ingredient_edit'
            ? async () => {
                const ok = await dispatch({
                  type: 'delete_ingredient',
                  ingredientId: editTarget.ingredient.id,
                });
                if (ok) setEditTarget(null);
              }
            : editTarget?.kind === 'task_edit'
            ? async () => {
                const ok = await dispatch({
                  type: 'delete_task',
                  taskId: editTarget.task.id,
                });
                if (ok) setEditTarget(null);
              }
            : undefined
        }
      />

      <PeopleSheet
        visible={peopleOpen}
        onClose={() => setPeopleOpen(false)}
        onEndKitchen={() => {
          setPeopleOpen(false);
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
                    Alert.alert(
                      'Could not end kitchen',
                      e instanceof Error ? e.message : 'Try again.',
                    );
                  }
                },
              },
            ],
          );
        }}
        onLeaveKitchen={() => {
          setPeopleOpen(false);
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
                    Alert.alert(
                      'Could not leave',
                      e instanceof Error ? e.message : 'Try again.',
                    );
                  }
                },
              },
            ],
          );
        }}
      />
    </SafeAreaView>
  );
}

function modalTitle(t: EditTarget | null): string {
  if (!t) return '';
  if (t.kind === 'ingredient_new') return 'Add ingredient';
  if (t.kind === 'ingredient_edit') return 'Edit ingredient';
  if (t.kind === 'task_new') return `Add a step to ${t.section.title}`;
  if (t.kind === 'section_new') return 'Add section';
  if (t.kind === 'section_edit') return 'Rename section';
  return 'Edit step';
}

function modalFields(t: EditTarget | null) {
  if (!t) return [];
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
  if (t.kind === 'task_new') {
    return [
      {
        label: 'Step',
        value: '',
        placeholder: 'e.g. Mince 4 garlic cloves',
        multiline: true,
      },
    ];
  }
  if (t.kind === 'section_new') {
    return [{ label: 'Section name', value: '', placeholder: 'e.g. Sauce' }];
  }
  if (t.kind === 'section_edit') {
    return [{ label: 'Section name', value: t.section.title }];
  }
  return [
    {
      label: 'Step',
      value: t.task.description,
      multiline: true,
    },
  ];
}
