// Uploads an image or PDF to the recipe-uploads bucket and returns the
// path-within-bucket. The bucket is public; the parse-recipe edge function
// reads via public URL.

import { supabase } from './supabase';

const BUCKET = 'recipe-uploads';

export async function uploadRecipeFile(
  kitchenId: string,
  uri: string,
  contentType: string,
): Promise<string> {
  const ext = (() => {
    if (contentType.includes('jpeg')) return 'jpg';
    if (contentType.includes('png')) return 'png';
    if (contentType.includes('webp')) return 'webp';
    if (contentType.includes('heic') || contentType.includes('heif')) return 'heic';
    if (contentType.includes('pdf')) return 'pdf';
    return 'bin';
  })();

  // 16 bytes of randomness as a hex string — RN doesn't ship crypto.randomUUID,
  // but react-native-get-random-values polyfills crypto.getRandomValues.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const random = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const filename = `${random}.${ext}`;
  const path = `${kitchenId}/${filename}`;

  // Fetch the local file URI and convert to ArrayBuffer for the Supabase upload.
  const resp = await fetch(uri);
  if (!resp.ok) throw new Error('Could not read the selected file.');
  const blob = await resp.blob();
  const arrayBuffer = await new Response(blob).arrayBuffer();

  const { error } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);

  return path;
}
