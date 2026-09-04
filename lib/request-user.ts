export function requireUserId(request: Request): string {
  const userId = request.headers.get('x-fba-user-id')?.trim() || process.env.FBA_MVP_USER_ID?.trim();
  if (!userId) {
    throw new Error('Nutzerkontext fehlt. Für MVP FBA_MVP_USER_ID konfigurieren oder x-fba-user-id setzen; später durch Auth ersetzen.');
  }
  return userId;
}
