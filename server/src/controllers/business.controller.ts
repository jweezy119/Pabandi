import { Response, NextFunction } from 'express';
import axios from 'axios';
import { prisma } from '../utils/database';
import { CustomError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';
import { BusinessCategory, UserRole } from '@prisma/client';

export const createBusiness = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      name,
      description,
      category,
      address,
      city,
      phone,
      email,
      website,
      timezone,
    } = req.body;

    // Check if user already has a business
    const existingBusiness = await prisma.business.findUnique({
      where: { ownerId: req.user!.id },
    });

    if (existingBusiness) {
      throw new CustomError('User already has a business registered', 409);
    }

    // Normalize category to enum (fallback to OTHER)
    const resolvedCategory: BusinessCategory = (category && (Object.values(BusinessCategory) as string[]).includes(category))
      ? (category as BusinessCategory)
      : BusinessCategory.OTHER;

    // Create business
    const business = await prisma.business.create({
      data: {
        ownerId: req.user!.id,
        name,
        description,
        category: resolvedCategory,
        address,
        city: city || 'Karachi',
        phone,
        email,
        website,
        timezone: timezone || 'Asia/Karachi',
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Create default business settings
    await prisma.businessSettings.create({
      data: {
        businessId: business.id,
      },
    });

    // Promote user to BUSINESS_OWNER if not already
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        role: UserRole.BUSINESS_OWNER,
      },
      select: { id: true, role: true },
    });

    res.status(201).json({
      success: true,
      message: 'Business created successfully',
      data: { business, user },
    });
  } catch (error) {
    next(error);
  }
};

export const getBusiness = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    let business = await prisma.business.findFirst({
      where: {
        OR: [
          { id },
          { googlePlaceId: id }
        ]
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        businessHours: true,
        tables: {
          where: { isActive: true },
        },
        settings: true,
        googleReviews: {
          orderBy: { time: 'desc' }
        },
      },
    });

    // If not found in DB, try fetching from Google Places API
    if (!business) {
      const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
      if (apiKey) {
        try {
          const googleRes = await axios.get(
            `https://maps.googleapis.com/maps/api/place/details/json`, {
              params: {
                place_id: id,
                fields: 'name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,types,geometry,photos',
                key: apiKey,
              }
            }
          );
          
          if (googleRes.data?.result) {
            const p = googleRes.data.result;
            
            let category: BusinessCategory = BusinessCategory.OTHER;
            if (p.types) {
              if (p.types.includes('restaurant') || p.types.includes('cafe') || p.types.includes('bakery')) category = BusinessCategory.RESTAURANT;
              else if (p.types.includes('spa') || p.types.includes('beauty_salon') || p.types.includes('hair_care')) category = BusinessCategory.SPA;
              else if (p.types.includes('gym') || p.types.includes('health')) category = BusinessCategory.FITNESS_CENTER;
            }
            
            // Extract a cover image from Google Photos if available
            let coverImageUrl = undefined;
            if (p.photos && p.photos.length > 0) {
              try {
                const photoRes = await axios.get(`https://maps.googleapis.com/maps/api/place/photo`, {
                  params: {
                    maxwidth: 1200,
                    photoreference: p.photos[0].photo_reference,
                    key: apiKey
                  },
                  maxRedirects: 0,
                  validateStatus: (status) => status >= 200 && status < 400
                });
                // Google redirects to the actual image URL
                if (photoRes.status === 302 && photoRes.headers.location) {
                  coverImageUrl = photoRes.headers.location;
                }
              } catch (err) {
                console.error("Failed to fetch photo redirect URL");
              }
            }

            business = await prisma.business.create({
              data: {
                googlePlaceId: id,
                name: p.name || 'Unknown Business',
                address: p.formatted_address || 'Unknown Address',
                phone: p.international_phone_number || p.formatted_phone_number || 'No phone',
                email: 'contact@example.com',
                website: p.website || null,
                latitude: p.geometry?.location?.lat || null,
                longitude: p.geometry?.location?.lng || null,
                category: category,
                isClaimed: false,
                rating: p.rating || null,
                reviewCount: p.user_ratings_total || 0,
                city: p.formatted_address?.split(',')[1]?.trim() || 'Karachi',
                description: 'Auto-generated profile from Google Maps data. Claim this profile to customize it.',
                coverImageUrl,
                settings: {
                  create: {}
                }
              },
              include: {
                owner: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                  },
                },
                businessHours: true,
                tables: {
                  where: { isActive: true },
                },
                settings: true,
                googleReviews: {
                  orderBy: { time: 'desc' }
                },
              }
            });
          }
        } catch (apiErr) {
          console.error('Failed to fetch business from Google Places:', apiErr);
        }
      }
    }

    if (!business) {
      throw new CustomError('Business not found', 404);
    }

    // Check if user has access
    const hasFullAccess = req.user && (req.user.role === 'ADMIN' || business.ownerId === req.user.id);
    if (!hasFullAccess) {
      // Public view (limited data)
      const publicBusiness = {
        id: business.id,
        name: business.name,
        description: business.description,
        category: business.category,
        address: business.address,
        city: business.city,
        phone: business.phone,
        email: business.email,
        website: business.website,
        logoUrl: business.logoUrl,
        coverImageUrl: business.coverImageUrl,
        businessHours: business.businessHours,
        rating: business.rating,
        reviewCount: business.reviewCount,
        reliabilityScore: business.reliabilityScore,
        isClaimed: business.isClaimed,
        ownerId: business.ownerId,
        googlePlaceId: business.googlePlaceId,
        googleReviews: business.googleReviews,
        latitude: business.latitude,
        longitude: business.longitude,
      };

      return res.json({
        success: true,
        data: { business: publicBusiness },
      });
    }

    res.json({
      success: true,
      data: { business },
    });
  } catch (error) {
    next(error);
  }
};

export const updateBusiness = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const business = await prisma.business.findUnique({
      where: { id },
    });

    if (!business) {
      throw new CustomError('Business not found', 404);
    }

    if (
      req.user!.role !== 'ADMIN' &&
      business.ownerId !== req.user!.id
    ) {
      throw new CustomError('Unauthorized', 403);
    }

    const updated = await prisma.business.update({
      where: { id },
      data: req.body,
    });

    res.json({
      success: true,
      message: 'Business updated successfully',
      data: { business: updated },
    });
  } catch (error) {
    next(error);
  }
};

export const getBusinessReservations = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { status, date, page = 1, limit = 20 } = req.query;

    // Verify business ownership
    const business = await prisma.business.findUnique({
      where: { id },
    });

    if (!business) {
      throw new CustomError('Business not found', 404);
    }

    if (
      req.user!.role !== 'ADMIN' &&
      business.ownerId !== req.user!.id
    ) {
      throw new CustomError('Unauthorized', 403);
    }

    const where: any = { businessId: id };
    if (status) {
      where.status = status;
    }
    if (date) {
      const dateStart = new Date(date as string);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(date as string);
      dateEnd.setHours(23, 59, 59, 999);
      where.reservationDate = {
        gte: dateStart,
        lte: dateEnd,
      };
    }

    const [reservations, total] = await Promise.all([
      prisma.reservation.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          table: true,
        },
        orderBy: { reservationDate: 'asc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.reservation.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        reservations,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getBusinessAnalytics = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    // Verify business ownership
    const business = await prisma.business.findUnique({
      where: { id },
    });

    if (!business) {
      throw new CustomError('Business not found', 404);
    }

    if (
      req.user!.role !== 'ADMIN' &&
      business.ownerId !== req.user!.id
    ) {
      throw new CustomError('Unauthorized', 403);
    }

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate as string);
    if (endDate) dateFilter.lte = new Date(endDate as string);

    const now = new Date();

    const [
      totalReservations,
      confirmed,
      noShows,
      cancellations,
      completed,
      reservationsByStatus,
      protectedRevenue,
      unprotectedRevenue,
      upcomingReservations,
      allConcluded,
    ] = await Promise.all([
      prisma.reservation.count({
        where: {
          businessId: id,
          reservationDate: dateFilter,
        },
      }),
      prisma.reservation.count({
        where: {
          businessId: id,
          status: 'CONFIRMED',
          reservationDate: dateFilter,
        },
      }),
      prisma.reservation.count({
        where: {
          businessId: id,
          status: 'NO_SHOW',
          reservationDate: dateFilter,
        },
      }),
      prisma.reservation.count({
        where: {
          businessId: id,
          status: 'CANCELLED',
          reservationDate: dateFilter,
        },
      }),
      prisma.reservation.count({
        where: {
          businessId: id,
          status: 'COMPLETED',
          reservationDate: dateFilter,
        },
      }),
      prisma.reservation.groupBy({
        by: ['status'],
        where: {
          businessId: id,
          reservationDate: dateFilter,
        },
        _count: true,
      }),
      // Protected revenue (deposit captured)
      prisma.reservation.aggregate({
        where: {
          businessId: id,
          depositRequired: true,
          depositStatus: { in: ['PAID', 'APPLIED_TO_SERVICE', 'REIMBURSED_TO_BUSINESS'] },
          reservationDate: dateFilter,
        },
        _sum: { depositAmount: true },
      }),
      // Unprotected (no deposit) bookings count
      prisma.reservation.count({
        where: {
          businessId: id,
          depositRequired: false,
          reservationDate: dateFilter,
        },
      }),
      // Upcoming with risk data
      prisma.reservation.findMany({
        where: {
          businessId: id,
          status: { in: ['PENDING', 'CONFIRMED'] },
          reservationDate: { gte: now },
        },
        select: {
          riskScore: true,
          depositAmount: true,
          depositRequired: true,
          numberOfGuests: true,
          reservationDate: true,
          reservationTime: true,
        },
        orderBy: { reservationDate: 'asc' },
        take: 50,
      }),
      // All concluded reservations for day-of-week breakdown
      prisma.reservation.findMany({
        where: {
          businessId: id,
          status: { in: ['COMPLETED', 'NO_SHOW'] },
          reservationDate: dateFilter,
        },
        select: {
          reservationDate: true,
          reservationTime: true,
          status: true,
          riskScore: true,
          numberOfGuests: true,
        },
      }),
    ]);

    const noShowRate =
      totalReservations > 0 ? (noShows / totalReservations) * 100 : 0;
    const cancellationRate =
      totalReservations > 0 ? (cancellations / totalReservations) * 100 : 0;
    const completionRate =
      totalReservations > 0 ? (completed / totalReservations) * 100 : 0;

    // ── No-show by day of week ──
    const dayBreakdown: Record<number, { total: number; noShows: number }> = {};
    for (let d = 0; d <= 6; d++) dayBreakdown[d] = { total: 0, noShows: 0 };
    for (const r of allConcluded) {
      const day = new Date(r.reservationDate).getDay();
      dayBreakdown[day].total++;
      if (r.status === 'NO_SHOW') dayBreakdown[day].noShows++;
    }
    const noShowByDay = Object.entries(dayBreakdown).map(([day, s]) => ({
      day: Number(day),
      total: s.total,
      noShows: s.noShows,
      rate: s.total > 0 ? Math.round((s.noShows / s.total) * 100) : 0,
    }));

    // ── No-show by hour (heatmap) ──
    const hourBreakdown: Record<number, { total: number; noShows: number }> = {};
    for (let h = 0; h <= 23; h++) hourBreakdown[h] = { total: 0, noShows: 0 };
    for (const r of allConcluded) {
      const hour = parseInt(r.reservationTime?.split(':')[0] || '12', 10);
      hourBreakdown[hour].total++;
      if (r.status === 'NO_SHOW') hourBreakdown[hour].noShows++;
    }
    const noShowByHour = Object.entries(hourBreakdown).map(([h, s]) => ({
      hour: Number(h),
      total: s.total,
      noShows: s.noShows,
      rate: s.total > 0 ? Math.round((s.noShows / s.total) * 100) : 0,
    }));

    // ── Average risk of upcoming ──
    const avgUpcomingRisk = upcomingReservations.length > 0
      ? Math.round(upcomingReservations.reduce((s, r) => s + (r.riskScore || 0), 0) / upcomingReservations.length)
      : 0;

    res.json({
      success: true,
      data: {
        analytics: {
          totalReservations,
          confirmed,
          noShows,
          cancellations,
          completed,
          noShowRate: parseFloat(noShowRate.toFixed(2)),
          cancellationRate: parseFloat(cancellationRate.toFixed(2)),
          completionRate: parseFloat(completionRate.toFixed(2)),
          reservationsByStatus,
          protectedRevenue: protectedRevenue._sum.depositAmount || 0,
          unprotectedBookings: unprotectedRevenue,
          avgUpcomingRisk,
          noShowByDay,
          noShowByHour,
          businessCategory: business.category,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getBusinessReviews = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const business = await prisma.business.findUnique({
      where: { id },
      include: { googleReviews: true }
    });

    if (!business) {
      throw new CustomError('Business not found', 404);
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

    // If business has a Google Place ID, fetch latest reviews from Google
    if (business.googlePlaceId && apiKey) {
      try {
        const googleRes = await axios.get(
          `https://maps.googleapis.com/maps/api/place/details/json`, {
            params: {
              place_id: business.googlePlaceId,
              fields: 'reviews,rating,user_ratings_total',
              key: apiKey,
            }
          }
        );

        if (googleRes.data?.result) {
          const { reviews, rating, user_ratings_total } = googleRes.data.result;
          
          // Update business rating
          if (rating || user_ratings_total) {
            await prisma.business.update({
              where: { id },
              data: {
                rating: rating || business.rating,
                reviewCount: user_ratings_total || business.reviewCount,
              }
            });
          }

          // Sync reviews to database
          if (reviews && Array.isArray(reviews)) {
            for (const r of reviews) {
              const reviewTime = new Date(r.time * 1000); // Google returns Unix timestamp
              
              await prisma.googleReview.upsert({
                where: { googleReviewId: r.author_url || `${business.id}-${r.time}` },
                update: {
                  rating: r.rating,
                  text: r.text,
                },
                create: {
                  businessId: id,
                  googleReviewId: r.author_url || `${business.id}-${r.time}`,
                  authorName: r.author_name,
                  rating: r.rating,
                  text: r.text,
                  time: reviewTime,
                }
              });
            }
          }
        }
      } catch (apiErr) {
        console.error('Failed to sync Google Reviews:', apiErr);
        // We do not fail the request, just fall back to DB reviews
      }
    }

    // Fetch the updated reviews from DB
    const updatedReviews = await prisma.googleReview.findMany({
      where: { businessId: id },
      orderBy: { time: 'desc' }
    });

    res.json({
      success: true,
      data: { reviews: updatedReviews },
    });
  } catch (error) {
    next(error);
  }
};

export const claimBusiness = async (req: Request | any, res: Response, next: NextFunction) => {
  try {
    const { prisma } = await import('../utils/database');
    const { id } = req.params;

    // Must be authenticated to claim
    if (!req.user || !req.user.id) {
      throw new CustomError('Unauthorized to claim business', 401);
    }

    const business = await prisma.business.findUnique({
      where: { id },
    });

    if (!business) {
      throw new CustomError('Business not found', 404);
    }

    if (business.isClaimed || business.ownerId) {
      throw new CustomError('This business has already been claimed', 400);
    }

    // Instant Claim Logic
    const updatedBusiness = await prisma.business.update({
      where: { id },
      data: {
        ownerId: req.user.id,
        isClaimed: true,
      },
    });

    res.json({
      success: true,
      data: { business: updatedBusiness },
      message: 'Business claimed successfully',
    });
  } catch (error) {
    next(error);
  }
};


export const getBusinessCustomers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const business = await prisma.business.findUnique({
      where: { id }
    });

    if (!business) {
      throw new CustomError('Business not found', 404);
    }

    if (business.ownerId !== req.user!.id && req.user!.role !== 'ADMIN') {
      throw new CustomError('Not authorized', 403);
    }

    const reservations = await prisma.reservation.findMany({
      where: { businessId: id },
      // Include User data by joining on customerId if there is a relation.
      // Wait, let's check if Reservation has a relation to User.
      // In schema.prisma: customerId points to User? Let's verify.
      // In schema.prisma: model User { reservations Reservation[] }
      // In Reservation: No explicit relation field "customer User @relation(...)"?
      // Let's check schema.prisma again.
      // Wait, I didn't see the full Reservation model. Let's do raw query or manual join if no relation exists.
    });

    // Actually, let's just query users who have booked.
    // The safest way is to fetch reservations, then fetch users.
    const userIds = Array.from(new Set(reservations.map(r => r.customerId).filter(Boolean)));
    
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, reliabilityScore: true }
    });

    const userMap = new Map();
    users.forEach(u => userMap.set(u.id, u));

    const customerMap = new Map();

    reservations.forEach(r => {
      const cId = r.customerId;
      if (!cId) return;
      
      const user = userMap.get(cId);
      if (!user) return; // fallback to customerName/Phone if needed, but we want the user object

      if (!customerMap.has(cId)) {
        customerMap.set(cId, {
          user: user,
          totalBookings: 0,
          noShowCount: 0,
          totalSpend: 0,
          lastBookingDate: r.reservationDate,
          customerName: r.customerName,
          customerPhone: r.customerPhone,
          customerEmail: r.customerEmail
        });
      }
      
      const stats = customerMap.get(cId);
      stats.totalBookings += 1;
      if (r.status === 'NO_SHOW') stats.noShowCount += 1;
      if (r.depositAmount && r.depositPaid) stats.totalSpend += r.depositAmount;
      
      if (new Date(r.reservationDate) > new Date(stats.lastBookingDate)) {
        stats.lastBookingDate = r.reservationDate;
      }
    });

    const customers = Array.from(customerMap.values());

    res.json({
      success: true,
      data: { customers }
    });

  } catch (error) {
    next(error);
  }
};
