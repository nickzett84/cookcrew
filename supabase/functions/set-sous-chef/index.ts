// POST /functions/v1/set-sous-chef
// Body: { kitchenId, deviceId, cookId: string | null }
// Returns: { kitchen: Kitchen }
//
// Host-only. cookId = null clears the sous chef. cookId = a valid non-host
// cook in this kitchen sets that cook as sous chef. Idempotent.

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
    let cookId: string | null;
    if (body.cookId === null) {
      cookId = null;
    } else {
      cookId = requireUuid(body.cookId, 'cookId');
    }

    const supabase = getAdminClient();

    // Auth: caller must be the kitchen's host.
    const { data: kitchen, error: kErr } = await supabase
      .from('kitchens')
      .select('id, status, main_cook_id')
      .eq('id', kitchenId)
      .maybeSingle();
    if (kErr) return serverError(kErr.message);
    if (!kitchen) return notFound('Kitchen not found');
    if (kitchen.status !== 'active') return forbidden('Kitchen is not active');

    const { data: caller, error: cErr } = await supabase
      .from('cooks')
      .select('id')
      .eq('kitchen_id', kitchenId)
      .eq('device_id', deviceId)
      .maybeSingle();
    if (cErr) return serverError(cErr.message);
    if (!caller) return forbidden('Not a member of this kitchen');
    if (kitchen.main_cook_id !== caller.id) return forbidden('Only the host can appoint a sous chef');

    // If setting, verify target is in this kitchen and isn't the host.
    if (cookId !== null) {
      if (cookId === kitchen.main_cook_id) return badRequest('Host cannot also be sous chef');
      const { data: target } = await supabase
        .from('cooks')
        .select('id')
        .eq('kitchen_id', kitchenId)
        .eq('id', cookId)
        .maybeSingle();
      if (!target) return badRequest('That cook is not in this kitchen');
    }

    const { data: updated, error: uErr } = await supabase
      .from('kitchens')
      .update({ sous_chef_id: cookId })
      .eq('id', kitchenId)
      .select('*')
      .single();
    if (uErr) return serverError(uErr.message);

    return json({ kitchen: updated });
  } catch (e) {
    if (e instanceof ValidationError) return badRequest(e.message);
    console.error('[set-sous-chef]', e);
    return serverError(e instanceof Error ? e.message : undefined);
  }
});
