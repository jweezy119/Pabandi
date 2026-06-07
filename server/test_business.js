const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // create a fake user
    const user = await prisma.user.create({
      data: {
        email: 'test_biz_' + Date.now() + '@example.com',
        passwordHash: 'fake',
        firstName: 'Test',
        lastName: 'Biz',
      }
    });
    console.log('User created:', user.id);

    const business = await prisma.business.create({
      data: {
        ownerId: user.id,
        name: 'My Business',
        description: 'A test business',
        category: 'RESTAURANT',
        address: '123 Fake St',
        city: 'Karachi',
        phone: '1234567890',
        email: 'test_biz_' + Date.now() + '@example.com',
        website: 'https://example.com',
        timezone: 'Asia/Karachi',
      },
    });

    console.log('Business created:', business.id);

    // clean up
    await prisma.business.delete({ where: { id: business.id } });
    await prisma.user.delete({ where: { id: user.id } });
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
