import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { EncryptedSyncBlob } from '@agentic/shared-contracts';

const DEFAULT_KEY_DIR = path.join(os.homedir(), '.agentic', 'keys');
const DEFAULT_KEY_FILE = path.join(DEFAULT_KEY_DIR, 'device.key');
const ALGORITHM = 'aes-256-gcm';

let keyFileOverride: string | undefined;

export function setCryptoKeyPath(keyFile: string | undefined): void {
  keyFileOverride = keyFile;
}

export function getDeviceKeyPath(): string {
  return keyFileOverride ?? DEFAULT_KEY_FILE;
}

export function getOrCreateDeviceKey(): Buffer {
  const keyFile = getDeviceKeyPath();
  const keyDir = path.dirname(keyFile);

  if (!fs.existsSync(keyDir)) {
    fs.mkdirSync(keyDir, { mode: 0o700, recursive: true });
  }

  if (fs.existsSync(keyFile)) {
    const key = fs.readFileSync(keyFile);
    if (key.length === 32) return key;
  }

  const key = crypto.randomBytes(32);
  fs.writeFileSync(keyFile, key, { mode: 0o600 });
  return key;
}

export function recoveryKeyFromDeviceKey(key: Buffer): string {
  return key.toString('base64url');
}

export function encryptJson(deviceId: string, payload: unknown): EncryptedSyncBlob {
  const key = getOrCreateDeviceKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    version: 1,
    algorithm: 'aes-256-gcm',
    deviceId,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: encrypted.toString('base64'),
    createdAt: Date.now()
  };
}

export function decryptJson<T>(blob: EncryptedSyncBlob): T {
  if (blob.algorithm !== 'aes-256-gcm') {
    throw new Error(`Unsupported sync encryption algorithm: ${blob.algorithm}`);
  }

  const key = getOrCreateDeviceKey();
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(blob.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(blob.authTag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(blob.ciphertext, 'base64')),
    decipher.final()
  ]);
  return JSON.parse(decrypted.toString('utf8')) as T;
}
