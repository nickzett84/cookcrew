// POST /functions/v1/end-kitchen
// Body: { kitchenId, deviceId }
// Returns: { kitchen }
//
// Host-only. Marks the kitchen as ended; cook rows stay for audit/history.

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

    // Look up the kitchen + caller's cook row.
    const { data: kitchen, error: kErr } = await supabase
      .from('kitchens')
      .select('*')
      .eq('id', kitchenId)
      .maybeSingle();
    if (kErr) return serverError(kErr.message);
    if (!kitchen) return notFound('Kitchen not found');

    const { data: cook, error: cErr } = await supabase
      .from('cooks')
      .select('id')
      .eq('kitchen_id', kitchenId)
      .eq('device_id', deviceId)
      .maybeSingle();
    if (cErr) return serverError(cErr.message);
    if (!cook) return forbidden('Not a member of this kitchen');

    if (kitchen.main_cook_id !== cook.id) return forbidden('Only the host can end the kitchen');
    if (kitchen.status === 'ended') return json({ kitchen }); // idempotent

    const { data: updated, error: uErr } = await supabase
      .from('kitchens')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', kitchenId)
      .select()
      .single();
    if (uErr || !updated) return serverError(uErr?.message ?? 'Failed to end kitchen');

    return json({ kitchen: updated });
  } catch (e) {
    if (e instanceof ValidationError) return badRequest(e.message);
    return serverError();
  }
});
