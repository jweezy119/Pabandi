import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
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
        description: 'Premium fine dining experience in the heart of Karachi.',
        category: 'RESTAURANT',
        address: 'D 141, Block 4 Clifton',
        city: 'Karachi',
        phone: '+92 21 35309869',
        email: 'info@cafeaylanto.com',
        coverImageUrl: 'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?q=80&w=1200&auto=format&fit=crop',
        googlePlaceId: 'ChIJz2x0X6o8zzsRh7hD4p2Q9bY', // Actual Place ID for a restaurant
        rating: 4.8,
        reviewCount: 154,
        isVerified: true,
      }
    },
    {
      user: {
        email: 'owner2@pabandi.com',
        firstName: 'Zara',
        lastName: 'Shah',
      },
      business: {
        name: 'Peng\'s Salon',
        description: 'Luxury hair and skin care salon for men and women.',
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
      }
    },
    {
      user: {
        email: 'owner3@pabandi.com',
        firstName: 'Fahad',
        lastName: 'Mustafa',
      },
      business: {
        name: 'Structure Health & Fitness',
        description: 'State of the art gym equipment and personal training.',
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
      }
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
    await prisma.business.upsert({
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

    console.log(`Created business: ${data.business.name} (Owner: ${user.email})`);
  }

  // Create an Unclaimed Business
  await prisma.business.create({
    data: {
      name: 'BBQ Tonight (Unclaimed Demo)',
      description: 'Famous Pakistani BBQ & traditional food.',
      category: 'RESTAURANT',
      address: 'Clifton Block 5',
      city: 'Karachi',
      phone: '+92 21 111 227 111',
      email: 'hello@bbqtonight.com',
      coverImageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=1200&auto=format&fit=crop',
      googlePlaceId: 'ChIJz2x0X6o8zzsRh7hD4p2Q9bY', // Same place ID so reviews load
      rating: 4.7,
      reviewCount: 450,
      isVerified: false,
      isClaimed: false,
      ownerId: null, // Unclaimed!
    }
  });

  console.log('Created unclaimed business: BBQ Tonight');

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
