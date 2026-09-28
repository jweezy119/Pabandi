const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.invoiceTrustEvent.findMany({ take: 5, orderBy: { createdAt: 'desc' } }).then(res => { console.log(res); process.exit(0); });
