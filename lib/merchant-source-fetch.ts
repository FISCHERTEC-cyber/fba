import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 3;

export interface MerchantSourceFetchInput {
  url: string;
  etag?: string | null;
  lastModified?: string | null;
}

export type MerchantSourceFetchResult =
  | {
      status: 'not-modified';
      finalUrl: string;
      etag?: string;
      lastModified?: string;
    }
  | {
      status: 'fetched';
      finalUrl: string;
      html: string;
      contentHash: string;
      etag?: string;
      lastModified?: string;
    };

export function normaliseMerchantSourceUrl(value: string): string {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Nur HTTP/HTTPS-Quellen sind zulässig.');
  }
  if (url.username || url.password) {
    throw new Error('Händlerquellen dürfen keine Zugangsdaten in der URL enthalten.');
  }

  const hostname = stripIpv6Brackets(url.hostname.toLowerCase().replace(/\.$/, ''));
  if (!hostname || isBlockedHostname(hostname)) {
    throw new Error('Lokale oder interne Händlerquellen sind nicht zulässig.');
  }
  if (isIP(hostname) && !isPublicIpAddress(hostname)) {
    throw new Error('Private oder reservierte IP-Adressen sind nicht zulässig.');
  }

  url.hash = '';
  return url.toString();
}

export async function fetchMerchantSourceDocument(
  input: MerchantSourceFetchInput,
  options: { maxBytes?: number; timeoutMs?: number } = {}
): Promise<MerchantSourceFetchResult> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let currentUrl = normaliseMerchantSourceUrl(input.url);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    await assertPublicDnsTarget(currentUrl);

    const response = await fetch(currentUrl, {
      method: 'GET',
      headers: {
        accept: 'text/html,application/xhtml+xml;q=0.9',
        'user-agent': 'FISCHERTEC-Benefit-Agent/0.5',
        ...(input.etag ? { 'if-none-match': input.etag } : {}),
        ...(input.lastModified ? { 'if-modified-since': input.lastModified } : {})
      },
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs)
    });

    if (isRedirect(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error(`Weiterleitung HTTP ${response.status} ohne Ziel.`);
      if (redirectCount === MAX_REDIRECTS) throw new Error('Zu viele Weiterleitungen der Händlerquelle.');
      currentUrl = normaliseMerchantSourceUrl(new URL(location, currentUrl).toString());
      continue;
    }

    const etag = response.headers.get('etag') ?? undefined;
    const lastModified = response.headers.get('last-modified') ?? undefined;
    if (response.status === 304) {
      return { status: 'not-modified', finalUrl: currentUrl, etag, lastModified };
    }
    if (!response.ok) throw new Error(`Händlerquelle antwortet mit HTTP ${response.status}.`);

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      throw new Error(`Händlerquelle liefert keinen HTML-Inhalt (${contentType.split(';')[0]}).`);
    }

    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      throw new Error(`Händlerquelle überschreitet das Größenlimit von ${maxBytes} Bytes.`);
    }

    const html = await readLimitedText(response, maxBytes);
    return {
      status: 'fetched',
      finalUrl: currentUrl,
      html,
      contentHash: createHash('sha256').update(html).digest('hex'),
      etag,
      lastModified
    };
  }

  throw new Error('Händlerquelle konnte nicht geladen werden.');
}

export function isPublicIpAddress(value: string): boolean {
  const address = stripIpv6Brackets(value.toLowerCase());
  const version = isIP(address);
  if (version === 4) {
    const octets = address.split('.').map(Number);
    const [a, b, c] = octets;
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 192 && b === 88 && c === 99) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    );
  }
  if (version === 6) {
    const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPublicIpAddress(mapped[1]);
    return /^[23][0-9a-f]{0,3}:/.test(address) && !address.startsWith('2001:db8:');
  }
  return false;
}

async function assertPublicDnsTarget(value: string) {
  const url = new URL(value);
  const hostname = stripIpv6Brackets(url.hostname);
  if (isIP(hostname)) {
    if (!isPublicIpAddress(hostname)) throw new Error('Händlerquelle verweist auf eine private oder reservierte IP-Adresse.');
    return;
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(item => !isPublicIpAddress(item.address))) {
    throw new Error('Händlerquelle löst auf eine private oder reservierte IP-Adresse auf.');
  }
}

async function readLimitedText(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error(`Händlerquelle überschreitet das Größenlimit von ${maxBytes} Bytes.`);
    }
    chunks.push(value);
  }

  const combined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(combined);
}

function isBlockedHostname(hostname: string) {
  return hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.home.arpa');
}

function stripIpv6Brackets(value: string) {
  return value.startsWith('[') && value.endsWith(']') ? value.slice(1, -1) : value;
}

function isRedirect(status: number) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}
