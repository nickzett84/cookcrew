// POST /functions/v1/leave-kitchen
// Body: { kitchenId, deviceId }
// Returns: { ok: true }
//
// Removes the caller's cook row. If the leaver is the host, kitchens.main_cook_id
// becomes null (FK is on delete set null). Promoting a new host is a Phase 4
// concern (sous chef takeover) — for now an unhosted kitchen is just unhosted.

import { corsHeaders } from '../_shared/cors.ts';
import { json, badRequest, notFound, serverError } from '../_shared/response.ts';
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

    const { data: cook, error: lookupErr } = await supabase
      .from('cooks')
      .select('id')
      .eq('kitchen_id', kitchenId)
      .eq('device_id', deviceId)
      .maybeSingle();
    if (lookupErr) return serverError(lookupErr.message);
    if (!cook) return notFound('Not a member of this kitchen');

    const { error: delErr } = await supabase.from('cooks').delete().eq('id', cook.id);
    if (delErr) return serverError(delErr.message);

    return json({ ok: true });
  } catch (e) {
    if (e instanceof ValidationError) return badRequest(e.message);
    return serverError();
  }
});
