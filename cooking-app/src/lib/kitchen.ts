import { createContext, useContext } from 'react';
import type { Cook, Kitchen, Recipe, RecipeSection, Task, Ingredient, ParsedRecipe, ChatMessage, RecipeAction } from './api';

export type { Cook, Kitchen, Recipe, RecipeSection, Task, Ingredient, ParsedRecipe, ChatMessage, RecipeAction };

export type KitchenState = {
  ready: boolean;            // device_id loaded yet?
  deviceId: string | null;
  kitchen: Kitchen | null;
  cooks: Cook[];             // kept fresh by realtime subscription
  meId: string | null;
  isHost: boolean;           // head chef
  isSousChef: boolean;       // delegate-capable secondary; head-chef-only powers (edit recipe, end kitchen, appoint sous chef) still require isHost

  // Recipe state — populated when the kitchen has an active recipe.
  // Stays null while the kitchen has no recipe or the recipe is still in
  // 'review' (which is host-local; non-hosts only see it once it goes 'active').
  recipe: Recipe | null;
  sections: RecipeSection[];
  tasks: Task[];
  ingredients: Ingredient[];

  createKitchen: (name: string, color: string) => Promise<void>;
  joinKitchen: (code: string, name: string, color: string) => Promise<void>;
  leaveKitchen: () => Promise<void>;
  endKitchen: () => Promise<void>;
  setSousChef: (cookId: string | null) => Promise<void>;

  // Called by the Recipe Review screen when the host taps "Start cooking!".
  // Pre-populates provider state so the Cooking screen renders immediately
  // without waiting for the realtime UPDATE roundtrip.
  setRecipe: (parsed: ParsedRecipe) => void;

  toggleTask: (taskId: string, checked: boolean) => Promise<void>;
  toggleIngredient: (ingredientId: string, checked: boolean) => Promise<void>;

  assignTask: (taskId: string, cookId: string | null) => Promise<void>;
  assignIngredient: (ingredientId: string, cookId: string | null) => Promise<void>;

  // Host-only recipe edits (used during cooking via CookingScreen).
  // The Review screen has its own local dispatch path with optimistic UI;
  // this is the simpler "fire and rely on realtime to reconcile" version.
  dispatchRecipe: (action: RecipeAction) => Promise<void>;

  // Optimistic drag-and-drop reorder for the Cooking screen (head chef only).
  // The screen computes the reordered task list for instant apply; the provider
  // fires move_task and reconciles with the server result, reverting on error.
  moveTask: (
    action: { taskId: string; targetSectionId: string; targetIndex: number },
    reorderedTasks: Task[],
  ) => Promise<void>;

  // Shared chat thread across the kitchen. Both questions and answers live
  // in `chatMessages`. `askClaude` POSTs the message; the assistant reply
  // arrives via realtime once Claude responds.
  chatMessages: ChatMessage[];
  askingClaude: boolean;
  askClaude: (message: string, includeContext: boolean, lastTaskId: string | null) => Promise<void>;

  reset: () => void;
};

export const KitchenContext = createContext<KitchenState | null>(null);

export function useKitchen(): KitchenState {
  const ctx = useContext(KitchenContext);
  if (!ctx) throw new Error('useKitchen must be used inside <KitchenProvider>');
  return ctx;
}
