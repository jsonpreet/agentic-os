import { startRelayServer } from './relay-server.js';

const port = Number(process.env.AGENTIC_RELAY_PORT ?? 3848);
startRelayServer(port);
