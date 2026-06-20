// Edge-function client. All kitchen mutations go through these — never
// hit the kitchens/cooks tables directly from the app.

import { SUPABASE_URL, supabase } from './supabase';

const FN_BASE = `${SUPABASE_URL}/functions/v1`;

export type Cook = {
  id: string;
  kitchen_id: string;
  name: string;
  color: string;
  device_id: string;
  joined_at: string;
  last_seen_at: string;
};

export type Kitchen = {
  id: string;
  code: string;
  name: string;
  status: 'active' | 'ended';
  main_cook_id: string | null;
  sous_chef_id: string | null;
  created_at: string;
  ended_at: string | null;
};

export type Recipe = {
  id: string;
  kitchen_id: string;
  title: string;
  source_path: string | null;
  source_type: 'photo' | 'pdf' | 'manual' | null;
  status: 'parsing' | 'review' | 'active' | 'failed';
  parse_error: string | null;
  parsed_at: string | null;
  created_at: string;
};

export type RecipeSection = {
  id: string;
  recipe_id: string;
  order_index: number;
  title: string;
};

export type Task = {
  id: string;
  recipe_id: string;
  section_id: string;
  order_index: number;
  description: string;
  assigned_to: string | null;
  assigned_by: string | null;
  completed_at: string | null;
  completed_by: string | null;
};

export type Ingredient = {
  id: string;
  recipe_id: string;
  order_index: number;
  name: string;
  quantity: string | null;
  assigned_to: string | null;
  assigned_by: string | null;
  checked_at: string | null;
  checked_by: string | null;
};

export type ParsedRecipe = {
  recipe: Recipe;
  sections: RecipeSection[];
  tasks: Task[];
  ingredients: Ingredient[];
};

export type ChatMessage = {
  id: string;
  kitchen_id: string;
  cook_id: string | null;
  role: 'user' | 'assistant';
  content: string;
  context_task_id: string | null;
  created_at: string;
};

// opts.auth = attach the signed-in host's access token so the function can
// identify them. Harmless when signed out — no token is sent and the function
// falls back to its anonymous path.
async function invoke<T>(name: string, body: unknown, opts?: { auth?: boolean }): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts?.auth) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  const resp = await fetch(`${FN_BASE}/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  let data: any = null;
  try {
    data = await resp.json();
  } catch {
    // body wasn't JSON — fall through to status-based error
  }
  if (!resp.ok) {
    const msg = data?.error || `Request failed (${resp.status})`;
    throw new Error(msg);
  }
  return data as T;
}

export const api = {
  createKitchen: (input: { name: string; color: string; deviceId: string }) =>
    invoke<{ kitchen: Kitchen; cook: Cook }>('create-kitchen', input, { auth: true }),

  deleteAccount: () => invoke<{ ok: true }>('delete-account', {}, { auth: true }),

  joinKitchen: (input: { code: string; name: string; color: string; deviceId: string }) =>
    invoke<{ kitchen: Kitchen; cook: Cook; cooks: Cook[] }>('join-kitchen', input),

  leaveKitchen: (input: { kitchenId: string; deviceId: string }) =>
    invoke<{ ok: true }>('leave-kitchen', input),

  endKitchen: (input: { kitchenId: string; deviceId: string }) =>
    invoke<{ kitchen: Kitchen }>('end-kitchen', input),

  parseRecipe: (
    input:
      | {
          kitchenId: string;
          sourcePath: string;
          sourceType: 'photo' | 'pdf';
          deviceId: string;
        }
      | {
          kitchenId: string;
          text: string;
          sourceType: 'text';
          deviceId: string;
        },
  ) => invoke<ParsedRecipe>('parse-recipe', input),

  createManualRecipe: (input: { kitchenId: string; deviceId: string }) =>
    invoke<ParsedRecipe>('create-manual-recipe', input),

  updateRecipe: (input: {
    recipeId: string;
    deviceId: string;
    action: RecipeAction;
  }) => invoke<ParsedRecipe>('update-recipe', input),

  toggleCheckbox: (input: {
    kitchenId: string;
    deviceId: string;
    kind: 'task' | 'ingredient';
    id: string;
    checked: boolean;
  }) => invoke<{ task?: Task; ingredient?: Ingredient }>('toggle-checkbox', input),

  assignCheckbox: (input: {
    kitchenId: string;
    deviceId: string;
    kind: 'task' | 'ingredient';
    id: string;
    assignTo: string | null;
  }) => invoke<{ task?: Task; ingredient?: Ingredient }>('assign-checkbox', input),

  askClaude: (input: {
    kitchenId: string;
    deviceId: string;
    message: string;
    includeContext: boolean;
    lastTaskId: string | null;
  }) => invoke<{ userMessage: ChatMessage; assistantMessage: ChatMessage }>('ask-claude', input),

  setSousChef: (input: { kitchenId: string; deviceId: string; cookId: string | null }) =>
    invoke<{ kitchen: Kitchen }>('set-sous-chef', input),
};

export type RecipeAction =
  | { type: 'set_title'; title: string }
  | { type: 'add_ingredient'; name: string; quantity: string }
  | { type: 'update_ingredient'; ingredientId: string; name?: string; quantity?: string }
  | { type: 'delete_ingredient'; ingredientId: string }
  | { type: 'add_task'; sectionId: string; description: string }
  | { type: 'update_task'; taskId: string; description: string }
  | { type: 'delete_task'; taskId: string }
  | { type: 'move_task'; taskId: string; targetSectionId: string; targetIndex: number }
  | { type: 'add_section'; title: string }
  | { type: 'update_section'; sectionId: string; title: string }
  | { type: 'delete_section'; sectionId: string }
  | { type: 'start_cooking' };
