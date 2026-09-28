import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/v1/badge/:passportId.svg — returns embeddable SVG badge
router.get('/:passportIdSvg', async (req: Request, res: Response) => {
  try {
    const raw = req.params.passportIdSvg;
    const passportId = raw.replace(/\.svg$/, '');

    const passport = await prisma.trustPassport.findUnique({
      where: { id: passportId },
      select: {
        displayName: true,
        visibility: true,
        paymentScore: true,
        showUpScore: true,
        deliveryScore: true,
      },
    });

    if (!passport || passport.visibility !== 'PUBLIC') {
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.send(errorSvg('Profile not found'));
    }

    const avg = Math.round(
      ((passport.paymentScore ?? 500) + (passport.showUpScore ?? 500) + (passport.deliveryScore ?? 500)) / 3
    );

    let tierLabel: string;
    let tierColor: string;
    if (avg >= 700) {
      tierLabel = 'Reliable';
      tierColor = '#2D6A4F';
    } else if (avg >= 450) {
      tierLabel = 'Building';
      tierColor = '#B08D57';
    } else {
      tierLabel = 'New';
      tierColor = '#7A736E';
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64">
  <rect width="240" height="64" rx="12" fill="#F5EFE6"/>
  <rect x="1" y="1" width="238" height="62" rx="11" fill="none" stroke="#E0D5C5" stroke-width="1"/>
  <text x="20" y="38" font-size="24" fill="#A85A3C" font-family="serif">◈</text>
  <text x="48" y="28" font-size="15" font-weight="700" fill="${tierColor}" font-family="Inter, system-ui, sans-serif">${tierLabel}</text>
  <text x="48" y="44" font-size="10" fill="#7A736E" font-family="Inter, system-ui, sans-serif">Verified by Pabandi</text>
  <text x="222" y="32" font-size="11" fill="#BFB3A3" font-family="Inter, system-ui, sans-serif" text-anchor="end">${avg}</text>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(svg);
  } catch (err) {
    console.error('[Badge] Error:', err);
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.send(errorSvg('Error'));
  }
});

function errorSvg(msg: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64">
  <rect width="240" height="64" rx="12" fill="#F5EFE6"/>
  <text x="120" y="36" font-size="12" fill="#7A736E" text-anchor="middle" font-family="Inter, system-ui, sans-serif">${msg}</text>
</svg>`;
}

export default router;
