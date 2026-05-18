// POST /functions/v1/update-recipe
// Body: { recipeId, deviceId, action: { type: ..., ... } }
// Returns: { recipe, sections, tasks, ingredients }
//
// Host-only. The action discriminator covers:
//   set_title         { title }
//   add_ingredient    { name, quantity }
//   update_ingredient { ingredientId, name?, quantity? }
//   delete_ingredient { ingredientId }
//   add_task          { sectionId, description }
//   update_task       { taskId, description }
//   delete_task       { taskId }
//   start_cooking     -- sets recipe.status = 'active'
//
// Always returns the full updated recipe state so the client can re-sync after every edit.

import { corsHeaders } from '../_shared/cors.ts';
import { json, badRequest, notFound, forbidden, serverError } from '../_shared/response.ts';
import { getAdminClient } from '../_shared/supabaseAdmin.ts';
import { requireString, requireUuid, ValidationError } from '../_shared/validate.ts';

type Action =
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return badRequest('Use POST');

  try {
    const body = await req.json();
    const recipeId = requireUuid(body.recipeId, 'recipeId');
    const deviceId = requireString(body.deviceId, 'deviceId', { min: 8, max: 64 });
    const action = body.action as Action | undefined;
    if (!action || typeof action !== 'object' || typeof action.type !== 'string') {
      return badRequest('Missing or invalid action');
    }

    const supabase = getAdminClient();

    // Look up recipe + verify caller is the kitchen's host.
    const { data: recipe, error: rErr } = await supabase
      .from('recipes')
      .select('id, kitchen_id, status')
      .eq('id', recipeId)
      .maybeSingle();
    if (rErr) return serverError(rErr.message);
    if (!recipe) return notFound('Recipe not found');

    const { data: kitchen, error: kErr } = await supabase
      .from('kitchens')
      .select('main_cook_id, status')
      .eq('id', recipe.kitchen_id)
      .maybeSingle();
    if (kErr) return serverError(kErr.message);
    if (!kitchen) return notFound('Kitchen not found');
    if (kitchen.status !== 'active') return forbidden('Kitchen is not active');

    const { data: cook, error: cErr } = await supabase
      .from('cooks')
      .select('id')
      .eq('kitchen_id', recipe.kitchen_id)
      .eq('device_id', deviceId)
      .maybeSingle();
    if (cErr) return serverError(cErr.message);
    if (!cook) return forbidden('Not a member of this kitchen');
    if (kitchen.main_cook_id !== cook.id) return forbidden('Only the host can edit recipes');

    // Apply the action.
    switch (action.type) {
      case 'set_title': {
        const title = requireString(action.title, 'title', { min: 1, max: 200 });
        const { error } = await supabase.from('recipes').update({ title }).eq('id', recipeId);
        if (error) return serverError(error.message);
        break;
      }
      case 'add_ingredient': {
        const name = requireString(action.name, 'name', { min: 1, max: 200 });
        const quantity = requireString(action.quantity, 'quantity', { min: 0, max: 100 });
        const { data: maxRow } = await supabase
          .from('ingredients')
          .select('order_index')
          .eq('recipe_id', recipeId)
          .order('order_index', { ascending: false })
          .limit(1)
          .maybeSingle();
        const next = (maxRow?.order_index ?? -1) + 1;
        const { error } = await supabase
          .from('ingredients')
          .insert({ recipe_id: recipeId, order_index: next, name, quantity });
        if (error) return serverError(error.message);
        break;
      }
      case 'update_ingredient': {
        const ingredientId = requireUuid(action.ingredientId, 'ingredientId');
        const patch: { name?: string; quantity?: string | null } = {};
        if (typeof action.name === 'string') patch.name = action.name.slice(0, 200);
        if (typeof action.quantity === 'string') patch.quantity = action.quantity.slice(0, 100);
        if (Object.keys(patch).length === 0) return badRequest('No fields to update');
        const { error } = await supabase
          .from('ingredients')
          .update(patch)
          .eq('id', ingredientId)
          .eq('recipe_id', recipeId);
        if (error) return serverError(error.message);
        break;
      }
      case 'delete_ingredient': {
        const ingredientId = requireUuid(action.ingredientId, 'ingredientId');
        const { error } = await supabase
          .from('ingredients')
          .delete()
          .eq('id', ingredientId)
          .eq('recipe_id', recipeId);
        if (error) return serverError(error.message);
        break;
      }
      case 'add_task': {
        const sectionId = requireUuid(action.sectionId, 'sectionId');
        const description = requireString(action.description, 'description', { min: 1, max: 500 });
        // Make sure section belongs to this recipe.
        const { data: section } = await supabase
          .from('recipe_sections')
          .select('id')
          .eq('id', sectionId)
          .eq('recipe_id', recipeId)
          .maybeSingle();
        if (!section) return notFound('Section not found in this recipe');
        const { data: maxRow } = await supabase
          .from('tasks')
          .select('order_index')
          .eq('section_id', sectionId)
          .order('order_index', { ascending: false })
          .limit(1)
          .maybeSingle();
        const next = (maxRow?.order_index ?? -1) + 1;
        const { error } = await supabase
          .from('tasks')
          .insert({ recipe_id: recipeId, section_id: sectionId, order_index: next, description });
        if (error) return serverError(error.message);
        break;
      }
      case 'update_task': {
        const taskId = requireUuid(action.taskId, 'taskId');
        const description = requireString(action.description, 'description', { min: 1, max: 500 });
        const { error } = await supabase
          .from('tasks')
          .update({ description })
          .eq('id', taskId)
          .eq('recipe_id', recipeId);
        if (error) return serverError(error.message);
        break;
      }
      case 'delete_task': {
        const taskId = requireUuid(action.taskId, 'taskId');
        const { error } = await supabase
          .from('tasks')
          .delete()
          .eq('id', taskId)
          .eq('recipe_id', recipeId);
        if (error) return serverError(error.message);
        break;
      }
      case 'move_task': {
        const taskId = requireUuid(action.taskId, 'taskId');
        const targetSectionId = requireUuid(action.targetSectionId, 'targetSectionId');
        const targetIndex =
          typeof action.targetIndex === 'number' && Number.isInteger(action.targetIndex) && action.targetIndex >= 0
            ? action.targetIndex
            : null;
        if (targetIndex === null) return badRequest('targetIndex must be a non-negative integer');

        // Verify target section belongs to this recipe.
        const { data: targetSection } = await supabase
          .from('recipe_sections')
          .select('id')
          .eq('id', targetSectionId)
          .eq('recipe_id', recipeId)
          .maybeSingle();
        if (!targetSection) return notFound('Target section not found in this recipe');

        // Verify task belongs to this recipe.
        const { data: task } = await supabase
          .from('tasks')
          .select('id, section_id, order_index')
          .eq('id', taskId)
          .eq('recipe_id', recipeId)
          .maybeSingle();
        if (!task) return notFound('Task not found in this recipe');

        // Strategy: pull all tasks across the recipe ordered by (section, order),
        // remove the target, splice it into the new section at targetIndex, then
        // re-write order_index for each affected section. order_index is per-section
        // in the schema, so cross-section moves require renumbering both sections.
        const { data: allTasks } = await supabase
          .from('tasks')
          .select('id, section_id, order_index')
          .eq('recipe_id', recipeId)
          .order('section_id')
          .order('order_index');
        if (!allTasks) return serverError('Could not load tasks');

        // Tasks in the source section, sans the moving task.
        const sourceList = allTasks
          .filter((t) => t.section_id === task.section_id && t.id !== taskId)
          .sort((a, b) => a.order_index - b.order_index);

        // Tasks in the target section (which may equal source). If same section,
        // we already removed the moving task above, so this is the deduped list.
        const targetListBase =
          targetSectionId === task.section_id
            ? sourceList
            : allTasks
                .filter((t) => t.section_id === targetSectionId)
                .sort((a, b) => a.order_index - b.order_index);

        // Splice the moving task into the target list at targetIndex (clamped).
        const clamped = Math.min(Math.max(targetIndex, 0), targetListBase.length);
        const targetList = [
          ...targetListBase.slice(0, clamped),
          { id: taskId, section_id: targetSectionId, order_index: -1 }, // placeholder
          ...targetListBase.slice(clamped),
        ];

        // Re-index. Use temp negative indices first to avoid partial collision races
        // (no unique constraint on (section_id, order_index) but cleaner anyway).
        const renumberOps: Promise<unknown>[] = [];
        for (const t of targetList) {
          renumberOps.push(
            supabase.from('tasks').update({ order_index: -1000 - targetList.indexOf(t) }).eq('id', t.id),
          );
        }
        if (targetSectionId !== task.section_id) {
          for (const t of sourceList) {
            renumberOps.push(
              supabase.from('tasks').update({ order_index: -2000 - sourceList.indexOf(t) }).eq('id', t.id),
            );
          }
        }
        await Promise.all(renumberOps);

        // Now write the real order indices and switch the moving task's section.
        const finalOps: Promise<unknown>[] = [];
        for (let i = 0; i < targetList.length; i++) {
          const t = targetList[i];
          finalOps.push(
            supabase
              .from('tasks')
              .update({ order_index: i, section_id: targetSectionId })
              .eq('id', t.id),
          );
        }
        if (targetSectionId !== task.section_id) {
          for (let i = 0; i < sourceList.length; i++) {
            finalOps.push(
              supabase.from('tasks').update({ order_index: i }).eq('id', sourceList[i].id),
            );
          }
        }
        await Promise.all(finalOps);
        break;
      }
      case 'add_section': {
        const title = requireString(action.title, 'title', { min: 1, max: 100 });
        const { data: maxRow } = await supabase
          .from('recipe_sections')
          .select('order_index')
          .eq('recipe_id', recipeId)
          .order('order_index', { ascending: false })
          .limit(1)
          .maybeSingle();
        const next = (maxRow?.order_index ?? -1) + 1;
        const { error } = await supabase
          .from('recipe_sections')
          .insert({ recipe_id: recipeId, order_index: next, title });
        if (error) return serverError(error.message);
        break;
      }
      case 'update_section': {
        const sectionId = requireUuid(action.sectionId, 'sectionId');
        const title = requireString(action.title, 'title', { min: 1, max: 100 });
        const { error } = await supabase
          .from('recipe_sections')
          .update({ title })
          .eq('id', sectionId)
          .eq('recipe_id', recipeId);
        if (error) return serverError(error.message);
        break;
      }
      case 'delete_section': {
        const sectionId = requireUuid(action.sectionId, 'sectionId');
        // Tasks cascade via FK (recipe_sections → tasks ON DELETE CASCADE).
        const { error } = await supabase
          .from('recipe_sections')
          .delete()
          .eq('id', sectionId)
          .eq('recipe_id', recipeId);
        if (error) return serverError(error.message);
        break;
      }
      case 'start_cooking': {
        const { error } = await supabase
          .from('recipes')
          .update({ status: 'active' })
          .eq('id', recipeId);
        if (error) return serverError(error.message);
        break;
      }
      default:
        return badRequest(`Unknown action type: ${(action as { type: string }).type}`);
    }

    // Return the full updated state.
    const [
      { data: updatedRecipe },
      { data: sections },
      { data: tasks },
      { data: ingredients },
    ] = await Promise.all([
      supabase.from('recipes').select('*').eq('id', recipeId).single(),
      supabase.from('recipe_sections').select('*').eq('recipe_id', recipeId).order('order_index'),
      supabase.from('tasks').select('*').eq('recipe_id', recipeId).order('order_index'),
      supabase.from('ingredients').select('*').eq('recipe_id', recipeId).order('order_index'),
    ]);

    return json({
      recipe: updatedRecipe,
      sections: sections ?? [],
      tasks: tasks ?? [],
      ingredients: ingredients ?? [],
    });
  } catch (e) {
    if (e instanceof ValidationError) return badRequest(e.message);
    console.error('[update-recipe]', e);
    return serverError(e instanceof Error ? e.message : undefined);
  }
});
