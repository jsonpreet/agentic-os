export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';

export interface HttpHeader {
  key: string;
  value: string;
}

export interface SavedHttpRequest {
  id: string;
  workspaceId: string;
  desktopId: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: HttpHeader[];
  body: string;
  createdAt: number;
  updatedAt: number;
}

export interface CreateHttpRequestParams {
  workspaceId: string;
  desktopId: string;
  name?: string;
  method?: HttpMethod;
  url?: string;
  headers?: HttpHeader[];
  body?: string;
}

export interface UpdateHttpRequestParams {
  requestId: string;
  name?: string;
  method?: HttpMethod;
  url?: string;
  headers?: HttpHeader[];
  body?: string;
}

export interface SendHttpRequestParams {
  method: HttpMethod;
  url: string;
  headers?: HttpHeader[];
  body?: string;
}

export interface HttpResponseResult {
  ok: boolean;
  status?: number;
  statusText?: string;
  headers: HttpHeader[];
  body: string;
  durationMs: number;
  error?: string;
}
