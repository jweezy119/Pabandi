import cron from 'node-cron';
import { logger } from '../utils/logger';
import { reconcileSubscriptions } from './subscription-reconcile.service';
import { whopConfigured } from './whop.service';

/**
 * Subscription reconciliation cron.
 *
 * The tier a merchant is on lives in a local row written by webhook. Webhooks are
 * best-effort by design — they retry a bounded number of times and then give up —
 * so a lost delivery silently reverts a paying customer to the free tier, and
 * nothing in the system notices. This job closes that gap by asking the provider
 * what the truth is and converging local state onto it.
 *
 * HOW OFTEN, AND WHY NOT SOONER
 * -----------------------------
 * Hourly. Not every few minutes: this is a paid API call per active membership,
 * and subscription state changes rarely enough that minute-level reconciliation is
 * cost without benefit. Hourly bounds the worst case — a merchant who paid and lost
 * their webhook waits at most an hour to regain their paid features, and usually
 * far less because most real losses are caught by the next Whop retry.
 *
 * WHAT IT MUST NEVER DO
 * ---------------------
 * Downgrade anyone because the provider was unreachable. A reconciliation job that
 * reacts to its own outage by stripping every customer of paid features is a far
 * worse failure than the bug it repairs. `reconcileSubscriptions` treats a provider
 * error as "unknown" and leaves the row alone.
 */

export class SubscriptionReconcileCron {
  private task: any = null;
  private running = false;
  /** Last summary, surfaced by the admin route so an operator can see it worked. */
  lastResult: unknown = null;
  lastRunAt: Date | null = null;

  start() {
    if (this.task) return;
    if (!whopConfigured()) {
      logger.info('[SubscriptionReconcile] Provider not configured; cron not started.');
      return;
    }
    // Minute 17, hourly. Off the hour deliberately: every other cron in this
    // service fires on :00, and piling onto the same tick makes a slow run look
    // like a platform problem when it is only contention.
    this.task = cron.schedule('17 * * * *', async () => {
      if (this.running) {
        logger.warn('[SubscriptionReconcile] Skipping: previous run still in progress.');
        return;
      }
      this.running = true;
      try {
        const result = await reconcileSubscriptions();
        this.lastResult = result;
        this.lastRunAt = new Date();
        if (result.corrected > 0) {
          logger.warn(
            `[SubscriptionReconcile] Corrected ${result.corrected} subscription(s) that had drifted from the provider.`,
          );
        }
      } catch (error) {
        // Never let this take the process down. Reconciliation failing means local
        // state is stale, which is bad; the process not starting is worse.
        logger.error(
          `[SubscriptionReconcile] Run failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        this.running = false;
      }
    });
    logger.info('[SubscriptionReconcile] Cron started (hourly at :17).');
  }

  stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
      logger.info('[SubscriptionReconcile] Cron stopped.');
    }
  }
}

export const subscriptionReconcileCron = new SubscriptionReconcileCron();