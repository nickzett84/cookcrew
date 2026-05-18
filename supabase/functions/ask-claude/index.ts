// POST /functions/v1/ask-claude
// Body: { kitchenId, deviceId, message, includeContext, lastTaskId? }
// Returns: { userMessage, assistantMessage }
//
// Any cook in the kitchen can ask. Chat is shared — every cook sees every
// question and answer via realtime on chat_messages.
//
// Calls Claude Haiku 4.5. When includeContext is true, the system prompt
// embeds the current recipe (title, ingredients, sections+tasks) + the
// description of the most recently tapped task. The persona block is marked
// cacheable so repeated turns within a kitchen reuse the cached prefix.

import { corsHeaders } from '../_shared/cors.ts';
import { json, badRequest, notFound, forbidden, serverError } from '../_shared/response.ts';
import { getAdminClient } from '../_shared/supabaseAdmin.ts';
import { requireString, requireUuid, ValidationError } from '../_shared/validate.ts';

const PERSONA = `You are CookCrew, an in-kitchen helper inside a real-time collaborative cooking app. A small group of friends is cooking together right now — you're who they turn to for quick cooking questions while they work.

Style:
- Direct, short, useful. Answers should be 1–3 short paragraphs unless the user explicitly asks for more depth.
- Practical and confident. Skip preamble like "Great question!" and skip closing flourishes.
- Plain prose; no markdown headers or numbered lists unless steps are genuinely required.
- Use US imperial measurements unless the user uses metric. Mention substitutions only when relevant.
- If a question is ambiguous, make a reasonable assumption and answer; don't ask clarifying questions unless absolutely necessary.
- If the question isn't cooking-related, gently redirect and stop.

Recipe context:
- You may or may not be given the recipe the crew is cooking. The user has a toggle in the app called "Include recipe context" that decides whether the recipe is shared with you.
- If a recipe is included as additional context below, use it as the source of truth. The user may also be working on a specific step, but they're free to ask about any step, earlier or later, or about general technique — don't over-anchor on one step.
- If NO recipe context is included AND the question is recipe-specific (references "this", "the sauce", "the next step", or asks what they're cooking), don't claim you have no recipe. Instead, briefly answer what you can in general terms if useful, then tell the user: "Turn on 'Include recipe context' below the message box and I can answer with your specific recipe." Keep it to one short sentence — don't lecture.
- If NO recipe context is included AND the question is generic (substitutions, doneness, technique), just answer as a general cooking assistant. No need to mention the toggle.`;

type ChatMessageRow = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return badRequest('Use POST');

  try {
    const body = await req.json();
    const kitchenId = requireUuid(body.kitchenId, 'kitchenId');
    const deviceId = requireString(body.deviceId, 'deviceId', { min: 8, max: 64 });
    const message = requireString(body.message, 'message', { min: 1, max: 2000 });
    const includeContext = body.includeContext !== false;
    const lastTaskId =
      body.lastTaskId === null || body.lastTaskId === undefined
        ? null
        : requireUuid(body.lastTaskId, 'lastTaskId');

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return json(
        { error: 'Ask Claude is offline. The Anthropic API key has not been configured yet.' },
        503,
      );
    }

    const supabase = getAdminClient();

    // Auth: kitchen membership.
    const { data: kitchen, error: kErr } = await supabase
      .from('kitchens')
      .select('id, status')
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

    // Insert the user's message first so it appears in every cook's thread
    // immediately via realtime, before Claude responds.
    const { data: userMessage, error: umErr } = await supabase
      .from('chat_messages')
      .insert({
        kitchen_id: kitchenId,
        cook_id: cook.id,
        role: 'user',
        content: message,
        context_task_id: lastTaskId,
      })
      .select('*')
      .single();
    if (umErr || !userMessage) return serverError(umErr?.message ?? 'Failed to save message');

    // Build the system prompt. Persona is cacheable; recipe context is a
    // second block (changes infrequently but isn't required for the cache
    // to be useful — the persona alone is enough for Haiku's 4096 minimum
    // most of the time after a few exchanges).
    let recipeContext = '';
    if (includeContext) {
      const { data: recipe } = await supabase
        .from('recipes')
        .select('id, title')
        .eq('kitchen_id', kitchenId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (recipe) {
        const [{ data: sections }, { data: tasks }, { data: ingredients }] = await Promise.all([
          supabase
            .from('recipe_sections')
            .select('id, title, order_index')
            .eq('recipe_id', recipe.id)
            .order('order_index'),
          supabase
            .from('tasks')
            .select('id, section_id, description, order_index, completed_at')
            .eq('recipe_id', recipe.id)
            .order('order_index'),
          supabase
            .from('ingredients')
            .select('id, name, quantity, checked_at')
            .eq('recipe_id', recipe.id)
            .order('order_index'),
        ]);

        const lines: string[] = [];
        lines.push(`Recipe: ${recipe.title || 'Untitled recipe'}`);
        if (ingredients && ingredients.length > 0) {
          lines.push('', 'Ingredients:');
          for (const i of ingredients) {
            const status = i.checked_at ? ' [bought]' : '';
            const q = i.quantity ? ` — ${i.quantity}` : '';
            lines.push(`- ${i.name}${q}${status}`);
          }
        }
        if (sections && tasks) {
          lines.push('', 'Steps:');
          for (const sec of sections) {
            lines.push('', `${sec.title}:`);
            const sectionTasks = tasks
              .filter((t) => t.section_id === sec.id)
              .sort((a, b) => a.order_index - b.order_index);
            for (const t of sectionTasks) {
              const status = t.completed_at ? ' [done]' : '';
              lines.push(`- ${t.description}${status}`);
            }
          }
        }

        if (lastTaskId) {
          const last = (tasks ?? []).find((t) => t.id === lastTaskId);
          if (last) {
            lines.push('', `The crew is currently on: "${last.description}". They may be asking about this step, but they may also ask about earlier or later steps, ingredients, or general technique — treat this as where they are, not what they must ask about.`);
          }
        }

        recipeContext = lines.join('\n');
      }
    }

    // Pull recent shared chat history. Keep the window short — most cooking
    // questions don't need prior turns; the recipe is the heavy context.
    //
    // When the user turns off recipe context, also drop chat history. Prior
    // answers in this thread were probably recipe-grounded, so feeding them
    // back as context would smuggle the recipe in through the side door —
    // which is exactly what the toggle is meant to prevent.
    let history: ChatMessageRow[] = [];
    if (includeContext) {
      const { data: historyRows } = await supabase
        .from('chat_messages')
        .select('id, role, content, created_at')
        .eq('kitchen_id', kitchenId)
        .neq('id', userMessage.id)
        .order('created_at', { ascending: false })
        .limit(10);
      history = (historyRows ?? []).reverse() as ChatMessageRow[];
    }

    const systemBlocks: { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }[] = [
      { type: 'text', text: PERSONA, cache_control: { type: 'ephemeral' } },
    ];
    if (recipeContext) {
      systemBlocks.push({ type: 'text', text: recipeContext });
    }

    const claudeMessages = [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: message },
    ];

    const apiResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemBlocks,
        messages: claudeMessages,
      }),
    });

    if (!apiResp.ok) {
      const errBody = await apiResp.text();
      console.error('[ask-claude] Anthropic error', apiResp.status, errBody);
      return json({ error: "Couldn't reach Claude. Try again." }, 502);
    }

    const apiData = await apiResp.json();
    const textBlock = (apiData.content ?? []).find((b: { type: string }) => b.type === 'text');
    const reply = typeof textBlock?.text === 'string' ? textBlock.text.trim() : '';
    if (!reply) {
      return json({ error: 'Claude returned an empty answer. Try again.' }, 502);
    }

    const { data: assistantMessage, error: amErr } = await supabase
      .from('chat_messages')
      .insert({
        kitchen_id: kitchenId,
        cook_id: null,
        role: 'assistant',
        content: reply,
        context_task_id: lastTaskId,
      })
      .select('*')
      .single();
    if (amErr || !assistantMessage) return serverError(amErr?.message ?? 'Failed to save reply');

    return json({ userMessage, assistantMessage });
  } catch (e) {
    if (e instanceof ValidationError) return badRequest(e.message);
    console.error('[ask-claude]', e);
    return serverError(e instanceof Error ? e.message : undefined);
  }
});
