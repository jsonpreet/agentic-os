import { EventEmitter } from 'node:events';
import { nanoid } from 'nanoid';
import path from 'node:path';
import os from 'node:os';
import {
  Workspace,
  Desktop,
  AgentSession,
  AgentInstruction,
  WindowLayout,
  DiscoveredCLI,
  CreateWorkspaceParams,
  CreateDesktopParams,
  CreateAgentParams,
  SendPromptParams,
  PromptRouteResult,
  TerminalOutputEvent,
  AgentStatusChangedEvent,
  QueueUpdatedEvent
} from '@agentic/shared-contracts';
import { EngineDatabase } from '../db/index.js';
import { CLIDiscoveryService } from '../discovery/cli-discovery.js';
import { GitWorktreeManager } from '../git/worktree-manager.js';
import { PTYManager } from './pty-manager.js';
import { InstructionQueueManager } from './instruction-queue.js';
import { PromptRouter } from './prompt-router.js';
import { generateAgentName } from './name-generator.js';

export interface EngineConfig {
  dbPath?: string;
}

export class LocalEngine extends EventEmitter {
  public db: EngineDatabase;
  public cliDiscovery: CLIDiscoveryService;
  public gitManager: GitWorktreeManager;
  public ptyManager: PTYManager;
  public queueManager: InstructionQueueManager;

  constructor(config: EngineConfig = {}) {
    super();
    const defaultDbPath =
      config.dbPath || path.join(os.homedir(), '.agentic', 'data', 'agentic.db');
    this.db = new EngineDatabase(defaultDbPath);
    this.cliDiscovery = new CLIDiscoveryService();
    this.gitManager = new GitWorktreeManager();
    this.ptyManager = new PTYManager();
    this.queueManager = new InstructionQueueManager(this.db);

    this.wireEvents();
  }

  private wireEvents(): void {
    this.ptyManager.on('terminal_output', (event: TerminalOutputEvent) => {
      this.emit('terminal_output', event);
    });

    this.ptyManager.on('status_changed', (event: AgentStatusChangedEvent) => {
      // Update session status in DB
      const session = this.db.getAgentSession(event.sessionId);
      if (session) {
        session.status = event.status;
        session.updatedAt = Date.now();
        this.db.saveAgentSession(session);
      }

      this.emit('status_changed', event);

      // If agent transitioned to idle, check if there is a queued instruction to dispatch
      if (event.status === 'idle') {
        const next = this.queueManager.getNext(event.sessionId);
        if (next) {
          this.queueManager.markDelivered(next.id, event.sessionId);
          this.ptyManager.sendInput(event.sessionId, next.prompt + '\n');
        }
      }
    });

    this.queueManager.on('queue_updated', (event: QueueUpdatedEvent) => {
      this.emit('queue_updated', event);
    });
  }

  // Workspaces
  async getWorkspaces(): Promise<Workspace[]> {
    let list = this.db.getWorkspaces();
    if (list.length === 0) {
      // Seed default initial workspace
      const defaultWs = await this.createWorkspace({
        name: 'Default Workspace',
        icon: 'folder'
      });
      list = [defaultWs];
    }
    return list;
  }

  async createWorkspace(params: CreateWorkspaceParams): Promise<Workspace> {
    const wsId = nanoid();
    const now = Date.now();

    // Default desktops for every new workspace: Build, Design, Research, Review
    const buildDesktopId = nanoid();
    const defaultDesktops: Desktop[] = [
      { id: buildDesktopId, workspaceId: wsId, name: 'Build', type: 'build', order: 0, createdAt: now },
      { id: nanoid(), workspaceId: wsId, name: 'Design', type: 'design', order: 1, createdAt: now + 1 },
      { id: nanoid(), workspaceId: wsId, name: 'Research', type: 'research', order: 2, createdAt: now + 2 },
      { id: nanoid(), workspaceId: wsId, name: 'Review', type: 'review', order: 3, createdAt: now + 3 }
    ];

    const workspace: Workspace = {
      id: wsId,
      name: params.name,
      icon: params.icon,
      repositories: params.repositories || [],
      activeDesktopId: buildDesktopId,
      createdAt: now,
      updatedAt: now
    };

    this.db.saveWorkspace(workspace);
    for (const d of defaultDesktops) {
      this.db.saveDesktop(d);
    }

    return workspace;
  }

  async updateWorkspace(id: string, updates: Partial<Workspace>): Promise<Workspace> {
    const ws = this.db.getWorkspace(id);
    if (!ws) throw new Error(`Workspace ${id} not found.`);
    const updated: Workspace = { ...ws, ...updates, updatedAt: Date.now() };
    this.db.saveWorkspace(updated);
    return updated;
  }

  async deleteWorkspace(id: string): Promise<boolean> {
    return this.db.deleteWorkspace(id);
  }

  // Desktops
  async getDesktops(workspaceId: string): Promise<Desktop[]> {
    return this.db.getDesktops(workspaceId);
  }

  async createDesktop(params: CreateDesktopParams): Promise<Desktop> {
    const desktops = this.db.getDesktops(params.workspaceId);
    const desktop: Desktop = {
      id: nanoid(),
      workspaceId: params.workspaceId,
      name: params.name,
      type: params.type || 'custom',
      order: desktops.length,
      createdAt: Date.now()
    };
    this.db.saveDesktop(desktop);
    return desktop;
  }

  async deleteDesktop(id: string): Promise<boolean> {
    return this.db.deleteDesktop(id);
  }

  // CLI Discovery
  async getDiscoveredCLIs(): Promise<DiscoveredCLI[]> {
    const cached = this.cliDiscovery.getCached();
    if (cached) return cached;
    return this.cliDiscovery.scan();
  }

  async rescanCLIs(): Promise<DiscoveredCLI[]> {
    return this.cliDiscovery.scan();
  }

  // Agent Sessions
  async getAgentSessions(workspaceId: string): Promise<AgentSession[]> {
    return this.db.getAgentSessions(workspaceId);
  }

  async createAgentSession(params: CreateAgentParams): Promise<AgentSession> {
    const existing = this.db.getAgentSessions(params.workspaceId);
    const agentName = params.name || generateAgentName(existing.map((s) => s.name));
    const sessionId = nanoid();

    let worktreePath: string | undefined;
    let branchName: string | undefined;

    // Isolate in a git worktree if repoPath is provided
    if (params.repoPath) {
      const repoCheck = await this.gitManager.checkRepo(params.repoPath);
      if (repoCheck.isGit && repoCheck.hasCommits) {
        try {
          const wt = await this.gitManager.createWorktree(params.repoPath, agentName, sessionId);
          worktreePath = wt.worktreePath;
          branchName = wt.branchName;
        } catch (err: any) {
          console.warn(`Failed to create worktree for ${agentName}:`, err.message);
        }
      }
    }

    const session: AgentSession = {
      id: sessionId,
      name: agentName,
      provider: params.provider,
      workspaceId: params.workspaceId,
      desktopId: params.desktopId,
      repoPath: params.repoPath,
      worktreePath,
      branchName,
      status: 'working',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.db.saveAgentSession(session);

    // Determine executable command
    const clis = await this.getDiscoveredCLIs();
    const discovered = clis.find((c) => c.provider === params.provider && c.isAvailable);

    const cwd = worktreePath || params.repoPath || process.env.HOME || '/';
    const command = discovered?.executablePath || process.env.SHELL || '/bin/zsh';
    const args = discovered ? [] : ['-i'];

    await this.ptyManager.spawn({
      sessionId,
      command,
      args,
      cwd
    });

    return session;
  }

  async renameAgentSession(sessionId: string, newName: string): Promise<AgentSession> {
    const session = this.db.getAgentSession(sessionId);
    if (!session) throw new Error(`Agent session ${sessionId} not found.`);
    session.name = newName;
    session.updatedAt = Date.now();
    this.db.saveAgentSession(session);
    return session;
  }

  async terminateAgentSession(sessionId: string): Promise<boolean> {
    this.ptyManager.kill(sessionId);
    const session = this.db.getAgentSession(sessionId);
    if (session) {
      session.status = 'terminated';
      session.updatedAt = Date.now();
      this.db.saveAgentSession(session);

      // Clean up worktree if one was allocated
      if (session.repoPath && session.worktreePath) {
        try {
          await this.gitManager.removeWorktree(session.repoPath, session.worktreePath);
        } catch {
          // ignore cleanup errors
        }
      }
    }
    return true;
  }

  async sendPrompt(params: SendPromptParams): Promise<PromptRouteResult> {
    const activeSessions = this.db
      .getAgentSessions(params.workspaceId)
      .filter((s) => s.status !== 'terminated');

    // Route prompt
    const routeResult = await PromptRouter.route({
      prompt: params.prompt,
      activeSessions,
      ptyManager: this.ptyManager,
      queueManager: this.queueManager
    });

    if (routeResult.action === 'spawned_new_agent') {
      // Find workspace and active desktop
      const ws = this.db.getWorkspace(params.workspaceId);
      const desktops = this.db.getDesktops(params.workspaceId);
      const desktopId = ws?.activeDesktopId || desktops[0]?.id || 'default';

      const provider = params.fallbackProvider || 'claude';
      const repoPath = params.repoPath || ws?.repositories[0];

      const newSession = await this.createAgentSession({
        workspaceId: params.workspaceId,
        desktopId,
        provider,
        repoPath
      });

      // Send initial instruction after spawn
      setTimeout(() => {
        if (this.ptyManager.hasSession(newSession.id)) {
          this.ptyManager.sendInput(newSession.id, params.prompt + '\n');
        }
      }, 500);

      return {
        action: 'spawned_new_agent',
        sessionId: newSession.id,
        agentName: newSession.name,
        message: `Created agent ${newSession.name} (${provider}) and delivered prompt`
      };
    }

    return routeResult;
  }

  async interruptAgent(sessionId: string): Promise<boolean> {
    this.ptyManager.interrupt(sessionId);
    return true;
  }

  async cancelInstruction(instructionId: string): Promise<boolean> {
    // Find session for this instruction
    const queue = this.db.getQueue(instructionId);
    return this.queueManager.cancel(instructionId, queue[0]?.sessionId || '');
  }

  async getAgentQueue(sessionId: string): Promise<AgentInstruction[]> {
    return this.queueManager.getQueue(sessionId);
  }

  // Terminal PTY
  async sendTerminalInput(sessionId: string, data: string): Promise<void> {
    this.ptyManager.sendInput(sessionId, data);
  }

  async resizeTerminal(sessionId: string, cols: number, rows: number): Promise<void> {
    this.ptyManager.resize(sessionId, cols, rows);
  }

  // Window Layouts
  async getWindowLayouts(desktopId: string): Promise<WindowLayout[]> {
    return this.db.getWindowLayouts(desktopId);
  }

  async saveWindowLayout(layout: WindowLayout): Promise<void> {
    this.db.saveWindowLayout(layout);
  }

  // Git repo helpers
  async checkGitRepo(dirPath: string): Promise<{ isGit: boolean; hasCommits: boolean; headCommit?: string }> {
    return this.gitManager.checkRepo(dirPath);
  }

  async initGitRepo(dirPath: string): Promise<{ success: boolean; headCommit: string }> {
    return this.gitManager.initRepo(dirPath);
  }
}
