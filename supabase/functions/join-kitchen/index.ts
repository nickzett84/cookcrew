// POST /functions/v1/join-kitchen
// Body: { code, name, color, deviceId }
// Returns: { kitchen, cook, cooks }

import { corsHeaders } from '../_shared/cors.ts';
import { json, badRequest, notFound, conflict, serverError } from '../_shared/response.ts';
import { getAdminClient } from '../_shared/supabaseAdmin.ts';
import {
  requireString,
  requireHexColor,
  requireKitchenCode,
  ValidationError,
} from '../_shared/validate.ts';

const KITCHEN_MAX = 10;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return badRequest('Use POST');

  try {
    const body = await req.json();
    const code = requireKitchenCode(body.code);
    const name = requireString(body.name, 'name', { min: 1, max: 30 });
    const color = requireHexColor(body.color);
    const deviceId = requireString(body.deviceId, 'deviceId', { min: 8, max: 64 });

    const supabase = getAdminClient();

    // Look up the active kitchen by code.
    const { data: kitchen, error: kErr } = await supabase
      .from('kitchens')
      .select('*')
      .eq('code', code)
      .eq('status', 'active')
      .maybeSingle();
    if (kErr) return serverError(kErr.message);
    if (!kitchen) return notFound("We can't find that kitchen. Check the code with the host.");

    // Check capacity (counts existing cooks).
    const { count, error: countErr } = await supabase
      .from('cooks')
      .select('*', { count: 'exact', head: true })
      .eq('kitchen_id', kitchen.id);
    if (countErr) return serverError(countErr.message);
    if ((count ?? 0) >= KITCHEN_MAX) return conflict('This kitchen is full (10 cooks max).');

    // If this device is already a cook in this kitchen, return that cook (idempotent rejoin).
    const { data: existing, error: exErr } = await supabase
      .from('cooks')
      .select('*')
      .eq('kitchen_id', kitchen.id)
      .eq('device_id', deviceId)
      .maybeSingle();
    if (exErr) return serverError(exErr.message);

    let cook;
    if (existing) {
      // Optionally refresh name/color if the user changed them. Touch last_seen_at.
      const { data: updated, error: uErr } = await supabase
        .from('cooks')
        .update({ name, color, last_seen_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();
      if (uErr || !updated) return serverError(uErr?.message ?? 'Failed to rejoin');
      cook = updated;
    } else {
      const { data: inserted, error: iErr } = await supabase
        .from('cooks')
        .insert({
          kitchen_id: kitchen.id,
          name,
          color,
          device_id: deviceId,
        })
        .select()
        .single();
      if (iErr || !inserted) return serverError(iErr?.message ?? 'Failed to create cook');
      cook = inserted;
    }

    // Return the full current cook list so the joiner sees who's already there.
    const { data: cooks, error: lErr } = await supabase
      .from('cooks')
      .select('*')
      .eq('kitchen_id', kitchen.id)
      .order('joined_at', { ascending: true });
    if (lErr) return serverError(lErr.message);

    return json({ kitchen, cook, cooks: cooks ?? [] });
  } catch (e) {
    if (e instanceof ValidationError) return badRequest(e.message);
    return serverError();
  }
});
