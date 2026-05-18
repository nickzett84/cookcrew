import { ReactNode, useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { Cook, Kitchen, Recipe, RecipeSection, Task, Ingredient, ParsedRecipe, ChatMessage, RecipeAction, api } from './api';
import { supabase } from './supabase';
import { getOrCreateDeviceId } from './deviceId';
import { KitchenContext, KitchenState } from './kitchen';

export function KitchenProvider({ children }: { children: ReactNode }) {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [kitchen, setKitchen] = useState<Kitchen | null>(null);
  const [cooks, setCooks] = useState<Cook[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [recipe, setRecipeState] = useState<Recipe | null>(null);
  const [sections, setSections] = useState<RecipeSection[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [askingClaude, setAskingClaude] = useState(false);
  const kitchenChanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const recipeChanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Rows with in-flight local mutations. Counter, not Set, so concurrent
  // rapid taps on the same row stack correctly. Realtime UPDATEs for rows
  // with count > 0 are skipped — stale echoes from earlier mutations
  // arrive ~200-400ms after the POST response and would clobber the
  // optimistic state. Decrement runs on a delay (~800ms) for the same
  // reason: realtime can arrive after the last POST resolves.
  const pendingTasksRef = useRef<Map<string, number>>(new Map());
  const pendingIngredientsRef = useRef<Map<string, number>>(new Map());

  const incrementPending = (ref: typeof pendingTasksRef, id: string) => {
    ref.current.set(id, (ref.current.get(id) ?? 0) + 1);
  };
  const scheduleDecrementPending = (ref: typeof pendingTasksRef, id: string) => {
    setTimeout(() => {
      const next = (ref.current.get(id) ?? 0) - 1;
      if (next <= 0) ref.current.delete(id);
      else ref.current.set(id, next);
    }, 800);
  };

  // Load (or create) the persistent device id once.
  useEffect(() => {
    getOrCreateDeviceId().then(setDeviceId).catch(() => {
      // If SecureStore fails (extremely unlikely on iOS), fall back to a session-only id.
      setDeviceId(`fallback_${Math.random().toString(36).slice(2, 18)}`);
    });
  }, []);

  // Initial recipe load whenever we connect to a kitchen. Pulls the active recipe
  // (if any) so cooks who joined post-start see the live state. Idempotent — safe
  // to call again after start_cooking flips status.
  const loadActiveRecipe = useCallback(async (kitchenId: string) => {
    const { data: r } = await supabase
      .from('recipes')
      .select('*')
      .eq('kitchen_id', kitchenId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!r) return;
    const recipeId = r.id;
    const [sRes, tRes, iRes] = await Promise.all([
      supabase.from('recipe_sections').select('*').eq('recipe_id', recipeId).order('order_index'),
      supabase.from('tasks').select('*').eq('recipe_id', recipeId).order('order_index'),
      supabase.from('ingredients').select('*').eq('recipe_id', recipeId).order('order_index'),
    ]);
    setRecipeState(r as Recipe);
    setSections((sRes.data ?? []) as RecipeSection[]);
    setTasks((tRes.data ?? []) as Task[]);
    setIngredients((iRes.data ?? []) as Ingredient[]);
  }, []);

  useEffect(() => {
    if (!kitchen) return;
    loadActiveRecipe(kitchen.id);
  }, [kitchen?.id, loadActiveRecipe]);

  // Backgrounded apps drop their Supabase realtime connection. iOS is especially
  // aggressive about this on cellular. When we come back to the foreground we
  // can't trust that we caught every event — refetch the recipe and cook list
  // from REST to recover. Without this, a cook who backgrounded the app right
  // when the host tapped "Start cooking" stays stuck on the Lobby forever.
  useEffect(() => {
    if (!kitchen) return;
    const kitchenId = kitchen.id;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      loadActiveRecipe(kitchenId);
      supabase
        .from('cooks')
        .select('*')
        .eq('kitchen_id', kitchenId)
        .order('joined_at', { ascending: true })
        .then(({ data }) => {
          if (data) setCooks(data as Cook[]);
        });
    });
    return () => sub.remove();
  }, [kitchen?.id, loadActiveRecipe]);

  // Initial chat hydrate — pulls the existing thread so cooks who join a kitchen
  // mid-conversation see the prior questions and answers.
  useEffect(() => {
    if (!kitchen) return;
    const kitchenId = kitchen.id;
    (async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('kitchen_id', kitchenId)
        .order('created_at', { ascending: true });
      setChatMessages((data ?? []) as ChatMessage[]);
    })();
  }, [kitchen?.id]);

  // Channel 1: kitchen-scoped — cooks, kitchens, recipes (all filterable by kitchen_id).
  // CLAUDE.md flags double-subscribing on the same table as a known crash, so we tear
  // down before re-subscribing.
  useEffect(() => {
    if (!kitchen) return;
    const kitchenId = kitchen.id;

    const refetchCooks = async () => {
      const { data } = await supabase
        .from('cooks')
        .select('*')
        .eq('kitchen_id', kitchenId)
        .order('joined_at', { ascending: true });
      if (data) setCooks(data as Cook[]);
    };

    const chan = supabase
      .channel(`kitchen:${kitchenId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cooks', filter: `kitchen_id=eq.${kitchenId}` },
        refetchCooks,
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'kitchens', filter: `id=eq.${kitchenId}` },
        ({ new: updated }) => {
          setKitchen(updated as Kitchen);
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recipes', filter: `kitchen_id=eq.${kitchenId}` },
        (payload) => {
          // When the active recipe row changes, reflect it. When a new recipe goes
          // active, the loadActiveRecipe call below will hydrate sections/tasks/ingredients.
          if (payload.eventType === 'UPDATE') {
            const newRow = payload.new as Recipe;
            setRecipeState((prev) =>
              prev && prev.id === newRow.id ? newRow : prev?.id === newRow.id ? newRow : prev,
            );
            // Status flipped to 'active' — load the rest.
            if (newRow.status === 'active') {
              loadActiveRecipe(kitchenId);
            }
          } else if (payload.eventType === 'INSERT') {
            const newRow = payload.new as Recipe;
            if (newRow.status === 'active') loadActiveRecipe(kitchenId);
          } else if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as Recipe;
            setRecipeState((prev) => (prev?.id === oldRow.id ? null : prev));
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages', filter: `kitchen_id=eq.${kitchenId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as ChatMessage;
            setChatMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as ChatMessage;
            setChatMessages((prev) => prev.filter((m) => m.id !== old.id));
          }
        },
      )
      .subscribe();

    kitchenChanRef.current = chan;

    return () => {
      supabase.removeChannel(chan);
      kitchenChanRef.current = null;
    };
  }, [kitchen?.id, loadActiveRecipe]);

  // Channel 2: recipe-scoped — tasks, ingredients (filterable by recipe_id).
  // Separate channel because the existing kitchen channel doesn't know recipe.id
  // until a recipe is loaded, and we want check-offs to sync with minimal latency.
  useEffect(() => {
    if (!recipe) return;
    const recipeId = recipe.id;

    const chan = supabase
      .channel(`recipe:${recipeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `recipe_id=eq.${recipeId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as Task;
            setTasks((prev) => (prev.some((t) => t.id === row.id) ? prev : [...prev, row]));
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as Task;
            // Skip if we have any pending local mutation on this row — see
            // pendingTasksRef declaration above.
            if ((pendingTasksRef.current.get(row.id) ?? 0) > 0) return;
            setTasks((prev) => prev.map((t) => (t.id === row.id ? row : t)));
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as Task;
            setTasks((prev) => prev.filter((t) => t.id !== old.id));
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ingredients', filter: `recipe_id=eq.${recipeId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as Ingredient;
            setIngredients((prev) => (prev.some((i) => i.id === row.id) ? prev : [...prev, row]));
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as Ingredient;
            if ((pendingIngredientsRef.current.get(row.id) ?? 0) > 0) return;
            setIngredients((prev) => prev.map((i) => (i.id === row.id ? row : i)));
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as Ingredient;
            setIngredients((prev) => prev.filter((i) => i.id !== old.id));
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recipe_sections', filter: `recipe_id=eq.${recipeId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as RecipeSection;
            setSections((prev) =>
              prev.some((s) => s.id === row.id)
                ? prev
                : [...prev, row].sort((a, b) => a.order_index - b.order_index),
            );
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as RecipeSection;
            setSections((prev) => prev.map((s) => (s.id === row.id ? row : s)));
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as RecipeSection;
            setSections((prev) => prev.filter((s) => s.id !== old.id));
          }
        },
      )
      .subscribe();

    recipeChanRef.current = chan;

    return () => {
      supabase.removeChannel(chan);
      recipeChanRef.current = null;
    };
  }, [recipe?.id]);

  const reset = useCallback(() => {
    setKitchen(null);
    setCooks([]);
    setMeId(null);
    setRecipeState(null);
    setSections([]);
    setTasks([]);
    setIngredients([]);
    setChatMessages([]);
    setAskingClaude(false);
  }, []);

  const createKitchen = useCallback(
    async (name: string, color: string) => {
      if (!deviceId) throw new Error('Device not ready');
      const { kitchen: k, cook } = await api.createKitchen({ name, color, deviceId });
      setKitchen(k);
      setCooks([cook]);
      setMeId(cook.id);
    },
    [deviceId],
  );

  const joinKitchen = useCallback(
    async (code: string, name: string, color: string) => {
      if (!deviceId) throw new Error('Device not ready');
      const { kitchen: k, cook, cooks: list } = await api.joinKitchen({
        code,
        name,
        color,
        deviceId,
      });
      setKitchen(k);
      setCooks(list);
      setMeId(cook.id);
    },
    [deviceId],
  );

  const leaveKitchen = useCallback(async () => {
    if (!deviceId || !kitchen) return;
    await api.leaveKitchen({ kitchenId: kitchen.id, deviceId });
    reset();
  }, [deviceId, kitchen, reset]);

  const endKitchen = useCallback(async () => {
    if (!deviceId || !kitchen) return;
    await api.endKitchen({ kitchenId: kitchen.id, deviceId });
    reset();
  }, [deviceId, kitchen, reset]);

  const setSousChef = useCallback(
    async (cookId: string | null) => {
      if (!deviceId || !kitchen) return;
      const { kitchen: updated } = await api.setSousChef({
        kitchenId: kitchen.id,
        deviceId,
        cookId,
      });
      // Reflect the change immediately. Realtime will deliver the same row
      // to every cook (including this one) shortly after; the dedupe is a
      // no-op since the row is identical.
      setKitchen(updated);
    },
    [deviceId, kitchen],
  );

  const setRecipe = useCallback((parsed: ParsedRecipe) => {
    setRecipeState(parsed.recipe);
    setSections(parsed.sections);
    setTasks(parsed.tasks);
    setIngredients(parsed.ingredients);
  }, []);

  const toggleTask = useCallback(
    async (taskId: string, checked: boolean) => {
      if (!kitchen || !deviceId || !meId) return;
      const prev = tasks.find((t) => t.id === taskId);
      if (!prev) return;
      incrementPending(pendingTasksRef, taskId);
      setTasks((curr) =>
        curr.map((t) =>
          t.id === taskId
            ? {
                ...t,
                completed_at: checked ? new Date().toISOString() : null,
                completed_by: checked ? meId : null,
              }
            : t,
        ),
      );
      try {
        await api.toggleCheckbox({
          kitchenId: kitchen.id,
          deviceId,
          kind: 'task',
          id: taskId,
          checked,
        });
        // Intentionally NOT applying the response to state. The optimistic
        // state already reflects the change. Applying a stale response from
        // an earlier rapid-tap iteration would clobber a fresher optimistic.
      } catch (e) {
        setTasks((curr) => curr.map((t) => (t.id === taskId ? prev : t)));
        throw e;
      } finally {
        scheduleDecrementPending(pendingTasksRef, taskId);
      }
    },
    [kitchen, deviceId, meId, tasks],
  );

  const toggleIngredient = useCallback(
    async (ingredientId: string, checked: boolean) => {
      if (!kitchen || !deviceId || !meId) return;
      const prev = ingredients.find((i) => i.id === ingredientId);
      if (!prev) return;
      incrementPending(pendingIngredientsRef, ingredientId);
      setIngredients((curr) =>
        curr.map((i) =>
          i.id === ingredientId
            ? {
                ...i,
                checked_at: checked ? new Date().toISOString() : null,
                checked_by: checked ? meId : null,
              }
            : i,
        ),
      );
      try {
        await api.toggleCheckbox({
          kitchenId: kitchen.id,
          deviceId,
          kind: 'ingredient',
          id: ingredientId,
          checked,
        });
      } catch (e) {
        setIngredients((curr) => curr.map((i) => (i.id === ingredientId ? prev : i)));
        throw e;
      } finally {
        scheduleDecrementPending(pendingIngredientsRef, ingredientId);
      }
    },
    [kitchen, deviceId, meId, ingredients],
  );

  const assignTask = useCallback(
    async (taskId: string, cookId: string | null) => {
      if (!kitchen || !deviceId || !meId) return;
      const prev = tasks.find((t) => t.id === taskId);
      if (!prev) return;
      incrementPending(pendingTasksRef, taskId);
      setTasks((curr) =>
        curr.map((t) =>
          t.id === taskId
            ? { ...t, assigned_to: cookId, assigned_by: cookId === null ? null : meId }
            : t,
        ),
      );
      try {
        await api.assignCheckbox({
          kitchenId: kitchen.id,
          deviceId,
          kind: 'task',
          id: taskId,
          assignTo: cookId,
        });
      } catch (e) {
        setTasks((curr) => curr.map((t) => (t.id === taskId ? prev : t)));
        throw e;
      } finally {
        scheduleDecrementPending(pendingTasksRef, taskId);
      }
    },
    [kitchen, deviceId, meId, tasks],
  );

  const assignIngredient = useCallback(
    async (ingredientId: string, cookId: string | null) => {
      if (!kitchen || !deviceId || !meId) return;
      const prev = ingredients.find((i) => i.id === ingredientId);
      if (!prev) return;
      incrementPending(pendingIngredientsRef, ingredientId);
      setIngredients((curr) =>
        curr.map((i) =>
          i.id === ingredientId
            ? { ...i, assigned_to: cookId, assigned_by: cookId === null ? null : meId }
            : i,
        ),
      );
      try {
        await api.assignCheckbox({
          kitchenId: kitchen.id,
          deviceId,
          kind: 'ingredient',
          id: ingredientId,
          assignTo: cookId,
        });
      } catch (e) {
        setIngredients((curr) => curr.map((i) => (i.id === ingredientId ? prev : i)));
        throw e;
      } finally {
        scheduleDecrementPending(pendingIngredientsRef, ingredientId);
      }
    },
    [kitchen, deviceId, meId, ingredients],
  );

  const dispatchRecipe = useCallback(
    async (action: RecipeAction) => {
      if (!recipe || !deviceId) throw new Error('No active recipe');
      // Apply the full result to state; realtime would deliver the same
      // changes shortly, but this gives the host instant feedback. The
      // realtime echo arrives later as an idempotent no-op.
      const result = await api.updateRecipe({ recipeId: recipe.id, deviceId, action });
      setRecipeState(result.recipe);
      setSections(result.sections);
      setTasks(result.tasks);
      setIngredients(result.ingredients);
    },
    [recipe, deviceId],
  );

  const askClaude = useCallback(
    async (message: string, includeContext: boolean, lastTaskId: string | null) => {
      if (!kitchen || !deviceId) return;
      setAskingClaude(true);
      try {
        // The edge function inserts both the user and assistant rows; realtime
        // delivers them to every cook (including this one) so we don't need to
        // do an optimistic insert here.
        await api.askClaude({
          kitchenId: kitchen.id,
          deviceId,
          message,
          includeContext,
          lastTaskId,
        });
      } finally {
        setAskingClaude(false);
      }
    },
    [kitchen, deviceId],
  );

  const isHost = !!(kitchen && meId && kitchen.main_cook_id === meId);
  const isSousChef = !!(kitchen && meId && kitchen.sous_chef_id === meId);

  const value: KitchenState = {
    ready: deviceId !== null,
    deviceId,
    kitchen,
    cooks,
    meId,
    isHost,
    isSousChef,
    recipe,
    sections,
    tasks,
    ingredients,
    createKitchen,
    joinKitchen,
    leaveKitchen,
    endKitchen,
    setSousChef,
    setRecipe,
    toggleTask,
    toggleIngredient,
    assignTask,
    assignIngredient,
    dispatchRecipe,
    chatMessages,
    askingClaude,
    askClaude,
    reset,
  };

  return <KitchenContext.Provider value={value}>{children}</KitchenContext.Provider>;
}
