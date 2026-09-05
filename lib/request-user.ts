import { cookieValue, resolveSessionUser, SESSION_COOKIE } from './session-service';

export async function requireUserId(request: Request): Promise<string> {
  const sessionToken = cookieValue(request, SESSION_COOKIE);
  if (!sessionToken) throw new Error('Anmeldung erforderlich.');
  return resolveSessionUser(sessionToken);
}

export function requireWebhookUserId(request: Request): string {
  const userId = request.headers.get('x-fba-user-id')?.trim() || process.env.FBA_INBOUND_USER_ID?.trim();
  if (!userId) throw new Error('Nutzerkontext für den E-Mail-Import fehlt.');
  return userId;
}
