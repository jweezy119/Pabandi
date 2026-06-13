const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const businesses = await prisma.business.findMany();
  console.log(JSON.stringify(businesses, null, 2));
  process.exit(0);
}

main();
