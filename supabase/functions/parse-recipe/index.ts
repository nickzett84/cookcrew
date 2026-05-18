// POST /functions/v1/parse-recipe
// Body: { kitchenId, sourcePath, sourceType: 'photo' | 'pdf', deviceId }
// Returns: { recipe, sections, tasks, ingredients }
//
// Host-only. Uploads must be in the recipe-uploads bucket already (the client
// uploads via storage.from('recipe-uploads').upload(path, file) before calling).
//
// Calls Claude Opus 4.7 with the image/PDF via public URL + structured output
// (`output_config.format` with a JSON schema) so the response is guaranteed to
// be valid JSON in the shape we want. The system prompt is cacheable — it's
// reused across every parse and is large enough to clear the 4096-token min.

import { corsHeaders } from '../_shared/cors.ts';
import { json, badRequest, notFound, forbidden, serverError } from '../_shared/response.ts';
import { getAdminClient } from '../_shared/supabaseAdmin.ts';
import { requireString, requireUuid, ValidationError } from '../_shared/validate.ts';

const SYSTEM_PROMPT = `You are parsing a recipe image or PDF for CookCrew, a real-time collaborative cooking app for friends. A group of friends will cook this dish together, and the app will turn your output into a delegated task checklist they can each tick off live as they work through the recipe.

Your output is JSON, with this shape (enforced by the schema):
{
  "title": "...",
  "ingredients": [{ "name": "carrots", "quantity": "2 large" }],
  "sections": [
    {
      "title": "Prep",
      "tasks": ["Mince 4 garlic cloves", "Tear basil leaves into pieces"]
    }
  ]
}

Rules for the title:
- Use the dish's name as written in the recipe. If the photo doesn't show a clear title, infer one from the dish (e.g. "Pasta al Pomodoro").
- Title is up to 80 characters. No emoji.

Rules for ingredients:
- One row per distinct ingredient. Quantity is a human-readable string ("1 lb", "2 large", "½ cup", "to taste").
- Don't merge ingredients (e.g. "salt and pepper" → two rows: salt and pepper, both with quantity "to taste").
- Don't repeat ingredients that appear in multiple steps.

Rules for sections:
- Group tasks into sections by cooking phase ("Prep", "Sauce", "Pasta", "Plate", etc.).
- Tasks within a section should be doable in parallel by different cooks.
- Tasks in later sections may depend on earlier sections being done.
- 1–6 sections is the right range for most home recipes.

Rules for tasks:
- Each task is a single concrete physical action a person can do without consulting anyone else.
- Be specific: "Mince 4 garlic cloves" not "Prep the garlic".
- If a step in the source has multiple sub-actions ("dice the onion and sauté in butter"), split into separate tasks ("Dice 1 large onion", "Heat 2 tbsp butter in a pan, sauté onion until soft").
- Include quantities and times where the source provides them ("Simmer sauce 20 minutes").
- Don't invent steps the recipe doesn't include.

If the image is too blurry or unrelated to a recipe, return your best-effort partial result rather than refusing — the host will review and edit before the kitchen goes live.`;

const RECIPE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          quantity: { type: 'string' },
        },
        required: ['name', 'quantity'],
        additionalProperties: false,
      },
    },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          tasks: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'tasks'],
        additionalProperties: false,
      },
    },
  },
  required: ['title', 'ingredients', 'sections'],
  additionalProperties: false,
} as const;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return badRequest('Use POST');

  try {
    const body = await req.json();
    const kitchenId = requireUuid(body.kitchenId, 'kitchenId');
    const sourcePath = requireString(body.sourcePath, 'sourcePath', { min: 1, max: 500 });
    const sourceType = requireString(body.sourceType, 'sourceType');
    const deviceId = requireString(body.deviceId, 'deviceId', { min: 8, max: 64 });

    if (sourceType !== 'photo' && sourceType !== 'pdf') {
      return badRequest("sourceType must be 'photo' or 'pdf'");
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return json(
        { error: 'Recipe parsing is offline. The Anthropic API key has not been configured yet.' },
        503,
      );
    }

    const supabase = getAdminClient();

    // Auth check: caller must be the kitchen's host.
    const { data: kitchen, error: kErr } = await supabase
      .from('kitchens')
      .select('id, status, main_cook_id')
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
    if (kitchen.main_cook_id !== cook.id) return forbidden('Only the host can import recipes');

    // Public URL for the uploaded file (bucket is public).
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const fileUrl = `${supabaseUrl}/storage/v1/object/public/recipe-uploads/${sourcePath}`;

    const fileBlock =
      sourceType === 'photo'
        ? { type: 'image', source: { type: 'url', url: fileUrl } }
        : { type: 'document', source: { type: 'url', url: fileUrl } };

    // Call Claude. Raw fetch to avoid an npm SDK dependency in the edge runtime.
    const apiResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-7',
        max_tokens: 8000,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        output_config: {
          format: { type: 'json_schema', schema: RECIPE_SCHEMA },
        },
        messages: [
          {
            role: 'user',
            content: [
              fileBlock,
              { type: 'text', text: 'Parse this recipe into the structured JSON format.' },
            ],
          },
        ],
      }),
    });

    if (!apiResp.ok) {
      const errBody = await apiResp.text();
      console.error('[parse-recipe] Anthropic error', apiResp.status, errBody);
      return json(
        { error: "We had trouble reading that. Try a clearer photo, or type it out." },
        502,
      );
    }

    const apiData = await apiResp.json();
    const textBlock = (apiData.content ?? []).find((b: { type: string }) => b.type === 'text');
    if (!textBlock || typeof textBlock.text !== 'string') {
      return json({ error: 'Claude did not return parseable text' }, 502);
    }

    let parsed: { title: string; ingredients: { name: string; quantity: string }[]; sections: { title: string; tasks: string[] }[] };
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      return json({ error: 'Could not parse recipe — try a clearer photo.' }, 502);
    }

    if (
      typeof parsed.title !== 'string' ||
      !Array.isArray(parsed.ingredients) ||
      !Array.isArray(parsed.sections)
    ) {
      return json({ error: 'Recipe response was malformed' }, 502);
    }

    // Persist atomically-ish. Recipe row first, then children. If a child write
    // fails we leave the recipe in 'review' status so the host can still edit
    // and add what's missing — better than wiping the whole thing.
    const { data: recipe, error: rErr } = await supabase
      .from('recipes')
      .insert({
        kitchen_id: kitchenId,
        title: parsed.title.slice(0, 200) || 'Untitled recipe',
        source_path: sourcePath,
        source_type: sourceType,
        status: 'review',
        parsed_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (rErr || !recipe) return serverError(rErr?.message ?? 'Failed to create recipe');

    for (let secIdx = 0; secIdx < parsed.sections.length; secIdx++) {
      const sec = parsed.sections[secIdx];
      if (!sec || typeof sec.title !== 'string' || !Array.isArray(sec.tasks)) continue;
      const { data: section, error: sErr } = await supabase
        .from('recipe_sections')
        .insert({
          recipe_id: recipe.id,
          order_index: secIdx,
          title: sec.title.slice(0, 100) || `Section ${secIdx + 1}`,
        })
        .select()
        .single();
      if (sErr || !section) continue;

      const taskRows = sec.tasks
        .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        .map((t, i) => ({
          recipe_id: recipe.id,
          section_id: section.id,
          order_index: i,
          description: t.slice(0, 500),
        }));
      if (taskRows.length > 0) {
        await supabase.from('tasks').insert(taskRows);
      }
    }

    const ingredientRows = parsed.ingredients
      .filter((i) => i && typeof i.name === 'string' && i.name.trim().length > 0)
      .map((i, idx) => ({
        recipe_id: recipe.id,
        order_index: idx,
        name: i.name.slice(0, 200),
        quantity: typeof i.quantity === 'string' ? i.quantity.slice(0, 100) : null,
      }));
    if (ingredientRows.length > 0) {
      await supabase.from('ingredients').insert(ingredientRows);
    }

    // Return the persisted state so the client doesn't have to re-fetch.
    const [
      { data: sections },
      { data: tasks },
      { data: ingredients },
    ] = await Promise.all([
      supabase.from('recipe_sections').select('*').eq('recipe_id', recipe.id).order('order_index'),
      supabase.from('tasks').select('*').eq('recipe_id', recipe.id).order('order_index'),
      supabase.from('ingredients').select('*').eq('recipe_id', recipe.id).order('order_index'),
    ]);

    return json({
      recipe,
      sections: sections ?? [],
      tasks: tasks ?? [],
      ingredients: ingredients ?? [],
    });
  } catch (e) {
    if (e instanceof ValidationError) return badRequest(e.message);
    console.error('[parse-recipe]', e);
    return json({ error: e instanceof Error ? e.message : 'Server error' }, 500);
  }
});
