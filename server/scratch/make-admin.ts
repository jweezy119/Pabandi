import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 's.hussain119@gmail.com';
  
  console.log(`Checking if user ${email} exists...`);
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (user) {
    console.log(`User exists with role: ${user.role}. Updating role to ADMIN...`);
    const updated = await prisma.user.update({
      where: { email },
      data: { role: 'ADMIN' },
    });
    console.log(`Successfully updated ${email} to role: ${updated.role}`);
  } else {
    console.log(`User does not exist. Creating new ADMIN user...`);
    const passwordHash = await bcrypt.hash('password123', 10);
    const created = await prisma.user.create({
      data: {
        email,
        firstName: 'Admin',
        lastName: 'User',
        passwordHash,
        role: 'ADMIN',
        isEmailVerified: true,
      },
    });
    console.log(`Successfully created new admin user: ${created.email} with password: password123`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
