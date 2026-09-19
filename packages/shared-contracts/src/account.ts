export type SubscriptionPlan = 'free' | 'pro' | 'team';

export interface AccountSession {
  accountId: string;
  email: string;
  signedInAt: number;
}

export interface SubscriptionEntitlement {
  plan: SubscriptionPlan;
  deviceLimit: number;
  expiresAt: number;
  offlineLeaseUntil: number;
  cloudSnapshots: boolean;
  relayAccess: boolean;
}

export interface PairedDevice {
  deviceId: string;
  deviceName: string;
  platform: string;
  pairedAt: number;
  lastSeenAt?: number;
  trusted: boolean;
  revoked: boolean;
}

export interface AccountStatus {
  session?: AccountSession;
  entitlement?: SubscriptionEntitlement;
  devices: PairedDevice[];
  currentDeviceId: string;
  deviceSlotsUsed: number;
  deviceSlotsLimit: number;
  canUseRelay: boolean;
  message: string;
}

export interface PairingCode {
  code: string;
  deviceId: string;
  deviceName: string;
  platform: string;
  expiresAt: number;
  approved: boolean;
}

export interface SignInDevParams {
  email: string;
}

export interface RequestPairingParams {
  deviceName: string;
  platform: string;
}

export interface ApprovePairingParams {
  code: string;
}

export interface RevokeDeviceParams {
  deviceId: string;
}
