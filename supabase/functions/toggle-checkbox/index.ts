// POST /functions/v1/toggle-checkbox
// Body: { kitchenId, deviceId, kind: 'task' | 'ingredient', id, checked }
// Returns: { task: Task } or { ingredient: Ingredient }
//
// Any cook in the kitchen can check/uncheck — not host-only. The check writes
// `completed_at` + `completed_by` (for tasks) or `checked_at` + `checked_by`
// (for ingredients). Unchecking nulls both.

import { corsHeaders } from '../_shared/cors.ts';
import { json, badRequest, notFound, forbidden, serverError } from '../_shared/response.ts';
import { getAdminClient } from '../_shared/supabaseAdmin.ts';
import { requireString, requireUuid, ValidationError } from '../_shared/validate.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return badRequest('Use POST');

  try {
    const body = await req.json();
    const kitchenId = requireUuid(body.kitchenId, 'kitchenId');
    const deviceId = requireString(body.deviceId, 'deviceId', { min: 8, max: 64 });
    const id = requireUuid(body.id, 'id');
    const kind = body.kind;
    if (kind !== 'task' && kind !== 'ingredient') {
      return badRequest("kind must be 'task' or 'ingredient'");
    }
    if (typeof body.checked !== 'boolean') {
      return badRequest('checked must be a boolean');
    }
    const checked: boolean = body.checked;

    const supabase = getAdminClient();

    // Verify caller is a cook in this kitchen.
    const { data: cook, error: cErr } = await supabase
      .from('cooks')
      .select('id')
      .eq('kitchen_id', kitchenId)
      .eq('device_id', deviceId)
      .maybeSingle();
    if (cErr) return serverError(cErr.message);
    if (!cook) return forbidden('Not a member of this kitchen');

    // Verify kitchen is active.
    const { data: kitchen, error: kErr } = await supabase
      .from('kitchens')
      .select('status')
      .eq('id', kitchenId)
      .maybeSingle();
    if (kErr) return serverError(kErr.message);
    if (!kitchen) return notFound('Kitchen not found');
    if (kitchen.status !== 'active') return forbidden('Kitchen is not active');

    // Verify target row belongs to a recipe in this kitchen.
    if (kind === 'task') {
      const { data: row, error: tErr } = await supabase
        .from('tasks')
        .select('id, recipe_id, recipes!inner(kitchen_id)')
        .eq('id', id)
        .maybeSingle();
      if (tErr) return serverError(tErr.message);
      if (!row || (row as { recipes: { kitchen_id: string } }).recipes.kitchen_id !== kitchenId) {
        return notFound('Task not in this kitchen');
      }

      const patch = checked
        ? { completed_at: new Date().toISOString(), completed_by: cook.id }
        : { completed_at: null, completed_by: null };
      const { data: updated, error: uErr } = await supabase
        .from('tasks')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (uErr) return serverError(uErr.message);
      return json({ task: updated });
    }

    // kind === 'ingredient'
    const { data: row, error: iErr } = await supabase
      .from('ingredients')
      .select('id, recipe_id, recipes!inner(kitchen_id)')
      .eq('id', id)
      .maybeSingle();
    if (iErr) return serverError(iErr.message);
    if (!row || (row as { recipes: { kitchen_id: string } }).recipes.kitchen_id !== kitchenId) {
      return notFound('Ingredient not in this kitchen');
    }

    const patch = checked
      ? { checked_at: new Date().toISOString(), checked_by: cook.id }
      : { checked_at: null, checked_by: null };
    const { data: updated, error: uErr } = await supabase
      .from('ingredients')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (uErr) return serverError(uErr.message);
    return json({ ingredient: updated });
  } catch (e) {
    if (e instanceof ValidationError) return badRequest(e.message);
    console.error('[toggle-checkbox]', e);
    return serverError(e instanceof Error ? e.message : undefined);
  }
});
