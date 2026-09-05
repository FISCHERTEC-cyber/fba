import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cookieValue, createUserSession, DEVICE_COOKIE, SESSION_COOKIE } from '@/lib/session-service';
import { signInWithSupabase } from '@/lib/supabase-auth';

const schema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(200),
  takeOver: z.boolean().default(false)
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const identity = await signInWithSupabase(body.email, body.password);
    const session = await createUserSession({
      ...identity,
      deviceToken: cookieValue(request, DEVICE_COOKIE),
      deviceName: deviceName(request),
      takeOver: body.takeOver
    });
    const response = NextResponse.json({ user: { email: session.email } });
    setAuthCookies(response, session.sessionToken, session.deviceToken);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Anmeldung fehlgeschlagen.';
    return NextResponse.json({ error: message }, { status: message === 'ACTIVE_SESSION_EXISTS' ? 409 : 400 });
  }
}

function setAuthCookies(response: NextResponse, sessionToken: string, deviceToken: string) {
  const secure = process.env.NODE_ENV === 'production';
  response.cookies.set(SESSION_COOKIE, sessionToken, { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 30 * 24 * 60 * 60 });
  response.cookies.set(DEVICE_COOKIE, deviceToken, { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 365 * 24 * 60 * 60 });
}

function deviceName(request: Request) {
  const agent = request.headers.get('user-agent') ?? '';
  if (/iPad/i.test(agent)) return 'iPad';
  if (/iPhone/i.test(agent)) return 'iPhone';
  if (/Android/i.test(agent)) return 'Android-Gerät';
  if (/Windows/i.test(agent)) return 'Windows-PC';
  if (/Macintosh/i.test(agent)) return 'Mac';
  return 'Browser';
}
