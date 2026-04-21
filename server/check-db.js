require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$connect();
    console.log("SUCCESS: Connected to the database successfully!");
  } catch (error) {
    console.error("ERROR: Failed to connect to the database.");
    console.error(error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
