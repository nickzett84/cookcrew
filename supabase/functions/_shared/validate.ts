// Input validation shared across edge functions.
// Throws a tagged error so handlers can return a 400 with the message.

export class ValidationError extends Error {}

export function requireString(value: unknown, field: string, opts?: { min?: number; max?: number }): string {
  if (typeof value !== 'string') throw new ValidationError(`Invalid ${field}`);
  const trimmed = value.trim();
  if (opts?.min != null && trimmed.length < opts.min) throw new ValidationError(`${field} too short`);
  if (opts?.max != null && trimmed.length > opts.max) throw new ValidationError(`${field} too long`);
  return trimmed;
}

export function requireHexColor(value: unknown, field = 'color'): string {
  const v = requireString(value, field);
  if (!/^#[0-9A-Fa-f]{6}$/.test(v)) throw new ValidationError(`Invalid ${field}`);
  return v;
}

export function requireUuid(value: unknown, field: string): string {
  const v = requireString(value, field);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) {
    throw new ValidationError(`Invalid ${field}`);
  }
  return v;
}

export function requireKitchenCode(value: unknown): string {
  const v = requireString(value, 'code');
  if (!/^[A-Z0-9]{6}$/.test(v)) throw new ValidationError('Invalid code');
  return v;
}
