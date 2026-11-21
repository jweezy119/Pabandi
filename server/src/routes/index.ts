import { Router } from 'express';
import { logger } from '../utils/logger';

// Direct core routes
import authRoutes from './auth.routes';
import githubAuthRoutes from './githubAuth.routes';

export const apiRouter = Router();

// Critical direct routes
apiRouter.use('/auth', authRoutes);
apiRouter.use('/auth/social', githubAuthRoutes);

// Helper for lazy loading domain routes to keep startup memory low (Render 512MB RAM constraint)
function lazyRoute(router: Router, routePath: string, importPath: string) {
  let loadedRouter: any = null;
  router.use(routePath, (req: any, res: any, next: any) => {
    if (loadedRouter) {
      return loadedRouter(req, res, next);
    }
    import(importPath)
      .then((mod) => {
        loadedRouter = mod.default || mod;
        loadedRouter(req, res, next);
      })
      .catch((err) => {
        logger.error(`[RouteBoundary] Failed to load route ${routePath} from ${importPath}:`, err);
        res.status(503).json({
          success: false,
          error: 'Service temporarily unavailable',
          message: 'This feature is currently undergoing maintenance or degraded. Please retry shortly.',
        });
      });
  });
}

// Public & unauthenticated lookup routes
try {
  const invoicePublicRouter = require('./invoicePublic.routes');
  apiRouter.use('/public/invoices', invoicePublicRouter.default || invoicePublicRouter);
} catch {
  // Optional
}

try {
  const magicLinkRouter = require('./magicLink.routes');
  apiRouter.use('/public/magic', magicLinkRouter.default || magicLinkRouter);
} catch {
  // Optional
}

try {
  const statsRoutes = require('./stats.routes');
  apiRouter.use('/users/me/stats', statsRoutes.userStatsRouter);
  apiRouter.use('/business/stats', statsRoutes.businessStatsRouter);
} catch {
  // Optional
}

// Domain Route Mappings: Core Wedge (Users, Businesses, Freelance Gigs, Escrow, Payments, Coordinator Dispatch) + Platform
const domainRoutes: [string, string][] = [
  // 1. Business Domain
  ['/businesses', './business.routes'],
  ['/dashboard', './dashboard.routes'],
  ['/onboarding', './onboarding.routes'],
  ['/booking', './booking.routes'],
  ['/bookings', './booking.routes'],

  // 2. User & Profile Domain
  ['/users', './user.routes'],
  ['/profile', './profile.routes'],

  // 3. Freelance Gigs Domain
  ['/gigs', './gig.routes'],

  // 4. Escrow & Disputes Domain
  ['/escrow', './escrow.routes'],
  ['/disputes', './dispute.routes'],

  // 5. Payments & Invoicing Domain
  ['/payments', './payment.routes'],
  ['/payments/raast', './raastPayment.routes'],
  ['/solana-usdc', './solanaUsdc.routes'],
  ['/fiat', './fiatPayment.routes'],
  ['/square', './square.routes'],
  ['/square-checkout', './squareCheckout.routes'],
  ['/invoices', './invoice.routes'],
  ['/checkout', './checkout.routes'],
  ['/fees', './fees.routes'],
  ['/payouts', './payout.routes'],
  ['/payout-verification', './payout-verification.routes'],
  ['/offramp', './offramp.routes'],
  ['/offramp/webhook', './offramp-webhook.routes'],

  // 6. Coordinator & Dispatch Domain
  ['/coordinator', './serviceCoordinator.routes'],

  // 7. Trust & Verification Domain
  ['/trust', './trust.routes'],
  ['/trust-passport', './trustPassport.routes'],
  ['/trust-profile', './trustProfile.routes'],
  ['/passport', './passport.routes'],

  // 8. Integrations & Platform
  ['/telegram', './telegram.routes'],
  ['/whatsapp', './whatsapp.routes'],
  ['/webhooks', './webhook.routes'],
  ['/notifications', './notifications.routes'],
  ['/settings', './settings.routes'],
  ['/ai', './ai.routes'],

  // 8b. Contact OS CRM
  ['/crm', './crm.routes'],
  ['/outreach', './outreach.routes'],
  // Simulator + public landing stats. Both route files existed but were never
  // mounted, so the landing page, module switcher and invoice share links had
  // been calling 404s. Restored and wired.
  ['/simulator', './simulator.routes'],
  // Mounted at the full path, not at '/public': the router inside defines
  // `GET /`, so mounting it at '/public' would only ever serve '/public'.
  ['/public/stats', './publicStats.routes'],

  // 9. Internal support admin (token-protected user management)
  ['/admin/support', './adminSupport.routes'],

  // 10. AI agent surface: REST tools + machine-readable manifest
  ['/agents', './agent.routes'],
  ['/pabandi', './agent.routes'],
];

for (const [subPath, target] of domainRoutes) {
  lazyRoute(apiRouter, subPath, target);
}

export default apiRouter;
