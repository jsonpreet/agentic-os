import http from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { RelayMessage, RelayPresence } from '@agentic/shared-contracts';

const DEFAULT_PORT = 3848;

interface HostConnection {
  ws: WebSocket;
  deviceId: string;
  deviceName: string;
}

interface ViewerConnection {
  ws: WebSocket;
  deviceId: string;
  viewerId: string;
}

export function startRelayServer(port = DEFAULT_PORT): http.Server {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Agentic relay server\n');
  });

  const wss = new WebSocketServer({ server });
  const hosts = new Map<string, HostConnection>();
  const viewersByDevice = new Map<string, Map<string, ViewerConnection>>();

  const broadcastPresence = (deviceId: string) => {
    const host = hosts.get(deviceId);
    const viewers = viewersByDevice.get(deviceId);
    const presence: RelayPresence = {
      type: 'presence',
      deviceId,
      hostOnline: Boolean(host),
      viewerCount: viewers?.size ?? 0,
      timestamp: Date.now()
    };
    const payload = JSON.stringify(presence);
    host?.ws.send(payload);
    viewers?.forEach((viewer) => viewer.ws.send(payload));
  };

  const forwardToViewers = (deviceId: string, raw: string) => {
    const viewers = viewersByDevice.get(deviceId);
    viewers?.forEach((viewer) => {
      if (viewer.ws.readyState === WebSocket.OPEN) {
        viewer.ws.send(raw);
      }
    });
  };

  wss.on('connection', (ws) => {
    let role: 'host' | 'viewer' | null = null;
    let deviceId: string | null = null;

    ws.on('message', (raw) => {
      let message: RelayMessage;
      try {
        message = JSON.parse(raw.toString()) as RelayMessage;
      } catch {
        ws.send(
          JSON.stringify({
            type: 'error',
            message: 'Invalid relay message JSON.',
            timestamp: Date.now()
          })
        );
        return;
      }

      if (message.type === 'host_hello') {
        role = 'host';
        deviceId = message.deviceId;
        hosts.set(deviceId, {
          ws,
          deviceId,
          deviceName: message.deviceName
        });
        broadcastPresence(deviceId);
        return;
      }

      if (message.type === 'viewer_hello') {
        role = 'viewer';
        deviceId = message.deviceId;
        const viewers =
          viewersByDevice.get(deviceId) ?? new Map<string, ViewerConnection>();
        viewers.set(message.viewerId, {
          ws,
          deviceId,
          viewerId: message.viewerId
        });
        viewersByDevice.set(deviceId, viewers);
        broadcastPresence(deviceId);
        return;
      }

      if (!deviceId) return;

      if (role === 'host') {
        if (
          message.type === 'terminal_chunk' ||
          message.type === 'agent_status' ||
          message.type === 'command_ack'
        ) {
          forwardToViewers(deviceId, raw.toString());
        }
        return;
      }

      if (role === 'viewer' && message.type === 'remote_command') {
        const host = hosts.get(deviceId);
        if (host?.ws.readyState === WebSocket.OPEN) {
          host.ws.send(raw.toString());
        }
      }
    });

    ws.on('close', () => {
      if (!deviceId || !role) return;

      if (role === 'host') {
        hosts.delete(deviceId);
      } else {
        const viewers = viewersByDevice.get(deviceId);
        viewers?.forEach((viewer, viewerId) => {
          if (viewer.ws === ws) viewers.delete(viewerId);
        });
        if (viewers?.size === 0) {
          viewersByDevice.delete(deviceId);
        }
      }

      broadcastPresence(deviceId);
    });
  });

  server.listen(port, () => {
    console.log(`Agentic relay listening on ws://localhost:${port}`);
  });

  return server;
}
