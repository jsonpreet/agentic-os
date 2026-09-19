import net from 'node:net';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import { LocalEngine } from './engine/local-engine.js';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

type RpcRequest = { id: string; method: string; params?: unknown };
type RpcResponse = { id: string; result?: unknown; error?: string };
type RpcEvent = { type: 'event'; name: string; payload: unknown };

const engine = new LocalEngine();
const clients = new Set<net.Socket>();
const sseClients = new Set<ServerResponse>();
let engineHttpBaseUrl: string | undefined;

function broadcastEvent(name: string, payload: unknown): void {
  const event = { type: 'event', name, payload } satisfies RpcEvent;
  const socketMessage = JSON.stringify(event) + '\n';
  const sseMessage = `data: ${JSON.stringify(event)}\n\n`;

  for (const client of clients) {
    client.write(socketMessage);
  }
  for (const res of sseClients) {
    res.write(sseMessage);
  }
}

function readHttpBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

engine.on('terminal_output', (event) => broadcastEvent('terminal_output', event));
engine.on('status_changed', (event) => broadcastEvent('status_changed', event));
engine.on('queue_updated', (event) => broadcastEvent('queue_updated', event));
engine.on('browser_command', (event) => broadcastEvent('browser_command', event));
engine.on('dev_server_log', (event) => broadcastEvent('dev_server_log', event));
engine.on('dev_server_status', (event) => broadcastEvent('dev_server_status', event));
engine.on('notification_created', (event) => broadcastEvent('notification_created', event));
engine.on('activity_event', (event) => broadcastEvent('activity_event', event));

const handlers: Record<string, (params: any) => Promise<unknown>> = {
  getWorkspaces: () => engine.getWorkspaces(),
  createWorkspace: (params) => engine.createWorkspace(params),
  updateWorkspace: (params) => engine.updateWorkspace(params.id, params.updates),
  deleteWorkspace: (params) => engine.deleteWorkspace(params.id),
  getDesktops: (params) => engine.getDesktops(params.workspaceId),
  createDesktop: (params) => engine.createDesktop(params),
  renameDesktop: (params) => engine.renameDesktop(params.id, params.name),
  deleteDesktop: (params) => engine.deleteDesktop(params.id),
  getDiscoveredCLIs: () => engine.getDiscoveredCLIs(),
  rescanCLIs: () => engine.rescanCLIs(),
  setManualCLIPath: (params) => engine.setManualCLIPath(params.provider, params.executablePath),
  getAgentSessions: (params) => engine.getAgentSessions(params.workspaceId),
  createAgentSession: (params) => engine.createAgentSession(params),
  renameAgentSession: (params) => engine.renameAgentSession(params.sessionId, params.newName),
  terminateAgentSession: (params) => engine.terminateAgentSession(params.sessionId),
  sendPrompt: (params) => engine.sendPrompt(params),
  interruptAgent: (params) => engine.interruptAgent(params.sessionId),
  cancelInstruction: (params) => engine.cancelInstruction(params.instructionId),
  editInstruction: (params) => engine.editInstruction(params.instructionId, params.newPrompt),
  getAgentQueue: (params) => engine.getAgentQueue(params.sessionId),
  sendTerminalInput: (params) => engine.sendTerminalInput(params.sessionId, params.data),
  resizeTerminal: (params) => engine.resizeTerminal(params.sessionId, params.cols, params.rows),
  getWindowLayouts: (params) => engine.getWindowLayouts(params.desktopId),
  saveWindowLayout: (params) => engine.saveWindowLayout(params.layout),
  checkGitRepo: (params) => engine.checkGitRepo(params.dirPath),
  initGitRepo: (params) => engine.initGitRepo(params.dirPath),
  getBrowserSessions: (params) => engine.getBrowserSessions(params.desktopId),
  createBrowserSession: (params) =>
    engine.createBrowserSession(params.desktopId, params.url),
  closeBrowserSession: (params) => engine.closeBrowserSession(params.sessionId),
  updateBrowserSession: (params) =>
    engine.updateBrowserSession(params.sessionId, params.updates),
  browserNavigate: (params) => engine.browserNavigate(params.sessionId, params.url),
  browserSnapshot: (params) => engine.browserSnapshot(params.sessionId),
  submitBrowserCommandResult: (params) => engine.submitBrowserCommandResult(params),
  setAgentVoice: (params) => engine.setAgentVoice(params.sessionId, params.voiceId),
  getMacOSVoices: () => engine.getMacOSVoices(),
  speakText: (params) => engine.speakText(params),
  stopSpeech: () => engine.stopSpeech(),
  listSpeechModels: () => engine.listSpeechModels(),
  downloadSpeechModel: (params) => engine.downloadSpeechModel(params.modelId),
  listDirectory: (params) => engine.listDirectory(params.workspaceId, params.dirPath),
  readTextFile: (params) => engine.readTextFile(params.workspaceId, params.filePath),
  writeTextFile: (params) =>
    engine.writeTextFile(params.workspaceId, params.filePath, params.content),
  getGitStatus: (params) => engine.getGitStatus(params.workspaceId, params.repoPath),
  getGitDiff: (params) =>
    engine.getGitDiff(params.workspaceId, params.repoPath, params.filePath, params.staged),
  stageGitFiles: (params) =>
    engine.stageGitFiles(params.workspaceId, params.repoPath, params.paths ?? []),
  unstageGitFiles: (params) =>
    engine.unstageGitFiles(params.workspaceId, params.repoPath, params.paths ?? []),
  commitGit: (params) =>
    engine.commitGit(params.workspaceId, params.repoPath, params.message),
  pushGit: (params) => engine.pushGit(params.workspaceId, params.repoPath),
  getGitHubAuthStatus: () => engine.getGitHubAuthStatus(),
  createPullRequest: (params) =>
    engine.createPullRequest(params.workspaceId, params.repoPath, {
      title: params.title,
      body: params.body,
      base: params.base,
      draft: params.draft
    }),
  getDevServerSessions: (params) => engine.getDevServerSessions(params.desktopId),
  startDevServer: (params) => engine.startDevServer(params),
  stopDevServer: (params) => engine.stopDevServer(params.sessionId),
  getDevServerLogs: (params) => engine.getDevServerLogs(params.sessionId),
  listNotes: (params) =>
    Promise.resolve(engine.listNotes(params.workspaceId, params.desktopId)),
  createNote: (params) => Promise.resolve(engine.createNote(params)),
  updateNote: (params) => Promise.resolve(engine.updateNote(params)),
  deleteNote: (params) => Promise.resolve(engine.deleteNote(params.noteId)),
  listKanbanTasks: (params) =>
    Promise.resolve(engine.listKanbanTasks(params.workspaceId, params.desktopId)),
  createKanbanTask: (params) => Promise.resolve(engine.createKanbanTask(params)),
  updateKanbanTask: (params) => Promise.resolve(engine.updateKanbanTask(params)),
  deleteKanbanTask: (params) => Promise.resolve(engine.deleteKanbanTask(params.taskId)),
  getSyncStatus: () => Promise.resolve(engine.getSyncStatus()),
  updateSyncPreferences: (params) => Promise.resolve(engine.updateSyncPreferences(params)),
  createSyncSnapshot: () => Promise.resolve(engine.createSyncSnapshot()),
  listSyncSnapshots: () => Promise.resolve(engine.listSyncSnapshots()),
  restoreLatestSyncSnapshot: () => Promise.resolve(engine.restoreLatestSyncSnapshot()),
  getRecoveryKey: () => Promise.resolve(engine.getRecoveryKey()),
  connectRelay: (params) => engine.connectRelay(params),
  disconnectRelay: () => Promise.resolve(engine.disconnectRelay()),
  getRelayStatus: () => Promise.resolve(engine.getRelayStatus()),
  getAccountStatus: () => Promise.resolve(engine.getAccountStatus()),
  signInDev: (params) => Promise.resolve(engine.signInDev(params)),
  signOutAccount: () => Promise.resolve(engine.signOutAccount()),
  requestPairing: (params) => Promise.resolve(engine.requestPairing(params)),
  approvePairing: (params) => Promise.resolve(engine.approvePairing(params)),
  revokePairedDevice: (params) => Promise.resolve(engine.revokePairedDevice(params)),
  handleStripeWebhook: (params) => Promise.resolve(engine.handleStripeWebhook(params.payload ?? params)),
  listNotifications: (params) => Promise.resolve(engine.listNotifications(params ?? {})),
  getUnreadNotificationCount: () => Promise.resolve(engine.getUnreadNotificationCount()),
  markNotificationRead: (params) => Promise.resolve(engine.markNotificationRead(params)),
  markAllNotificationsRead: () => Promise.resolve(engine.markAllNotificationsRead()),
  dismissNotification: (params) => Promise.resolve(engine.dismissNotification(params)),
  getUsageOverview: () => engine.getUsageOverview(),
  listInstalledExtensions: () => Promise.resolve(engine.listInstalledExtensions()),
  installExtension: (params) => Promise.resolve(engine.installExtension(params)),
  getExtensionWidgets: () => Promise.resolve(engine.getExtensionWidgets(engineHttpBaseUrl)),
  publishNotification: (params) => Promise.resolve(engine.publishNotification(params)),
  listHttpRequests: (params) => engine.listHttpRequests(params.workspaceId, params.desktopId),
  createHttpRequest: (params) => engine.createHttpRequest(params),
  updateHttpRequest: (params) => engine.updateHttpRequest(params),
  deleteHttpRequest: (params) => engine.deleteHttpRequest(params.requestId),
  sendHttpRequest: (params) => engine.sendHttpRequest(params),
  listWorkspaceDatabases: (params) => engine.listWorkspaceDatabases(params.workspaceId),
  inspectSqliteDatabase: (params) => engine.inspectSqliteDatabase(params),
  querySqliteDatabase: (params) => engine.querySqliteDatabase(params),
  getDesignOverview: (params) => engine.getDesignOverview(params.workspaceId),
  readAssetContent: (params) => engine.readAssetContent(params.filePath),
  listActivityEvents: (params) => Promise.resolve(engine.listActivityEvents(params?.query ?? params)),
  logActivityEvent: (params) => Promise.resolve(engine.logActivityEvent(params)),
  clearActivityEvents: (params) => Promise.resolve(engine.clearActivityEvents(params?.workspaceId))
};

async function handleRequest(request: RpcRequest): Promise<RpcResponse> {
  try {
    const handler = handlers[request.method];
    if (!handler) {
      throw new Error(`Unknown method: ${request.method}`);
    }

    const result = await handler(request.params ?? {});
    return { id: request.id, result };
  } catch (error) {
    return {
      id: request.id,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function handleConnection(socket: net.Socket): void {
  clients.add(socket);
  let buffer = '';

  socket.on('data', async (chunk) => {
    buffer += chunk.toString('utf8');

    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (line.length > 0) {
        try {
          const request = JSON.parse(line) as RpcRequest;
          const response = await handleRequest(request);
          socket.write(JSON.stringify(response) + '\n');
        } catch {
          // ignore malformed requests
        }
      }

      newlineIndex = buffer.indexOf('\n');
    }
  });

  socket.on('close', () => {
    clients.delete(socket);
  });

  socket.on('error', () => {
    clients.delete(socket);
  });
}

function startHttpServer(port: number): http.Server {
  const httpServer = http.createServer(async (req, res) => {
    setCorsHeaders(res);
    const route = req.url?.split('?')[0];

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (route === '/events' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      });
      res.write('\n');
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return;
    }

    if (route === '/sdk/widget.js' && req.method === 'GET') {
      const sdkPath = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '../../app-sdk/widget-runtime.js'
      );
      if (!fs.existsSync(sdkPath)) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Content-Security-Policy': "default-src 'none'"
      });
      res.end(fs.readFileSync(sdkPath));
      return;
    }

    if (route?.startsWith('/extensions/') && req.method === 'GET') {
      const parts = route.split('/').filter(Boolean);
      const extensionId = decodeURIComponent(parts[1] ?? '');
      const relativePath = parts.slice(2).map((segment) => decodeURIComponent(segment)).join('/');
      const filePath = engine.extensionService.resolveExtensionFile(extensionId, relativePath);
      if (!filePath) {
        res.writeHead(404);
        res.end();
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream',
        'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'"
      });
      res.end(fs.readFileSync(filePath));
      return;
    }

    if (route === '/rpc' && req.method === 'POST') {
      try {
        const body = await readHttpBody(req);
        const request = JSON.parse(body) as RpcRequest;
        const response = await handleRequest(request);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request' }));
      }
      return;
    }

    if (route === '/api/webhooks/stripe' && req.method === 'POST') {
      try {
        const body = await readHttpBody(req);
        const payload = JSON.parse(body);
        const result = engine.handleStripeWebhook(payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err?.message || 'Invalid webhook payload' }));
      }
      return;
    }

    res.writeHead(404);
    res.end();
  });

  httpServer.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      process.stderr.write(
        `http-error:port ${port} already in use (kill the other bridge or set AGENTIC_ENGINE_HTTP_PORT)\n`
      );
      return;
    }
    throw error;
  });

  httpServer.listen(port, () => {
    process.stdout.write(`http-ready:${port}\n`);
  });

  return httpServer;
}

function start(): void {
  const socketPath =
    process.env.AGENTIC_ENGINE_SOCKET ||
    path.join(os.homedir(), '.agentic', 'run', 'engine.sock');

  fs.mkdirSync(path.dirname(socketPath), { recursive: true });

  if (fs.existsSync(socketPath)) {
    fs.unlinkSync(socketPath);
  }

  const server = net.createServer(handleConnection);
  let httpServer: http.Server | null = null;
  const httpPort = process.env.AGENTIC_ENGINE_HTTP_PORT
    ? Number(process.env.AGENTIC_ENGINE_HTTP_PORT)
    : null;

  if (httpPort) {
    engineHttpBaseUrl = `http://127.0.0.1:${httpPort}`;
    httpServer = startHttpServer(httpPort);
  }

  server.listen(socketPath, () => {
    process.stdout.write(`ready:${socketPath}\n`);
  });

  const shutdown = () => {
    for (const client of clients) {
      client.destroy();
    }
    for (const res of sseClients) {
      res.end();
    }
    sseClients.clear();
    server.close();
    httpServer?.close();
    engine.db.close();
    if (fs.existsSync(socketPath)) {
      fs.unlinkSync(socketPath);
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();
