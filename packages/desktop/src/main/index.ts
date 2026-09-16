import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LocalEngine } from '@agentic/local-engine';
import {
  CreateWorkspaceParams,
  CreateDesktopParams,
  CreateAgentParams,
  SendPromptParams,
  WindowLayout
} from '@agentic/shared-contracts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let mainWindow: BrowserWindow | null = null;
let engine: LocalEngine | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 14 },
    backgroundColor: '#0d0f12',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function initEngineAndIPC(): void {
  engine = new LocalEngine();

  // Forward PTY output to renderer
  engine.on('terminal_output', (event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('agentic:event:terminal_output', event);
    }
  });

  // Forward agent status change to renderer
  engine.on('status_changed', (event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('agentic:event:status_changed', event);
    }
  });

  // Forward queue updates to renderer
  engine.on('queue_updated', (event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('agentic:event:queue_updated', event);
    }
  });

  // Register IPC Handlers
  // Workspaces
  ipcMain.handle('agentic:workspace:getWorkspaces', async () => {
    return engine!.getWorkspaces();
  });

  ipcMain.handle('agentic:workspace:createWorkspace', async (_e, params: CreateWorkspaceParams) => {
    return engine!.createWorkspace(params);
  });

  ipcMain.handle('agentic:workspace:updateWorkspace', async (_e, id: string, updates: any) => {
    return engine!.updateWorkspace(id, updates);
  });

  ipcMain.handle('agentic:workspace:deleteWorkspace', async (_e, id: string) => {
    return engine!.deleteWorkspace(id);
  });

  // Desktops
  ipcMain.handle('agentic:desktop:getDesktops', async (_e, workspaceId: string) => {
    return engine!.getDesktops(workspaceId);
  });

  ipcMain.handle('agentic:desktop:createDesktop', async (_e, params: CreateDesktopParams) => {
    return engine!.createDesktop(params);
  });

  ipcMain.handle('agentic:desktop:deleteDesktop', async (_e, id: string) => {
    return engine!.deleteDesktop(id);
  });

  // CLI Discovery
  ipcMain.handle('agentic:cli:getDiscoveredCLIs', async () => {
    return engine!.getDiscoveredCLIs();
  });

  ipcMain.handle('agentic:cli:rescanCLIs', async () => {
    return engine!.rescanCLIs();
  });

  // Agent Sessions
  ipcMain.handle('agentic:agent:getSessions', async (_e, workspaceId: string) => {
    return engine!.getAgentSessions(workspaceId);
  });

  ipcMain.handle('agentic:agent:createSession', async (_e, params: CreateAgentParams) => {
    return engine!.createAgentSession(params);
  });

  ipcMain.handle('agentic:agent:renameSession', async (_e, sessionId: string, newName: string) => {
    return engine!.renameAgentSession(sessionId, newName);
  });

  ipcMain.handle('agentic:agent:terminateSession', async (_e, sessionId: string) => {
    return engine!.terminateAgentSession(sessionId);
  });

  ipcMain.handle('agentic:agent:sendPrompt', async (_e, params: SendPromptParams) => {
    return engine!.sendPrompt(params);
  });

  ipcMain.handle('agentic:agent:interrupt', async (_e, sessionId: string) => {
    return engine!.interruptAgent(sessionId);
  });

  ipcMain.handle('agentic:agent:cancelInstruction', async (_e, instructionId: string) => {
    return engine!.cancelInstruction(instructionId);
  });

  ipcMain.handle('agentic:agent:getQueue', async (_e, sessionId: string) => {
    return engine!.getAgentQueue(sessionId);
  });

  // Terminal PTY
  ipcMain.handle('agentic:terminal:sendInput', async (_e, sessionId: string, data: string) => {
    return engine!.sendTerminalInput(sessionId, data);
  });

  ipcMain.handle('agentic:terminal:resize', async (_e, sessionId: string, cols: number, rows: number) => {
    return engine!.resizeTerminal(sessionId, cols, rows);
  });

  // Window Layouts
  ipcMain.handle('agentic:layout:getLayouts', async (_e, desktopId: string) => {
    return engine!.getWindowLayouts(desktopId);
  });

  ipcMain.handle('agentic:layout:saveLayout', async (_e, layout: WindowLayout) => {
    return engine!.saveWindowLayout(layout);
  });

  // Git repo operations
  ipcMain.handle('agentic:git:checkRepo', async (_e, dirPath: string) => {
    return engine!.checkGitRepo(dirPath);
  });

  ipcMain.handle('agentic:git:initRepo', async (_e, dirPath: string) => {
    return engine!.initGitRepo(dirPath);
  });
}

app.whenReady().then(() => {
  initEngineAndIPC();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
