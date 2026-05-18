// 6-character kitchen code generator.
// Ambiguous letters (I, O, Q, L, U) and digits (0, 1) excluded.
// Mirrors src/lib/code.ts in the app — keep them in sync.

const ALPHABET = 'ABCDEFGHJKMNPRSTVWXYZ23456789';

export function generateKitchenCode(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}
