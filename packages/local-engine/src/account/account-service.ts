import { nanoid } from 'nanoid';
import {
  AccountSession,
  AccountStatus,
  ApprovePairingParams,
  PairingCode,
  PairedDevice,
  RequestPairingParams,
  RevokeDeviceParams,
  SignInDevParams,
  SubscriptionEntitlement,
  SubscriptionPlan
} from '@agentic/shared-contracts';
import { EngineDatabase } from '../db/index.js';

const OFFLINE_LEASE_MS = 7 * 24 * 60 * 60 * 1000;
const PAIRING_TTL_MS = 10 * 60 * 1000;

const PLAN_LIMITS: Record<SubscriptionPlan, { deviceLimit: number; relayAccess: boolean }> = {
  free: { deviceLimit: 1, relayAccess: false },
  pro: { deviceLimit: 3, relayAccess: true },
  team: { deviceLimit: 10, relayAccess: true }
};

function generatePairingCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export class AccountService {
  constructor(private db: EngineDatabase) {}

  getAccountStatus(currentDeviceId: string): AccountStatus {
    const session = this.db.getAccountSession();
    const entitlement = this.db.getSubscriptionEntitlement();
    const devices = this.db.listPairedDevices();
    const activeDevices = devices.filter((device) => !device.revoked);
    const slotsLimit = entitlement?.deviceLimit ?? 0;
    const slotsUsed = activeDevices.length;
    const canUseRelay = this.canUseRelay(currentDeviceId);

    let message = 'Sign in to register devices and enable cloud relay.';
    if (session && entitlement) {
      if (entitlement.expiresAt < Date.now()) {
        message = 'Subscription expired — local work remains available; cloud relay is restricted.';
      } else if (!canUseRelay) {
        message = 'This device is not registered or approved for relay access.';
      } else {
        message = `${entitlement.plan} plan · ${slotsUsed}/${slotsLimit} device slots used.`;
      }
    }

    return {
      session: session ?? undefined,
      entitlement: entitlement ?? undefined,
      devices,
      currentDeviceId,
      deviceSlotsUsed: slotsUsed,
      deviceSlotsLimit: slotsLimit,
      canUseRelay,
      message
    };
  }

  signInDev(params: SignInDevParams, currentDevice: {
    deviceId: string;
    deviceName: string;
    platform: string;
  }): AccountStatus {
    const email = params.email.trim().toLowerCase();
    if (!email.includes('@')) {
      throw new Error('Enter a valid email address.');
    }

    const existing = this.db.getAccountSession();
    const accountId = existing?.accountId ?? `acct-${nanoid()}`;
    const session: AccountSession = {
      accountId,
      email,
      signedInAt: Date.now()
    };
    this.db.saveAccountSession(session);

    const plan: SubscriptionPlan = 'pro';
    const limits = PLAN_LIMITS[plan];
    const expiresAt = Date.now() + 365 * 24 * 60 * 60 * 1000;
    const entitlement: SubscriptionEntitlement = {
      plan,
      deviceLimit: limits.deviceLimit,
      expiresAt,
      offlineLeaseUntil: Date.now() + OFFLINE_LEASE_MS,
      cloudSnapshots: true,
      relayAccess: limits.relayAccess
    };
    this.db.saveSubscriptionEntitlement(entitlement);

    if (!existing) {
      this.registerTrustedDevice(currentDevice);
    }
    return this.getAccountStatus(currentDevice.deviceId);
  }

  signOut(currentDeviceId: string): AccountStatus {
    this.db.clearAccountSession();
    this.db.clearSubscriptionEntitlement();
    return this.getAccountStatus(currentDeviceId);
  }

  updateEntitlement(
    plan: SubscriptionPlan,
    expiresAt: number,
    leaseDurationMs = OFFLINE_LEASE_MS
  ): SubscriptionEntitlement {
    const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
    const entitlement: SubscriptionEntitlement = {
      plan,
      deviceLimit: limits.deviceLimit,
      expiresAt,
      offlineLeaseUntil: Math.min(expiresAt, Date.now() + leaseDurationMs),
      cloudSnapshots: plan !== 'free',
      relayAccess: limits.relayAccess
    };
    this.db.saveSubscriptionEntitlement(entitlement);
    return entitlement;
  }

  extendOfflineLease(leaseDurationMs = OFFLINE_LEASE_MS): SubscriptionEntitlement | null {
    const existing = this.db.getSubscriptionEntitlement();
    if (!existing) return null;
    const updated: SubscriptionEntitlement = {
      ...existing,
      offlineLeaseUntil: Math.min(existing.expiresAt, Date.now() + leaseDurationMs)
    };
    this.db.saveSubscriptionEntitlement(updated);
    return updated;
  }

  registerTrustedDevice(device: {
    deviceId: string;
    deviceName: string;
    platform: string;
  }): PairedDevice {
    const paired: PairedDevice = {
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      platform: device.platform,
      pairedAt: Date.now(),
      lastSeenAt: Date.now(),
      trusted: true,
      revoked: false
    };
    this.db.savePairedDevice(paired);
    return paired;
  }

  requestPairing(params: RequestPairingParams): PairingCode {
    this.db.deleteExpiredPairingCodes(Date.now());
    const deviceId = `device-${nanoid()}`;
    const code = generatePairingCode();
    const pairing: PairingCode = {
      code,
      deviceId,
      deviceName: params.deviceName,
      platform: params.platform,
      expiresAt: Date.now() + PAIRING_TTL_MS,
      approved: false
    };
    this.db.savePairingCode(pairing);
    return pairing;
  }

  approvePairing(params: ApprovePairingParams, approverDeviceId: string): AccountStatus {
    const session = this.db.getAccountSession();
    if (!session) {
      throw new Error('Sign in on a trusted device to approve pairing.');
    }

    const entitlement = this.db.getSubscriptionEntitlement();
    if (!entitlement || entitlement.expiresAt < Date.now()) {
      throw new Error('Active subscription required to approve new devices.');
    }

    const pairing = this.db.getPairingCode(params.code.trim().toUpperCase());
    if (!pairing) {
      throw new Error('Pairing code not found or expired.');
    }
    if (pairing.expiresAt < Date.now()) {
      throw new Error('Pairing code has expired.');
    }
    if (pairing.approved) {
      throw new Error('Pairing code was already used.');
    }

    const approver = this.db.getPairedDevice(approverDeviceId);
    if (!approver?.trusted || approver.revoked) {
      throw new Error('Only a trusted device can approve pairing.');
    }

    const activeCount = this.db.listPairedDevices().filter((d) => !d.revoked).length;
    if (activeCount >= entitlement.deviceLimit) {
      throw new Error(
        `Device limit reached (${entitlement.deviceLimit}). Revoke an old device to free a slot.`
      );
    }

    this.db.savePairedDevice({
      deviceId: pairing.deviceId,
      deviceName: pairing.deviceName,
      platform: pairing.platform,
      pairedAt: Date.now(),
      lastSeenAt: Date.now(),
      trusted: true,
      revoked: false
    });
    this.db.markPairingCodeApproved(pairing.code);

    return this.getAccountStatus(approverDeviceId);
  }

  revokeDevice(params: RevokeDeviceParams, currentDeviceId: string): AccountStatus {
    const session = this.db.getAccountSession();
    if (!session) {
      throw new Error('Sign in to manage devices.');
    }

    const device = this.db.getPairedDevice(params.deviceId);
    if (!device || device.revoked) {
      throw new Error('Device not found.');
    }
    if (params.deviceId === currentDeviceId) {
      throw new Error('Cannot revoke the device you are currently using.');
    }

    this.db.revokePairedDevice(params.deviceId);
    return this.getAccountStatus(currentDeviceId);
  }

  touchDevice(deviceId: string): void {
    const device = this.db.getPairedDevice(deviceId);
    if (!device || device.revoked) return;
    this.db.savePairedDevice({ ...device, lastSeenAt: Date.now() });
  }

  canUseRelay(deviceId: string): boolean {
    if (process.env.AGENTIC_SKIP_ENTITLEMENT === '1') {
      return true;
    }

    const entitlement = this.db.getSubscriptionEntitlement();
    if (!entitlement?.relayAccess) {
      return false;
    }

    const now = Date.now();
    const leaseValid =
      entitlement.expiresAt > now || entitlement.offlineLeaseUntil > now;
    if (!leaseValid) {
      return false;
    }

    const device = this.db.getPairedDevice(deviceId);
    return Boolean(device && device.trusted && !device.revoked);
  }

  assertCanUseRelay(deviceId: string): void {
    const status = this.getAccountStatus(deviceId);
    if (!status.session) {
      return;
    }
    if (!status.canUseRelay) {
      throw new Error(status.message);
    }
  }
}
