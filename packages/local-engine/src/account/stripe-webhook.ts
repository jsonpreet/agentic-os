import {
  StripeWebhookPayload,
  StripeWebhookResult,
  SubscriptionPlan
} from '@agentic/shared-contracts';
import { EngineDatabase } from '../db/index.js';
import { AccountService } from './account-service.js';

export function parseStripePlan(obj: Record<string, any>): SubscriptionPlan {
  // Check metadata first
  const metadataPlan = obj.metadata?.plan?.toLowerCase();
  if (metadataPlan === 'team' || metadataPlan === 'pro' || metadataPlan === 'free') {
    return metadataPlan;
  }

  // Check lines or items plan / price lookup_key or nickname
  const planNickname =
    obj.plan?.nickname?.toLowerCase() ??
    obj.items?.data?.[0]?.plan?.nickname?.toLowerCase() ??
    obj.items?.data?.[0]?.price?.lookup_key?.toLowerCase() ??
    '';

  if (planNickname.includes('team')) return 'team';
  if (planNickname.includes('pro')) return 'pro';

  // Default paid tier is pro
  return 'pro';
}

export function processStripeWebhook(
  payload: StripeWebhookPayload,
  accountService: AccountService,
  db: EngineDatabase
): StripeWebhookResult {
  const eventId = payload.id;
  const eventType = payload.type;
  const obj = payload.data?.object ?? {};

  // Idempotency check: duplicate event returns already processed
  if (db.isStripeEventProcessed(eventId)) {
    return {
      handled: true,
      event: eventType,
      message: `Event ${eventId} has already been processed (idempotent skipped).`
    };
  }

  let result: StripeWebhookResult = {
    handled: false,
    event: eventType,
    message: `Unhandled event type: ${eventType}`
  };

  switch (eventType) {
    case 'checkout.session.completed': {
      const plan = parseStripePlan(obj);
      // Expiration: 30 days default or derived from subscription
      const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
      accountService.updateEntitlement(plan, expiresAt);

      const customerEmail = obj.customer_email || obj.customer_details?.email;
      if (customerEmail) {
        const existing = db.getAccountSession();
        if (!existing) {
          db.saveAccountSession({
            accountId: obj.customer || `acct-${Date.now()}`,
            email: customerEmail,
            signedInAt: Date.now()
          });
        }
      }

      result = {
        handled: true,
        event: eventType,
        plan,
        expiresAt,
        message: `Checkout completed successfully for ${plan} plan.`
      };
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const status = obj.status;
      const currentPeriodEnd = obj.current_period_end
        ? obj.current_period_end * 1000
        : Date.now() + 30 * 24 * 60 * 60 * 1000;

      if (status === 'active' || status === 'trialing') {
        const plan = parseStripePlan(obj);
        accountService.updateEntitlement(plan, currentPeriodEnd);
        result = {
          handled: true,
          event: eventType,
          plan,
          expiresAt: currentPeriodEnd,
          message: `Subscription active on ${plan} plan until ${new Date(currentPeriodEnd).toISOString()}.`
        };
      } else if (status === 'canceled' || status === 'unpaid') {
        accountService.updateEntitlement('free', Date.now());
        result = {
          handled: true,
          event: eventType,
          plan: 'free',
          expiresAt: Date.now(),
          message: `Subscription status '${status}' — downgraded to free.`
        };
      } else if (status === 'past_due') {
        // Keep existing tier during past_due grace period
        const plan = parseStripePlan(obj);
        result = {
          handled: true,
          event: eventType,
          plan,
          message: `Subscription payment is past due for ${plan} plan.`
        };
      }
      break;
    }

    case 'customer.subscription.deleted': {
      accountService.updateEntitlement('free', Date.now());
      result = {
        handled: true,
        event: eventType,
        plan: 'free',
        expiresAt: Date.now(),
        message: 'Subscription canceled/deleted — downgraded to free.'
      };
      break;
    }

    case 'invoice.payment_succeeded': {
      const entitlement = accountService.extendOfflineLease();
      result = {
        handled: true,
        event: eventType,
        plan: entitlement?.plan,
        expiresAt: entitlement?.expiresAt,
        message: 'Invoice payment succeeded — offline lease extended.'
      };
      break;
    }

    case 'invoice.payment_failed': {
      result = {
        handled: true,
        event: eventType,
        message: 'Invoice payment failed — user should update billing method.'
      };
      break;
    }

    default: {
      result = {
        handled: false,
        event: eventType,
        message: `Ignored unhandled Stripe event ${eventType}`
      };
    }
  }

  // Record event in DB for deduplication
  db.recordStripeEvent(eventId, eventType);

  return result;
}
