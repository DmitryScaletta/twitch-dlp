type CDPError = {
  message: string;
  code: number;
  data?: unknown;
};

type CDPEvents = {
  'Network.responseReceived': {
    requestId: string;
    type: string;
    response: { url: string; status: number };
  };
  'Network.loadingFinished': {
    requestId: string;
    timestamp: number;
    encodedDataLength: number;
  };
};

type ResolverPair = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

export class CDP {
  private ws: WebSocket | null = null;
  private timeoutMs: number | null = null;
  private id = 1;
  private pendingResolvers = new Map<number, ResolverPair>();
  private eventListeners = new Map<string, (params: unknown) => void>();

  static create() {
    return new CDP();
  }

  async connect(wsUrl: string, timeoutMs: number | null = null) {
    this.timeoutMs = timeoutMs;
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);

      this.ws.addEventListener('open', resolve);
      this.ws.addEventListener('error', () =>
        reject(new Error('Failed to connect to WebSocket')),
      );

      this.ws.addEventListener('message', (event) => {
        const msg = JSON.parse(event.data as string) as Record<string, unknown>;

        // Command response
        if (typeof msg.id === 'number' && this.pendingResolvers.has(msg.id)) {
          const { resolve, reject } = this.pendingResolvers.get(msg.id)!;
          this.pendingResolvers.delete(msg.id);

          if (msg.error) {
            reject(new Error((msg.error as CDPError).message));
          } else {
            resolve(msg.result);
          }
        }

        // Event
        if (
          typeof msg.method === 'string' &&
          this.eventListeners.has(msg.method)
        ) {
          this.eventListeners.get(msg.method)!(msg.params);
        }
      });
    });
  }

  send(method: 'Network.enable'): Promise<void>;
  send(
    method: 'Network.getResponseBody',
    params: { requestId: string },
  ): Promise<{ base64Encoded: boolean; body: string }>;
  send(method: 'Page.enable'): Promise<void>;
  send(method: 'Page.navigate', params: { url: string }): Promise<unknown>;
  send(method: 'Browser.close'): Promise<void>;
  send(method: string, params?: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('WebSocket is not connected'));
      }

      let timeout: ReturnType<typeof setTimeout> | null = null;
      if (this.timeoutMs) {
        timeout = setTimeout(() => {
          reject(new Error(`Request timed out: ${method}`));
        }, this.timeoutMs);
      }

      const id = this.id;
      this.id += 1;
      this.pendingResolvers.set(id, {
        resolve: (arg: unknown) => {
          if (timeout) clearTimeout(timeout);
          return resolve(arg);
        },
        reject,
      });

      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on<K extends keyof CDPEvents>(
    event: K,
    callback: (params: CDPEvents[K]) => void,
  ) {
    this.eventListeners.set(event, callback as (params: unknown) => void);
  }

  off(event: keyof CDPEvents) {
    this.eventListeners.delete(event);
  }

  disconnect() {
    this.ws?.close();
  }
}
