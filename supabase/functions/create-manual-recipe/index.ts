// POST /functions/v1/create-manual-recipe
// Body: { kitchenId, deviceId }
// Returns: { recipe, sections, tasks, ingredients }
//
// Host-only. Creates an empty recipe with one starter section ("Steps") so the
// host has something to edit into. Status is 'review' — user fills in title,
// ingredients, and tasks via update-recipe, then taps Start cooking.

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

    const supabase = getAdminClient();

    const { data: kitchen, error: kErr } = await supabase
      .from('kitchens')
      .select('main_cook_id, status')
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
    if (kitchen.main_cook_id !== cook.id) return forbidden('Only the host can add recipes');

    const { data: recipe, error: rErr } = await supabase
      .from('recipes')
      .insert({
        kitchen_id: kitchenId,
        title: '',
        source_type: 'manual',
        status: 'review',
        parsed_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (rErr || !recipe) return serverError(rErr?.message ?? 'Failed to create recipe');

    // Seed a single empty section so the host has somewhere to add their first task.
    const { data: section } = await supabase
      .from('recipe_sections')
      .insert({ recipe_id: recipe.id, order_index: 0, title: 'Steps' })
      .select()
      .single();

    return json({
      recipe,
      sections: section ? [section] : [],
      tasks: [],
      ingredients: [],
    });
  } catch (e) {
    if (e instanceof ValidationError) return badRequest(e.message);
    console.error('[create-manual-recipe]', e);
    return serverError(e instanceof Error ? e.message : undefined);
  }
});
