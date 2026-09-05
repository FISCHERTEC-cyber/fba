import { NextResponse } from 'next/server';
import { cookieValue, revokeSession, SESSION_COOKIE } from '@/lib/session-service';

export async function POST(request: Request) {
  await revokeSession(cookieValue(request, SESSION_COOKIE));
  const response = NextResponse.json({ signedOut: true });
  response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
  return response;
}
