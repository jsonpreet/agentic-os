import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const ENGINE_HTTP_PORT = 3847;
const pluginDir = path.dirname(fileURLToPath(import.meta.url));

export function agenticEnginePlugin(): Plugin {
  let bridgeProcess: ChildProcess | null = null;

  return {
    name: 'agentic-engine-dev',
    apply: 'serve',
    configureServer(server) {
      const bridgePath = path.resolve(pluginDir, '../local-engine/dist/bridge.js');
      bridgeProcess = spawn('node', [bridgePath], {
        env: {
          ...process.env,
          AGENTIC_ENGINE_HTTP_PORT: String(ENGINE_HTTP_PORT)
        },
        stdio: ['ignore', 'pipe', 'pipe']
      });

      bridgeProcess.stdout?.on('data', (chunk) => {
        const line = chunk.toString().trim();
        if (line) server.config.logger.info(`[agentic-engine] ${line}`, { timestamp: true });
      });

      bridgeProcess.stderr?.on('data', (chunk) => {
        const line = chunk.toString().trim();
        if (line) server.config.logger.error(`[agentic-engine] ${line}`, { timestamp: true });
      });

      bridgeProcess.on('error', (error) => {
        server.config.logger.error(`[agentic-engine] failed to start: ${error.message}`, {
          timestamp: true
        });
      });

      bridgeProcess.on('exit', (code) => {
        if (code && code !== 0) {
          server.config.logger.error(
            `[agentic-engine] bridge exited with code ${code}. Run pnpm --filter @agentic/local-engine build`,
            { timestamp: true }
          );
        }
      });

      server.httpServer?.on('close', () => {
        bridgeProcess?.kill();
        bridgeProcess = null;
      });
    }
  };
}
