// POST /functions/v1/assign-checkbox
// Body: { kitchenId, deviceId, kind: 'task' | 'ingredient', id, assignTo: string | null }
// Returns: { task: Task } or { ingredient: Ingredient }
//
// Auth model:
//   - Head chef OR sous chef: can assign anyone, can unassign (assignTo=null) anyone.
//   - Anyone else: can only TAKE an unassigned row for themselves
//     (assignTo === caller.id AND row.assigned_to === null).
//     Cannot reassign, give back, or modify someone else's assignment.
//
// Sets assigned_by to the caller's cook id whenever assignTo is non-null.

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
    let assignTo: string | null;
    if (body.assignTo === null) {
      assignTo = null;
    } else {
      assignTo = requireUuid(body.assignTo, 'assignTo');
    }

    const supabase = getAdminClient();

    // Verify caller is a cook in this kitchen + grab kitchen for head-chef / sous check.
    const { data: kitchen, error: kErr } = await supabase
      .from('kitchens')
      .select('main_cook_id, sous_chef_id, status')
      .eq('id', kitchenId)
      .maybeSingle();
    if (kErr) return serverError(kErr.message);
    if (!kitchen) return notFound('Kitchen not found');
    if (kitchen.status !== 'active') return forbidden('Kitchen is not active');

    const { data: cook, error: cErr } = await supabase
      .from('cooks')
      .select('id')
      .eq('kitchen_id', kitchenId)
      .eq('device_id', deviceId)
      .maybeSingle();
    if (cErr) return serverError(cErr.message);
    if (!cook) return forbidden('Not a member of this kitchen');

    const isHead = kitchen.main_cook_id === cook.id;
    const isSous = kitchen.sous_chef_id === cook.id;
    const canManage = isHead || isSous;

    // If assignTo is set, the assignee must also be a cook in this kitchen.
    if (assignTo !== null) {
      const { data: assignee } = await supabase
        .from('cooks')
        .select('id')
        .eq('kitchen_id', kitchenId)
        .eq('id', assignTo)
        .maybeSingle();
      if (!assignee) return badRequest('Assignee is not in this kitchen');
    }

    // Verify target row belongs to a recipe in this kitchen + read current assignment.
    const table = kind === 'task' ? 'tasks' : 'ingredients';
    const { data: row, error: rErr } = await supabase
      .from(table)
      .select('id, assigned_to, recipes!inner(kitchen_id)')
      .eq('id', id)
      .maybeSingle();
    if (rErr) return serverError(rErr.message);
    if (!row || (row as { recipes: { kitchen_id: string } }).recipes.kitchen_id !== kitchenId) {
      return notFound(kind === 'task' ? 'Task not in this kitchen' : 'Ingredient not in this kitchen');
    }
    const currentAssignedTo: string | null = (row as { assigned_to: string | null }).assigned_to;

    // Non-managers can only "take an unassigned row for yourself".
    if (!canManage) {
      if (assignTo !== cook.id) return forbidden('Only the head chef or sous chef can assign this');
      if (currentAssignedTo !== null) return forbidden('Already assigned');
    }

    const patch =
      assignTo === null
        ? { assigned_to: null, assigned_by: null }
        : { assigned_to: assignTo, assigned_by: cook.id };
    const { data: updated, error: uErr } = await supabase
      .from(table)
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (uErr) return serverError(uErr.message);

    return json(kind === 'task' ? { task: updated } : { ingredient: updated });
  } catch (e) {
    if (e instanceof ValidationError) return badRequest(e.message);
    console.error('[assign-checkbox]', e);
    return serverError(e instanceof Error ? e.message : undefined);
  }
});
