import { z } from 'zod';

const authResponseSchema = z.object({
  user: z.object({ id: z.string().uuid(), email: z.string().email().optional() }).nullable().optional(),
  access_token: z.string().optional()
});

export async function signInWithSupabase(email: string, password: string) {
  const response = await supabaseRequest('/auth/v1/token?grant_type=password', { email, password });
  const parsed = authResponseSchema.parse(response);
  if (!parsed.user?.email || !parsed.access_token) throw new Error('Supabase hat keine gültige Sitzung zurückgegeben.');
  return { supabaseUserId: parsed.user.id, email: parsed.user.email.toLowerCase() };
}

export async function registerWithSupabase(email: string, password: string) {
  const response = await supabaseRequest('/auth/v1/signup', { email, password });
  const parsed = authResponseSchema.parse(response);
  if (!parsed.user) throw new Error('Supabase hat kein Benutzerkonto zurückgegeben.');
  return { supabaseUserId: parsed.user.id, email: (parsed.user.email ?? email).toLowerCase(), signedIn: Boolean(parsed.access_token) };
}

async function supabaseRequest(path: string, body: unknown) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!baseUrl || !anonKey) throw new Error('Supabase Auth ist nicht konfiguriert.');
  const url = new URL(path, baseUrl);
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') throw new Error('Supabase muss in Produktion HTTPS verwenden.');
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: anonKey, authorization: `Bearer ${anonKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000)
  });
  const payload = await response.json().catch(() => ({})) as { msg?: string; message?: string; error_description?: string };
  if (!response.ok) throw new Error(payload.error_description || payload.message || payload.msg || 'Anmeldung bei Supabase fehlgeschlagen.');
  return payload;
}
