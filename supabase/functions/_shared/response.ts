import { corsHeaders } from './cors.ts';

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

export function badRequest(message: string): Response {
  return json({ error: message }, 400);
}

export function notFound(message = 'Not found'): Response {
  return json({ error: message }, 404);
}

export function forbidden(message = 'Forbidden'): Response {
  return json({ error: message }, 403);
}

export function conflict(message: string): Response {
  return json({ error: message }, 409);
}

export function serverError(message = 'Server error'): Response {
  return json({ error: message }, 500);
}
