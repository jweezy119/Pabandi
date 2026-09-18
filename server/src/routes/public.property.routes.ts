import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

// GET /api/v1/public/properties — public listing/search
router.get('/properties', async (req: Request, res: Response) => {
  try {
    const { city, state, minPrice, maxPrice, bedrooms, bathrooms, status, propertyType, limit = 20, offset = 0 } = req.query;
    const where: any = {};
    if (city) where.city = { contains: city as string, mode: 'insensitive' };
    if (state) where.state = { contains: state as string, mode: 'insensitive' };
    if (status) where.status = status as string;
    if (minPrice || maxPrice) {
      where.rentAmount = {};
      if (minPrice) where.rentAmount.gte = Number(minPrice);
      if (maxPrice) where.rentAmount.lte = Number(maxPrice);
    }

    const properties = await prisma.propertyManagerProperty.findMany({
      where,
      include: {
        manager: { include: { user: { select: { firstName: true, lastName: true, profilePictureUrl: true } } } },
        photos: { where: { isCover: true }, take: 1 },
        amenities: { include: { amenity: true } },
        ratePlans: { where: { isActive: true } },
        _count: { select: { reviews: true, units: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
    });

    const total = await prisma.propertyManagerProperty.count({ where });

    res.json({ success: true, data: properties, meta: { total, limit: Number(limit), offset: Number(offset) } });
  } catch (e: any) {
    console.error('[public] properties search failed:', e.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/public/properties/:id — public property detail
router.get('/properties/:id', async (req: Request, res: Response) => {
  try {
    const property = await prisma.propertyManagerProperty.findUnique({
      where: { id: req.params.id },
      include: {
        manager: { include: { user: { select: { firstName: true, lastName: true, profilePictureUrl: true, email: true } } } },
        photos: { orderBy: { sortOrder: 'asc' } },
        amenities: { include: { amenity: true } },
        ratePlans: { where: { isActive: true } },
        units: { include: { photos: { orderBy: { sortOrder: 'asc' } }, amenities: { include: { amenity: true } }, availabilities: { where: { date: { gte: new Date() } }, orderBy: { date: 'asc' }, take: 90 } } },
        reviews: { where: { isPublished: true }, orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });

    if (!property) return res.status(404).json({ error: 'Property not found' });
    res.json({ success: true, data: property });
  } catch (e: any) {
    console.error('[public] property detail failed:', e.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/public/properties/:id/availability — public availability check
router.get('/properties/:id/availability', async (req: Request, res: Response) => {
  try {
    const { start, end, unitId } = req.query;
    const where: any = { propertyId: req.params.id };
    if (unitId) where.unitId = unitId as string;
    if (start && end) {
      where.date = { gte: new Date(start as string), lte: new Date(end as string) };
    }
    const availabilities = await prisma.propertyAvailability.findMany({ where, orderBy: { date: 'asc' } });
    res.json({ success: true, data: availabilities });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/public/amenities — global amenity list
router.get('/amenities', async (_req: Request, res: Response) => {
  try {
    const amenities = await prisma.amenity.findMany({ orderBy: { name: 'asc' } });
    res.json({ success: true, data: amenities });
  } catch (e: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
