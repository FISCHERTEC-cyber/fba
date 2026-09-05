import { createHash, randomBytes } from 'node:crypto';

export const SESSION_COOKIE = 'fba_session';
export const DEVICE_COOKIE = 'fba_device';
export const SESSION_LEASE_MS = 15 * 60_000;
export const MAX_DEVICES = 5;

export function tokenHash(token: string) { return createHash('sha256').update(token).digest('hex'); }
export function newOpaqueToken() { return randomBytes(32).toString('base64url'); }

export function cookieValue(request: Request, name: string) {
  const item = (request.headers.get('cookie') ?? '').split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : undefined;
}
