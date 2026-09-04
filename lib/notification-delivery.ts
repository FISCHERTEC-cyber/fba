export interface EmailDeliveryMessage {
  notificationId: string;
  to: string;
  subject: string;
  text: string;
  metadata?: unknown;
}

export interface EmailDeliveryResult {
  providerMessageId?: string;
}

export interface EmailDeliveryAdapter {
  send(message: EmailDeliveryMessage): Promise<EmailDeliveryResult>;
}

export class HttpEmailDeliveryAdapter implements EmailDeliveryAdapter {
  private readonly endpoint: URL;
  private readonly token?: string;
  private readonly request: typeof fetch;

  constructor(
    endpoint: string,
    token?: string,
    request: typeof fetch = fetch
  ) {
    this.endpoint = validateDeliveryEndpoint(endpoint);
    this.token = token;
    this.request = request;
  }

  async send(message: EmailDeliveryMessage): Promise<EmailDeliveryResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await this.request(this.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': message.notificationId,
          ...(this.token ? { authorization: `Bearer ${this.token}` } : {})
        },
        body: JSON.stringify(message),
        signal: controller.signal
      });
      const responseText = (await response.text()).slice(0, 2_000);
      if (!response.ok) {
        throw new Error(`E-Mail-Provider antwortete mit HTTP ${response.status}${responseText ? `: ${responseText}` : '.'}`);
      }
      if (!responseText) return {};
      try {
        const payload = JSON.parse(responseText) as { id?: unknown; messageId?: unknown };
        const providerMessageId = typeof payload.messageId === 'string'
          ? payload.messageId
          : typeof payload.id === 'string' ? payload.id : undefined;
        return { providerMessageId };
      } catch {
        return {};
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Zeitüberschreitung beim E-Mail-Provider.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createEmailDeliveryAdapterFromEnv() {
  const endpoint = process.env.NOTIFICATION_DELIVERY_URL?.trim();
  if (!endpoint) throw new Error('NOTIFICATION_DELIVERY_URL ist nicht konfiguriert.');
  return new HttpEmailDeliveryAdapter(endpoint, process.env.NOTIFICATION_DELIVERY_TOKEN?.trim());
}

export function nextDeliveryAttemptAt(attemptNumber: number, now = new Date()) {
  const exponent = Math.max(0, Math.trunc(attemptNumber) - 1);
  const delayMinutes = Math.min(24 * 60, 15 * 2 ** exponent);
  return new Date(now.getTime() + delayMinutes * 60_000);
}

function validateDeliveryEndpoint(value: string) {
  let endpoint: URL;
  try {
    endpoint = new URL(value);
  } catch {
    throw new Error('NOTIFICATION_DELIVERY_URL ist ungültig.');
  }
  if (endpoint.protocol !== 'https:' && endpoint.protocol !== 'http:') {
    throw new Error('NOTIFICATION_DELIVERY_URL muss HTTP oder HTTPS verwenden.');
  }
  if (process.env.NODE_ENV === 'production' && endpoint.protocol !== 'https:') {
    throw new Error('NOTIFICATION_DELIVERY_URL muss in Produktion HTTPS verwenden.');
  }
  return endpoint;
}
