import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AccountService } from '../src/account/account-service.js';
import { processStripeWebhook } from '../src/account/stripe-webhook.js';
import { EngineDatabase } from '../src/db/index.js';

describe('Stripe Webhook Processing', () => {
  let tmpDir: string;
  let db: EngineDatabase;
  let accountService: AccountService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-stripe-'));
    db = new EngineDatabase(path.join(tmpDir, 'test.db'));
    accountService = new AccountService(db);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('handles checkout.session.completed and sets entitlement to pro plan', () => {
    const result = processStripeWebhook(
      {
        id: 'evt_checkout_123',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_123',
            customer: 'cus_456',
            customer_email: 'buyer@agentic.local',
            metadata: { plan: 'pro' }
          }
        }
      },
      accountService,
      db
    );

    expect(result.handled).toBe(true);
    expect(result.plan).toBe('pro');

    const entitlement = db.getSubscriptionEntitlement();
    expect(entitlement?.plan).toBe('pro');
    expect(entitlement?.deviceLimit).toBe(3);
    expect(entitlement?.relayAccess).toBe(true);

    const session = db.getAccountSession();
    expect(session?.email).toBe('buyer@agentic.local');
  });

  it('handles checkout.session.completed for team plan', () => {
    const result = processStripeWebhook(
      {
        id: 'evt_checkout_team',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_team',
            customer: 'cus_team',
            customer_email: 'lead@startup.local',
            metadata: { plan: 'team' }
          }
        }
      },
      accountService,
      db
    );

    expect(result.handled).toBe(true);
    expect(result.plan).toBe('team');

    const entitlement = db.getSubscriptionEntitlement();
    expect(entitlement?.plan).toBe('team');
    expect(entitlement?.deviceLimit).toBe(10);
    expect(entitlement?.relayAccess).toBe(true);
  });

  it('handles customer.subscription.updated and sets current_period_end', () => {
    const periodEndSec = Math.floor(Date.now() / 1000) + 60 * 24 * 3600; // 60 days
    const result = processStripeWebhook(
      {
        id: 'evt_sub_update',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_123',
            status: 'active',
            current_period_end: periodEndSec,
            metadata: { plan: 'team' }
          }
        }
      },
      accountService,
      db
    );

    expect(result.handled).toBe(true);
    expect(result.plan).toBe('team');
    expect(result.expiresAt).toBe(periodEndSec * 1000);

    const entitlement = db.getSubscriptionEntitlement();
    expect(entitlement?.expiresAt).toBe(periodEndSec * 1000);
  });

  it('handles customer.subscription.deleted and downgrades to free', () => {
    // Start with pro
    accountService.updateEntitlement('pro', Date.now() + 100000);

    const result = processStripeWebhook(
      {
        id: 'evt_sub_delete',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_123',
            status: 'canceled'
          }
        }
      },
      accountService,
      db
    );

    expect(result.handled).toBe(true);
    expect(result.plan).toBe('free');

    const entitlement = db.getSubscriptionEntitlement();
    expect(entitlement?.plan).toBe('free');
    expect(entitlement?.relayAccess).toBe(false);
  });

  it('handles invoice.payment_succeeded to extend offline lease', () => {
    accountService.updateEntitlement('pro', Date.now() + 30 * 24 * 3600 * 1000);
    const result = processStripeWebhook(
      {
        id: 'evt_invoice_paid',
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            id: 'in_123',
            paid: true
          }
        }
      },
      accountService,
      db
    );

    expect(result.handled).toBe(true);
    expect(result.message).toContain('offline lease extended');
  });

  it('is idempotent: ignores duplicate webhook event IDs safely', () => {
    const payload = {
      id: 'evt_duplicate_test',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_dup',
          customer_email: 'dup@agentic.local',
          metadata: { plan: 'pro' }
        }
      }
    };

    const first = processStripeWebhook(payload, accountService, db);
    expect(first.handled).toBe(true);
    expect(first.message).toContain('completed successfully');

    const second = processStripeWebhook(payload, accountService, db);
    expect(second.handled).toBe(true);
    expect(second.message).toContain('already been processed');
  });
});
