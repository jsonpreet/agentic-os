import {
  SendHttpRequestParams,
  HttpResponseResult,
  HttpHeader
} from '@agentic/shared-contracts';

export class HttpClientService {
  async sendRequest(params: SendHttpRequestParams): Promise<HttpResponseResult> {
    const { method, url, headers = [], body } = params;

    if (!url || !url.trim()) {
      return {
        ok: false,
        headers: [],
        body: '',
        durationMs: 0,
        error: 'URL cannot be empty'
      };
    }

    let parsedUrl = url.trim();
    if (!/^https?:\/\//i.test(parsedUrl)) {
      parsedUrl = `https://${parsedUrl}`;
    }

    const reqHeaders: Record<string, string> = {};
    for (const h of headers) {
      if (h.key && h.key.trim()) {
        reqHeaders[h.key.trim()] = h.value;
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
    const startTime = Date.now();

    try {
      const init: RequestInit = {
        method: method || 'GET',
        headers: reqHeaders,
        signal: controller.signal
      };

      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && body !== undefined && body !== '') {
        init.body = body;
        if (!reqHeaders['content-type'] && !reqHeaders['Content-Type']) {
          // Check if body looks like JSON
          const trimmed = body.trim();
          if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
            reqHeaders['Content-Type'] = 'application/json';
          }
        }
      }

      const response = await fetch(parsedUrl, init);
      const durationMs = Date.now() - startTime;
      clearTimeout(timeoutId);

      const respHeaders: HttpHeader[] = [];
      response.headers.forEach((value, key) => {
        respHeaders.push({ key, value });
      });

      const respText = await response.text();

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: respHeaders,
        body: respText,
        durationMs
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const durationMs = Date.now() - startTime;
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        headers: [],
        body: '',
        durationMs,
        error: message
      };
    }
  }
}
