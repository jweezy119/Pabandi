import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const router = Router();

/**
 * POST /api/v1/seed/freelancers
 * Admin endpoint to generate AI-like freelancer profiles
 */
router.post('/freelancers', async (req: Request, res: Response): Promise<any> => {
  try {
    const { count = 5 } = req.body;
    const generatedProfiles = [];

    const mockTitles = ['Senior React Developer', 'UI/UX Designer', 'Growth Marketing Expert', 'Solana Web3 Engineer', 'Technical Writer'];
    const mockSkills = ['React, Node.js, TypeScript', 'Figma, Prototyping, Wireframing', 'SEO, SEM, Paid Ads', 'Rust, Anchor, Solana Web3.js', 'API Documentation, Copywriting'];

    for (let i = 0; i < count; i++) {
      const idx = i % mockTitles.length;
      const email = `mock_freelancer_${Date.now()}_${i}@pabandi.local`;
      const passwordHash = await bcrypt.hash('password123', 10);
      
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName: `Alex${i}`,
          lastName: `Pro${i}`,
          role: UserRole.FREELANCER,
          isEmailVerified: true,
          trustScore: 85 + Math.random() * 10, // High trust score for seeded profiles
          freelanceScore: 90 + Math.random() * 8,
          verificationTier: "VERIFIED",
        }
      });

      // We associate a "Business" profile with the freelancer so they can accept bookings/reservations
      const business = await prisma.business.create({
        data: {
          ownerId: user.id,
          name: `${user.firstName} ${user.lastName} - ${mockTitles[idx]}`,
          category: 'FREELANCE',
          address: 'Remote',
          phone: `+1555000${i.toString().padStart(4, '0')}`,
          email: user.email,
          description: `I am a highly rated ${mockTitles[idx]} with 5+ years of experience. Skills: ${mockSkills[idx]}. I deliver exceptional results on time.`,
          isVerified: true,
          isActive: true,
          trustScore: user.trustScore,
          externalDetails: {
            hourlyRate: 50 + (i * 10),
            skills: mockSkills[idx].split(', ')
          }
        }
      });

      generatedProfiles.push({ user, business });
    }

    res.json({ success: true, count, data: generatedProfiles });
  } catch (error: any) {
    logger.error('Error seeding freelancers', error);
    res.status(500).json({ success: false, error: 'Failed to seed profiles' });
  }
});

/**
 * POST /api/v1/seed/bookings
 * Admin endpoint to generate fake transaction history (bookings) for freelancers
 */
router.post('/bookings', async (req: Request, res: Response): Promise<any> => {
  try {
    const { count = 10 } = req.body;
    
    // Find a real or mock customer to act as the buyer
    const customer = await prisma.user.findFirst({ where: { role: 'CUSTOMER' } });
    if (!customer) {
      return res.status(400).json({ success: false, error: 'No customer found in DB to assign bookings to.' });
    }

    // Find all freelance businesses
    const freelancers = await prisma.business.findMany({ where: { category: 'FREELANCE' } });
    if (freelancers.length === 0) {
      return res.status(400).json({ success: false, error: 'No freelancers found. Seed freelancers first.' });
    }

    const generatedBookings = [];

    for (let i = 0; i < count; i++) {
      const freelancer = freelancers[Math.floor(Math.random() * freelancers.length)];
      
      const reservation = await prisma.reservation.create({
        data: {
          businessId: freelancer.id,
          customerId: customer.id,
          reservationDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Past 30 days
          reservationTime: '10:00',
          numberOfGuests: 1,
          status: 'COMPLETED',
          customerName: customer.firstName + ' ' + customer.lastName,
          customerPhone: customer.phone || '+1000000000',
          depositRequired: true,
          depositAmount: 100,
          depositPaid: true,
          depositStatus: 'REIMBURSED_TO_BUSINESS',
          notes: 'Completed freelance milestone.',
          totalAmount: 500
        }
      });
      generatedBookings.push(reservation);
    }

    res.json({ success: true, count, data: generatedBookings });
  } catch (error: any) {
    logger.error('Error seeding bookings', error);
    res.status(500).json({ success: false, error: 'Failed to seed bookings' });
  }
});

export default router;
