// Persistent per-install device identifier. Stored in iOS Keychain via
// expo-secure-store, never in plaintext on disk. This is the cook's
// credential in v1 — see DESIGN.md §12.

import * as SecureStore from 'expo-secure-store';

const KEY = 'cookcrew.deviceId';

function generate(): string {
  // 24 chars of url-safe random — enough entropy for v1, fits the
  // [8, 64] length window the edge functions enforce.
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY);
  if (existing) return existing;
  const fresh = generate();
  await SecureStore.setItemAsync(KEY, fresh);
  return fresh;
}
