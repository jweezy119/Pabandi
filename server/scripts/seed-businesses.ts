import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing existing Google reviews & businesses...');
  try {
    await prisma.googleReview.deleteMany({});
    console.log('Cleared google reviews.');
  } catch (e) {}

  console.log('Seeding database with demo businesses...');

  // Mock data for 3 businesses
  const seedData = [
    {
      user: {
        email: 'owner1@pabandi.com',
        firstName: 'Tariq',
        lastName: 'Ahmed',
      },
      business: {
        name: 'Cafe Aylanto',
        description: 'Premium fine dining experience in the heart of Karachi. Specializing in Mediterranean cuisine, gourmet pastas, and signature steaks.',
        category: 'RESTAURANT',
        address: 'D 141, Block 4 Clifton',
        city: 'Karachi',
        phone: '+92 21 35309869',
        email: 'info@cafeaylanto.com',
        coverImageUrl: 'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?q=80&w=1200&auto=format&fit=crop',
        googlePlaceId: 'ChIJz2x0X6o8zzsRh7hD4p2Q9bY', // Actual Place ID
        rating: 4.8,
        reviewCount: 154,
        isVerified: true,
        latitude: 24.8219,
        longitude: 67.0305,
      },
      reviews: [
        {
          googleReviewId: 'review_aylanto_1',
          authorName: 'Hamza Abbasi',
          rating: 5,
          text: 'Aylanto Clifton is simply unmatched. Their signature Moroccan Chicken was superb. Easiest table booking experience using Pabandi—no deposit required because of my high reliability score! Paid via my Solana wallet and earned 25 PAB tokens.',
          time: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
          sentimentLabel: 'positive',
        },
        {
          googleReviewId: 'review_aylanto_2',
          authorName: 'Aisha Rehman',
          rating: 5,
          text: 'Lovely ambiance, very high-end. We booked a VIP table last Friday. The host checked us in using a QR scan, and my locked Solana deposit was instantly returned to my Phantom wallet. Love the Web3 integration!',
          time: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
          sentimentLabel: 'positive',
        },
        {
          googleReviewId: 'review_aylanto_3',
          authorName: 'Bilal Siddiqui',
          rating: 4,
          text: 'Excellent food and service. Highly recommended for business dinners. Contrast on their digital menu is a bit bright but overall a solid fine-dining experience.',
          time: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
          sentimentLabel: 'positive',
        }
      ]
    },
    {
      user: {
        email: 'owner2@pabandi.com',
        firstName: 'Zara',
        lastName: 'Shah',
      },
      business: {
        name: 'Peng\'s Salon',
        description: 'Luxury hair and skin care salon for men and women. Experience premium facials, haircuts, and spa treatments.',
        category: 'SALON',
        address: 'F-50/3, Block 4 Clifton',
        city: 'Karachi',
        phone: '+92 21 35873029',
        email: 'booking@pengssalon.com',
        coverImageUrl: 'https://images.unsplash.com/photo-1600948836101-f9ffda59d250?q=80&w=1200&auto=format&fit=crop',
        googlePlaceId: 'ChIJL_B0xJo8zzsRzW2-520x4A4', // Sample Place ID
        rating: 4.6,
        reviewCount: 89,
        isVerified: true,
        latitude: 24.8198,
        longitude: 67.0289,
      },
      reviews: [
        {
          googleReviewId: 'review_pengs_1',
          authorName: 'Sana Malik',
          rating: 5,
          text: 'The best hair treatment in Karachi. Extremely clean and professional staff. I love that Peng\'s now uses Pabandi protection. No double bookings or waitlists anymore. Earned PAB tokens which I staked for their salon membership NFT!',
          time: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
          sentimentLabel: 'positive',
        },
        {
          googleReviewId: 'review_pengs_2',
          authorName: 'Mariam Jamil',
          rating: 4,
          text: 'Excellent facial and manicure services. The scheduling was precise. It\'s great to see local salons adapting blockchain technology for customer loyalty.',
          time: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
          sentimentLabel: 'positive',
        }
      ]
    },
    {
      user: {
        email: 'owner3@pabandi.com',
        firstName: 'Fahad',
        lastName: 'Mustafa',
      },
      business: {
        name: 'Structure Health & Fitness',
        description: 'State of the art gym equipment, swimming pool, personal training, and group classes in DHA Karachi.',
        category: 'FITNESS_CENTER',
        address: 'Phase 5, DHA',
        city: 'Karachi',
        phone: '+92 21 35840656',
        email: 'info@structurefitness.com',
        coverImageUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1200&auto=format&fit=crop',
        googlePlaceId: 'ChIJb6F-1Zg8zzsRU1n2Z0dZ7A4', // Sample Place ID
        rating: 4.9,
        reviewCount: 312,
        isVerified: true,
        latitude: 24.8015,
        longitude: 67.0682,
      },
      reviews: [
        {
          googleReviewId: 'review_structure_1',
          authorName: 'Mustafa Qureshi',
          rating: 5,
          text: 'Top tier gym in DHA. Equipment is top notch and the trainers are highly certified. Staked 100 PAB to get access to their weekend Solana-gated swimming pool sessions. Absolutely loving this platform!',
          time: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
          sentimentLabel: 'positive',
        },
        {
          googleReviewId: 'review_structure_2',
          authorName: 'Zainab Ali',
          rating: 5,
          text: 'Modern facility, very clean. The trainer onboarding was very smooth. I highly recommend checking out their tech-gated spinning classes.',
          time: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000), // 12 days ago
          sentimentLabel: 'positive',
        }
      ]
    }
  ];

  const passwordHash = await bcrypt.hash('password123', 10);

  for (const data of seedData) {
    // 1. Upsert User
    const user = await prisma.user.upsert({
      where: { email: data.user.email },
      update: {},
      create: {
        email: data.user.email,
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        passwordHash,
        role: 'BUSINESS_OWNER',
        isEmailVerified: true,
      }
    });

    // 2. Upsert Business
    const business = await prisma.business.upsert({
      where: { ownerId: user.id },
      update: {
        ...data.business,
        category: data.business.category as any,
      },
      create: {
        ownerId: user.id,
        ...data.business,
        category: data.business.category as any,
      }
    });

    console.log(`Created business: ${business.name} (Owner: ${user.email})`);

    // 3. Insert Reviews
    for (const r of data.reviews) {
      await prisma.googleReview.upsert({
        where: { googleReviewId: r.googleReviewId },
        update: {
          rating: r.rating,
          text: r.text,
          time: r.time,
          sentimentLabel: r.sentimentLabel,
        },
        create: {
          businessId: business.id,
          googleReviewId: r.googleReviewId,
          authorName: r.authorName,
          rating: r.rating,
          text: r.text,
          time: r.time,
          sentimentLabel: r.sentimentLabel,
        }
      });
    }
    console.log(`Synced ${data.reviews.length} reviews for ${business.name}.`);
  }

  // Create an Unclaimed Business
  const unclaimedBiz = await prisma.business.create({
    data: {
      name: 'BBQ Tonight',
      description: 'Famous Pakistani barbecue & traditional food. A landmark destination in Karachi for kebab lovers.',
      category: 'RESTAURANT',
      address: 'Clifton Block 5',
      city: 'Karachi',
      phone: '+92 21 111 227 111',
      email: 'hello@bbqtonight.com',
      coverImageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=1200&auto=format&fit=crop',
      googlePlaceId: 'ChIJz2x0X6o8zzsRh7hD4p2Q9bY', // Actual Place ID
      rating: 4.7,
      reviewCount: 450,
      isVerified: false,
      isClaimed: false,
      ownerId: null, // Unclaimed!
      latitude: 24.8159,
      longitude: 67.0329,
    }
  });

  console.log('Created unclaimed business: BBQ Tonight');

  // Seed reviews for unclaimed BBQ Tonight
  const bbqReviews = [
    {
      googleReviewId: 'review_bbq_1',
      authorName: 'Salman Farooq',
      rating: 5,
      text: 'BBQ Tonight Clifton is a Karachi legend. The mutton ribs and chicken boti were absolutely divine. I hope they claim their Pabandi listing soon so we can earn tokens for booking here. Highly recommended!',
      time: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      sentimentLabel: 'positive',
    },
    {
      googleReviewId: 'review_bbq_2',
      authorName: "Fiona D'Souza",
      rating: 4,
      text: 'Authentic Pakistani barbecue. Huge seating area. Easiest check-in, but currently unclaimed on Pabandi. Requesting the owners to claim it so we can book with our Web3 wallets!',
      time: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      sentimentLabel: 'positive',
    }
  ];

  for (const r of bbqReviews) {
    await prisma.googleReview.create({
      data: {
        businessId: unclaimedBiz.id,
        googleReviewId: r.googleReviewId,
        authorName: r.authorName,
        rating: r.rating,
        text: r.text,
        time: r.time,
        sentimentLabel: r.sentimentLabel,
      }
    });
  }

  console.log('Database seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
