import assert from 'node:assert/strict';
import test from 'node:test';
import { signInWithSupabase } from '../lib/supabase-auth.ts';

test('Supabase login uses provider response and rejects malformed and failed responses', async () => {
  const oldFetch = globalThis.fetch;
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const oldEnv = process.env.NODE_ENV;
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://provider.example.invalid';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-test-key';
    process.env.NODE_ENV = 'production';
    globalThis.fetch = async (input, init) => {
      assert.equal(String(input), 'https://provider.example.invalid/auth/v1/token?grant_type=password');
      assert.equal(init?.method, 'POST');
      return Response.json({user:{id:'123e4567-e89b-42d3-a456-426614174000', email:'TEST@example.invalid'},
        access_token:'synthetic-token'});
    };
    const result = await signInWithSupabase('test@example.invalid', 'synthetic-password');
    assert.equal(result.email, 'test@example.invalid');
    assert.equal(result.supabaseUserId, '123e4567-e89b-42d3-a456-426614174000');

    globalThis.fetch = async () => Response.json({user:{id:'123e4567-e89b-42d3-a456-426614174000',email:'x@example.invalid'}});
    await assert.rejects(signInWithSupabase('x@example.invalid','synthetic-password'), /keine gültige Sitzung/);
    globalThis.fetch = async () => Response.json({message:'authentication rejected'}, {status:401});
    await assert.rejects(signInWithSupabase('x@example.invalid','synthetic-password'), /authentication rejected/);
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://provider.example.invalid';
    globalThis.fetch = async () => { throw new Error('insecure request reached network'); };
    await assert.rejects(signInWithSupabase('x@example.invalid','synthetic-password'), /HTTPS/);
  } finally {
    globalThis.fetch = oldFetch;
    for (const [key,value] of Object.entries({
      NEXT_PUBLIC_SUPABASE_URL:oldUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY:oldKey, NODE_ENV:oldEnv,
    })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
