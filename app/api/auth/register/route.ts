import { NextResponse } from 'next/server';
import { z } from 'zod';
import { registerWithSupabase } from '@/lib/supabase-auth';

const schema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(10, 'Das Passwort muss mindestens 10 Zeichen haben.').max(200)
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const result = await registerWithSupabase(body.email, body.password);
    return NextResponse.json({
      email: result.email,
      emailConfirmationRequired: !result.signedIn,
      message: result.signedIn ? 'Konto angelegt. Bitte anmelden.' : 'Konto angelegt. Bitte die Bestätigungs-E-Mail öffnen.'
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Registrierung fehlgeschlagen.' }, { status: 400 });
  }
}
