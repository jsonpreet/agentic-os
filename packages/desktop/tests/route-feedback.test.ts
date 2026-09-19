import { describe, it, expect } from 'vitest';
import { confirmationForRoute } from '../src/renderer/src/lib/speech/route-feedback.js';

describe('route speech confirmation', () => {
  it('confirms addressed agent assignment', () => {
    expect(
      confirmationForRoute({
        action: 'sent_to_active',
        sessionId: 's1',
        agentName: 'Stark'
      })
    ).toBe('Task assigned to Stark.');
  });

  it('confirms queued follow-up', () => {
    expect(
      confirmationForRoute({
        action: 'queued_for_active',
        agentName: 'Stark'
      })
    ).toBe('Queued for Stark.');
  });
});
