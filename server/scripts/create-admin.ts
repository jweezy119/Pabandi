import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Demo@123', 10);
  
  const user = await prisma.user.upsert({
    where: { email: 'judge_admin@pabandi.app' },
    update: {
      passwordHash,
      role: 'ADMIN',
      isEmailVerified: true,
    },
    create: {
      email: 'judge_admin@pabandi.app',
      firstName: 'Judge',
      lastName: 'Admin',
      passwordHash,
      role: 'ADMIN',
      isEmailVerified: true,
    }
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'admin@pabandi.com' },
    update: {
      passwordHash,
      role: 'ADMIN',
      isEmailVerified: true,
    },
    create: {
      email: 'admin@pabandi.com',
      firstName: 'System',
      lastName: 'Admin',
      passwordHash,
      role: 'ADMIN',
      isEmailVerified: true,
    }
  });

  console.log(`Created admin user: ${user.email} and ${user2.email}`);
  
  // also create the owner and customer just in case
  await prisma.user.upsert({
    where: { email: 'judge_owner@pabandi.app' },
    update: {
      passwordHash,
      role: 'BUSINESS_OWNER',
      isEmailVerified: true,
    },
    create: {
      email: 'judge_owner@pabandi.app',
      firstName: 'Judge',
      lastName: 'Owner',
      passwordHash,
      role: 'BUSINESS_OWNER',
      isEmailVerified: true,
    }
  });

  await prisma.user.upsert({
    where: { email: 'judge_customer@pabandi.app' },
    update: {
      passwordHash,
      role: 'CUSTOMER',
      isEmailVerified: true,
    },
    create: {
      email: 'judge_customer@pabandi.app',
      firstName: 'Judge',
      lastName: 'Customer',
      passwordHash,
      role: 'CUSTOMER',
      isEmailVerified: true,
    }
  });

  console.log('Created all demo users.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
