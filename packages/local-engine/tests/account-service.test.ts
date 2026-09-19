import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AccountService } from '../src/account/account-service.js';
import { EngineDatabase } from '../src/db/index.js';

describe('AccountService', () => {
  let tmpDir: string;
  let db: EngineDatabase;
  let service: AccountService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-account-'));
    db = new EngineDatabase(path.join(tmpDir, 'test.db'));
    service = new AccountService(db);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('registers the first device when signing in', () => {
    const status = service.signInDev(
      { email: 'dev@agentic.local' },
      { deviceId: 'device-a', deviceName: 'Mac A', platform: 'darwin' }
    );

    expect(status.session?.email).toBe('dev@agentic.local');
    expect(status.deviceSlotsUsed).toBe(1);
    expect(status.canUseRelay).toBe(true);
  });

  it('approves pairing codes within device limits', () => {
    service.signInDev(
      { email: 'dev@agentic.local' },
      { deviceId: 'device-a', deviceName: 'Mac A', platform: 'darwin' }
    );

    const pairing = service.requestPairing({
      deviceName: 'Phone B',
      platform: 'ios'
    });

    expect(service.canUseRelay(pairing.deviceId)).toBe(false);

    const approved = service.approvePairing({ code: pairing.code }, 'device-a');
    expect(approved.deviceSlotsUsed).toBe(2);

    const pairedDevice = db.getPairedDevice(pairing.deviceId);
    expect(pairedDevice?.deviceName).toBe('Phone B');
    expect(service.canUseRelay(pairing.deviceId)).toBe(true);
  });

  it('blocks relay when device slots are exhausted', () => {
    service.signInDev(
      { email: 'dev@agentic.local' },
      { deviceId: 'device-a', deviceName: 'Mac A', platform: 'darwin' }
    );

    const entitlement = db.getSubscriptionEntitlement();
    if (!entitlement) throw new Error('missing entitlement');

    db.saveSubscriptionEntitlement({ ...entitlement, deviceLimit: 1 });

    const pairing = service.requestPairing({
      deviceName: 'Phone B',
      platform: 'ios'
    });

    expect(() => service.approvePairing({ code: pairing.code }, 'device-a')).toThrow(
      /Device limit reached/
    );
  });

  it('revokes paired devices', () => {
    service.signInDev(
      { email: 'dev@agentic.local' },
      { deviceId: 'device-a', deviceName: 'Mac A', platform: 'darwin' }
    );

    const pairing = service.requestPairing({
      deviceName: 'Phone B',
      platform: 'ios'
    });
    service.approvePairing({ code: pairing.code }, 'device-a');

    const revoked = service.revokeDevice({ deviceId: pairing.deviceId }, 'device-a');
    expect(revoked.deviceSlotsUsed).toBe(1);
    expect(service.canUseRelay(pairing.deviceId)).toBe(false);
  });
});
