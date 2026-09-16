import { AgenticApi } from '@agentic/shared-contracts';

declare global {
  interface Window {
    agenticApi: AgenticApi;
  }
}
