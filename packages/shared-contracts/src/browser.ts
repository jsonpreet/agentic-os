export interface BrowserSession {
  id: string;
  desktopId: string;
  url: string;
  title?: string;
  createdAt: number;
  updatedAt: number;
}

export type BrowserToolName = 'navigate' | 'snapshot' | 'click' | 'type';

export interface BrowserSnapshot {
  url: string;
  title: string;
  /** Text content summary when same-origin access is available */
  textContent?: string;
  links?: Array<{ text: string; href: string }>;
  error?: string;
}

export interface BrowserNavigateParams {
  sessionId: string;
  url: string;
}

export interface BrowserClickParams {
  sessionId: string;
  selector: string;
}

export interface BrowserTypeParams {
  sessionId: string;
  selector: string;
  text: string;
}

export interface BrowserCommandEvent {
  sessionId: string;
  tool: BrowserToolName;
  params: Record<string, string>;
  requestId: string;
}

export interface BrowserCommandResultEvent {
  requestId: string;
  sessionId: string;
  success: boolean;
  snapshot?: BrowserSnapshot;
  error?: string;
}
