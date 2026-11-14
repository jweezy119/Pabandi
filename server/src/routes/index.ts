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
        const loadError = err?.message ?? String(err);
        logger.error(`Failed to lazy-load route ${routePath} from ${importPath}:`, err);
        res.status(500).json({
          success: false,
          error: 'Route module failed to load',
          cause: loadError,
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
  ['/business-os', './businessOS.routes'],
  ['/booking', './booking.routes'],
  ['/reservations', './reservation.routes'],

  // 2. User & Profile Domain
  ['/users', './user.routes'],
  ['/user', './userProfile.routes'],
  ['/profile', './profile.routes'],
  ['/auth/wallet', './walletAuth.routes'],

  // 3. Freelance Gigs Domain
  ['/gigs', './gig.routes'],
  ['/sourcing', './sourcing.routes'],

  // 4. Escrow & Disputes Domain
  ['/escrow', './escrow.routes'],
  ['/solana-escrow', './solanaEscrow.routes'],
  ['/sulha', './sulha.routes'],
  ['/disputes', './dispute.routes'],
  ['/cod', './codEscrow.routes'],

  // 5. Payments & Invoicing Domain
  ['/payments', './payment.routes'],
  ['/payments/raast', './raastPayment.routes'],
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
  ['/orchestrator', './orchestration.routes'],
  ['/jobs', './job.routes'],

  // 7. Trust & Verification Domain
  ['/trust', './trust.routes'],
  ['/trust-passport', './trustPassport.routes'],
  ['/trust-profile', './trustProfile.routes'],
  ['/trust/v1', './trustApi.v1.routes'],
  ['/passport', './passport.routes'],
  ['/passport/public', './publicPassport.routes'],
  ['/passport/vc', './vc.routes'],

  // 8. Integrations & Platform
  ['/telegram', './telegram.routes'],
  ['/webhooks', './webhook.routes'],
  ['/analytics', './analytics.routes'],
  ['/admin', './admin.routes'],
  ['/developer', './developer-portal.routes'],
  ['/api-keys', './apiKey.routes'],
  ['/notifications', './notifications.routes'],
  ['/settings', './settings.routes'],
  ['/shopify', './shopify.routes'],
  ['/shopify-integration', './shopify-integration.routes'],
  ['/whatsapp/advanced', './whatsapp.advanced.routes'],
];

for (const [subPath, target] of domainRoutes) {
  lazyRoute(apiRouter, subPath, target);
}

export default apiRouter;
