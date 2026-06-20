import * as SecureStore from 'expo-secure-store';

// Storage adapter for Supabase Auth that keeps the session in the iOS Keychain
// (encrypted at rest) instead of AsyncStorage (plaintext on disk) — per the
// CLAUDE.md rule for refresh tokens.
//
// expo-secure-store rejects values larger than 2048 bytes, and a Supabase
// session blob (access token + refresh token + user) can exceed that. So we
// chunk on write and reassemble on read. The base key stores the chunk count;
// `<key>.<i>` keys hold the slices.

const CHUNK_SIZE = 2000;

const partKey = (key: string, i: number) => `${key}.${i}`;

async function removeItem(key: string): Promise<void> {
  const countRaw = await SecureStore.getItemAsync(key);
  const count = countRaw ? parseInt(countRaw, 10) : NaN;
  if (Number.isFinite(count)) {
    for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(partKey(key, i));
  }
  await SecureStore.deleteItemAsync(key);
}

export const secureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    const countRaw = await SecureStore.getItemAsync(key);
    if (countRaw == null) return null;
    const count = parseInt(countRaw, 10);
    if (!Number.isFinite(count)) return countRaw; // legacy single-value write
    let out = '';
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(partKey(key, i));
      if (part == null) return null; // partial/corrupt — treat as absent
      out += part;
    }
    return out;
  },

  async setItem(key: string, value: string): Promise<void> {
    // Clear prior chunks first so a shorter new value can't leave stale tails.
    await removeItem(key);
    const count = Math.ceil(value.length / CHUNK_SIZE) || 1;
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(partKey(key, i), value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
    }
    await SecureStore.setItemAsync(key, String(count));
  },

  removeItem,
};
