import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';

const router = Router();

// ── GET /embed/:businessSlug.js ──
// Returns a tiny JS snippet for embedding the booking widget
router.get('/:businessSlug.js', async (req: Request, res: Response) => {
  try {
    const { businessSlug } = req.params;

    const business = await prisma.business.findUnique({
      where: { slug: businessSlug, isActive: true },
      select: { id: true, name: true, slug: true },
    });

    if (!business) {
      return res.status(404).send('// Business not found');
    }

    const baseUrl = process.env.FRONTEND_URL || 'https://pabandi-42c5b.web.app';
    const widgetUrl = `${baseUrl}/b/${business.slug}`;

    const js = `
(function() {
  var PabandiBooking = window.PabandiBooking || {};
  PabandiBooking.businessId = '${business.id}';
  PabandiBooking.widgetUrl = '${widgetUrl}';
  PabandiBooking.height = '600px';
  PabandiBooking.theme = 'light';

  var iframe = document.createElement('iframe');
  iframe.src = PabandiBooking.widgetUrl + '?embed=true';
  iframe.style.width = '100%';
  iframe.style.height = PabandiBooking.height;
  iframe.style.border = 'none';
  iframe.style.borderRadius = '12px';
  iframe.allow = 'payment';
  iframe.loading = 'lazy';

  // Auto-resize listener
  window.addEventListener('message', function(event) {
    if (event.data?.type === 'pabandi:resize') {
      iframe.style.height = event.data.height + 'px';
    }
  });

  var container = document.currentScript?.parentElement;
  if (container) {
    container.innerHTML = '';
    container.appendChild(iframe);
  }
})();
`;

    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(js);
  } catch (e: any) {
    console.error('Embed widget error:', e);
    res.status(500).send('// Error loading widget');
  }
});

// ── GET /embed/:businessSlug ──
// Returns HTML page for iframe embedding
router.get('/:businessSlug', async (req: Request, res: Response) => {
  try {
    const { businessSlug } = req.params;
    const { embed, height = '600' } = req.query;

    const business = await prisma.business.findUnique({
      where: { slug: businessSlug, isActive: true },
      select: { id: true, name: true, logoUrl: true, slug: true, trustScore: true, isVerified: true },
    });

    if (!business) {
      return res.status(404).send('Business not found');
    }

    const baseUrl = process.env.FRONTEND_URL || 'https://pabandi-42c5b.web.app';
    const bookingUrl = `${baseUrl}/b/${business.slug}`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${business.name} - Booking</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #F5EFE6; }
    .embed-container { width: 100%; height: ${height}px; border: none; border-radius: 12px; }
  </style>
</head>
<body>
  <iframe class="embed-container" src="${bookingUrl}?embed=true" allow="payment" loading="lazy"></iframe>
  <script>
    window.addEventListener('message', function(event) {
      if (event.data?.type === 'pabandi:resize') {
        var iframe = document.querySelector('iframe');
        if (iframe) iframe.style.height = event.data.height + 'px';
      }
    });
  </script>
</body>
</html>
`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (e: any) {
    console.error('Embed page error:', e);
    res.status(500).send('Error loading embed');
  }
});

// ── GET /api/v1/embed/:businessSlug/config ──
// Get embed configuration for customization
router.get('/:businessSlug/config', async (req: Request, res: Response) => {
  try {
    const { businessSlug } = req.params;

    const business = await prisma.business.findUnique({
      where: { slug: businessSlug },
      select: { id: true, name: true, logoUrl: true, slug: true, trustScore: true, isVerified: true },
    });

    if (!business) {
      return res.status(404).json({ success: false, error: 'Business not found' });
    }

    res.json({
      success: true,
      data: {
        business,
        embedCode: `<script src="${process.env.FRONTEND_URL || 'https://pabandi-42c5b.web.app'}/embed/${business.slug}.js"></script>`,
        iframeCode: `<iframe src="${process.env.FRONTEND_URL || 'https://pabandi-42c5b.web.app'}/embed/${business.slug}" style="width: 100%; height: 600px; border: none; border-radius: 12px;" allow="payment"></iframe>`,
        customization: {
          theme: 'light',
          primaryColor: '#C97B5B',
          height: '600px',
          showTrustBadge: true,
          showReviews: true,
        },
      },
    });
  } catch (e: any) {
    console.error('Embed config error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;