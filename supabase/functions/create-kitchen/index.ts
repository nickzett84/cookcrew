// POST /functions/v1/create-kitchen
// Body: { name, color, deviceId }
// Returns: { kitchen, cook }

import { corsHeaders } from '../_shared/cors.ts';
import { json, badRequest, serverError } from '../_shared/response.ts';
import { getAdminClient } from '../_shared/supabaseAdmin.ts';
import { generateKitchenCode } from '../_shared/code.ts';
import { requireString, requireHexColor, ValidationError } from '../_shared/validate.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return badRequest('Use POST');

  try {
    const body = await req.json();
    const name = requireString(body.name, 'name', { min: 1, max: 30 });
    const color = requireHexColor(body.color);
    const deviceId = requireString(body.deviceId, 'deviceId', { min: 8, max: 64 });

    const supabase = getAdminClient();

    // Try up to 5 times to get a unique active code.
    let code = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateKitchenCode(6);
      const { data: existing, error: lookupErr } = await supabase
        .from('kitchens')
        .select('id')
        .eq('code', candidate)
        .eq('status', 'active')
        .maybeSingle();
      if (lookupErr) return serverError(lookupErr.message);
      if (!existing) {
        code = candidate;
        break;
      }
    }
    if (!code) return serverError('Could not generate a unique kitchen code');

    // Create the kitchen.
    const { data: kitchen, error: kErr } = await supabase
      .from('kitchens')
      .insert({ code })
      .select()
      .single();
    if (kErr || !kitchen) return serverError(kErr?.message ?? 'Failed to create kitchen');

    // Create the host cook.
    const { data: cook, error: cErr } = await supabase
      .from('cooks')
      .insert({
        kitchen_id: kitchen.id,
        name,
        color,
        device_id: deviceId,
      })
      .select()
      .single();
    if (cErr || !cook) {
      // Roll back the kitchen if the cook insert failed.
      await supabase.from('kitchens').delete().eq('id', kitchen.id);
      return serverError(cErr?.message ?? 'Failed to create cook');
    }

    // Tag the kitchen's host.
    const { data: updated, error: uErr } = await supabase
      .from('kitchens')
      .update({ main_cook_id: cook.id })
      .eq('id', kitchen.id)
      .select()
      .single();
    if (uErr || !updated) return serverError(uErr?.message ?? 'Failed to set host');

    return json({ kitchen: updated, cook });
  } catch (e) {
    if (e instanceof ValidationError) return badRequest(e.message);
    return serverError();
  }
});
